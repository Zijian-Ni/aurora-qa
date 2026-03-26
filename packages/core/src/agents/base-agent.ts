import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'node:events';
import type { AuroraConfig, AgentRole, AgentStatus } from '../types/index.js';
import { Logger, logger as rootLogger } from '../utils/logger.js';

export interface AgentOptions {
  id?: string;
  role: AgentRole;
  name: string;
  systemPrompt: string;
  tools?: Anthropic.Tool[];
  config: AuroraConfig;
  maxConsecutiveFailures?: number;
}

export interface ToolCallResult {
  success: boolean;
  data: unknown;
  error?: string;
}

/**
 * Base class for all Aurora QA agents.
 *
 * Implements an agentic loop using the Anthropic Messages API with tool use.
 * Subclasses override `handleToolCall` to provide domain-specific tool logic.
 */
export abstract class BaseAgent extends EventEmitter {
  readonly id: string;
  readonly role: AgentRole;
  readonly name: string;

  protected status: AgentStatus = 'idle';
  protected client: Anthropic;
  protected systemPrompt: string;
  protected tools: Anthropic.Tool[];
  protected config: AuroraConfig;
  protected history: Anthropic.MessageParam[] = [];
  protected readonly maxHistorySize = 100;
  protected readonly maxConsecutiveFailures: number;
  protected consecutiveFailures = 0;
  protected logger: Logger;

  constructor(options: AgentOptions) {
    super();
    this.id = options.id ?? crypto.randomUUID();
    this.role = options.role;
    this.name = options.name;
    this.systemPrompt = options.systemPrompt;
    this.tools = options.tools ?? [];
    this.config = options.config;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
    this.logger = rootLogger.child(this.name);
    this.client = new Anthropic({ apiKey: options.config.anthropicApiKey });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  getStatus(): AgentStatus {
    return this.status;
  }

  clearHistory(): void {
    this.history = [];
  }

  toJSON() {
    return { id: this.id, role: this.role, name: this.name, status: this.status };
  }

  // ─── Agentic loop ────────────────────────────────────────────────────────────

  /**
   * Run the agent with a user message and return the final text response.
   * Continues calling tools until `stop_reason === 'end_turn'` or max iterations.
   */
  protected async runLoop(
    userMessage: string,
    {
      maxIterations = 12,
      appendHistory = false,
    }: { maxIterations?: number; appendHistory?: boolean } = {},
  ): Promise<string> {
    // Circuit breaker: refuse to run if too many consecutive failures
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      const msg = `Agent "${this.name}" circuit-breaker tripped after ${this.consecutiveFailures} consecutive failures. Call resetCircuitBreaker() to re-enable.`;
      this.logger.error(msg);
      this.emit('circuit-breaker', { agentId: this.id, consecutiveFailures: this.consecutiveFailures });
      throw new Error(msg);
    }

    if (!appendHistory) this.history = [];
    this.setStatus('running');

    this.history.push({ role: 'user', content: userMessage });

    let finalText = '';
    let iterations = 0;

    try {
      while (iterations < maxIterations) {
        iterations++;

        this.logger.debug(`Iteration ${iterations}`, { historyLength: this.history.length });

        const response = await this.callAPI();

        this.emit('llm-response', { agentId: this.id, response, iteration: iterations });

        const textBlocks = response.content
          .filter((c): c is Anthropic.TextBlock => c.type === 'text')
          .map(c => c.text);

        if (textBlocks.length > 0) {
          finalText = textBlocks.join('\n');
        }

        if (response.stop_reason === 'end_turn') {
          this.history.push({ role: 'assistant', content: response.content });
          break;
        }

        if (response.stop_reason === 'tool_use') {
          this.history.push({ role: 'assistant', content: response.content });
          const toolResults = await this.processToolUse(response.content);
          this.history.push({ role: 'user', content: toolResults });
          this.trimHistory();
          continue;
        }

        // Unexpected stop reason — break to avoid infinite loop
        this.logger.warn(`Unexpected stop_reason: ${response.stop_reason}`);
        break;
      }

      if (iterations >= maxIterations) {
        this.logger.warn(`Reached max iterations (${maxIterations})`);
      }

      // Success — reset circuit breaker counter
      this.consecutiveFailures = 0;
      this.setStatus('completed');
      return finalText;
    } catch (err) {
      this.consecutiveFailures++;
      this.setStatus('error');
      this.emit('error', { agentId: this.id, error: err, consecutiveFailures: this.consecutiveFailures });

      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.logger.error(`Circuit breaker tripped: ${this.consecutiveFailures} consecutive failures`, { agentId: this.id });
        this.emit('circuit-breaker', { agentId: this.id, consecutiveFailures: this.consecutiveFailures });
      }

      throw err;
    }
  }

  /** Reset the circuit breaker after consecutive failures. */
  resetCircuitBreaker(): void {
    this.consecutiveFailures = 0;
    this.logger.info('Circuit breaker reset', { agentId: this.id });
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  private async callAPI(): Promise<Anthropic.Message> {
    const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: this.systemPrompt,
      messages: this.history,
    };

    if (this.tools.length > 0) {
      requestParams.tools = this.tools;
    }

    return this.client.messages.create(requestParams);
  }

  private async processToolUse(
    content: Anthropic.ContentBlock[],
  ): Promise<Anthropic.ToolResultBlockParam[]> {
    const toolUseBlocks = content.filter(
      (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use',
    );

    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      this.logger.debug(`Tool call: ${block.name}`, { input: block.input });
      this.emit('tool-call', { agentId: this.id, tool: block.name, input: block.input });

      let resultContent: string;
      let isError = false;

      try {
        const result = await this.handleToolCall(
          block.name,
          block.input as Record<string, unknown>,
        );
        resultContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        this.logger.debug(`Tool result: ${block.name}`, { success: true });
      } catch (err) {
        isError = true;
        resultContent = err instanceof Error ? err.message : String(err);
        this.logger.error(`Tool error: ${block.name}`, err);
      }

      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: resultContent,
        ...(isError ? { is_error: true } : {}),
      });
    }

    return results;
  }

  private trimHistory(): void {
    if (this.history.length > this.maxHistorySize) {
      // Keep the first message (system context) and trim from the front
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  private setStatus(status: AgentStatus): void {
    const previous = this.status;
    this.status = status;
    if (previous !== status) {
      this.emit('status-change', { agentId: this.id, from: previous, to: status });
    }
  }

  // ─── Abstract interface ──────────────────────────────────────────────────────

  /**
   * Handle a tool call dispatched from the agentic loop.
   * Subclasses must implement this to provide tool logic.
   */
  protected abstract handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown>;
}
