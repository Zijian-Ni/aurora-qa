import Anthropic from '@anthropic-ai/sdk';
import type { AuroraConfig, ReasoningResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export class ReasoningEngine {
  private client: Anthropic;
  private config: AuroraConfig;
  private readonly timeoutMs: number;
  private readonly log = logger.child('reasoning');

  constructor(config: AuroraConfig, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.config = config;
    this.timeoutMs = timeoutMs;
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
  }

  async reason(problem: string, context: Record<string, unknown> = {}): Promise<ReasoningResult> {
    this.log.debug('Reasoning about problem', { problem: problem.slice(0, 100) });

    const systemPrompt = `You are a reasoning engine. Think step by step to solve problems.
Always structure your response as JSON with this format:
{
  "steps": ["step 1", "step 2", ...],
  "conclusion": "final conclusion",
  "confidence": 0.0-1.0,
  "alternatives": ["alternative 1", ...]
}`;

    const userMessage = [
      `Problem: ${problem}`,
      Object.keys(context).length > 0 ? `\nContext:\n${JSON.stringify(context, null, 2)}` : '',
    ].filter(Boolean).join('\n');

    try {
      const response = await this.callWithTimeout({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === 'text')
        .map(c => c.text)
        .join('');

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as ReasoningResult;
          return {
            steps: parsed.steps ?? [],
            conclusion: parsed.conclusion ?? text,
            confidence: parsed.confidence ?? 0.5,
            alternatives: parsed.alternatives ?? [],
          };
        }
      } catch (parseErr) {
        this.log.warn('Failed to parse JSON from reasoning response', { error: parseErr });
      }

      return {
        steps: [text],
        conclusion: text,
        confidence: 0.5,
        alternatives: [],
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        this.log.warn(`Reasoning timed out after ${this.timeoutMs}ms, returning degraded result`);
        return { steps: [], conclusion: 'Reasoning timed out', confidence: 0, alternatives: [] };
      }
      this.log.error('Reasoning failed', err);
      return { steps: [], conclusion: 'Reasoning failed', confidence: 0, alternatives: [] };
    }
  }

  async decompose(complexTask: string): Promise<string[]> {
    const result = await this.reason(
      `Decompose this complex task into atomic subtasks:\n\n${complexTask}`,
    );
    return result.steps.length > 1 ? result.steps : [complexTask];
  }

  async validate(reasoning: ReasoningResult): Promise<{ valid: boolean; issues: string[] }> {
    const validationResult = await this.reason(
      `Validate this reasoning. Are there logical flaws or gaps?\n\nSteps: ${reasoning.steps.join(' → ')}\nConclusion: ${reasoning.conclusion}`,
    );

    return {
      valid: validationResult.confidence > 0.7,
      issues: validationResult.alternatives,
    };
  }

  async explain(decision: string, context?: Record<string, unknown>): Promise<string> {
    const result = await this.reason(
      `Explain this decision in clear, human-readable language:\n\n${decision}`,
      context,
    );
    return result.conclusion;
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async callWithTimeout(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.client.messages.create(params, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
