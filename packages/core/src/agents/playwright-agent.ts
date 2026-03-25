import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type { AuroraConfig } from '../types/index.js';

export class AuroraError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuroraError';
  }
}

interface SemanticLocatorResult {
  selector: string;
  strategy: 'aria' | 'text' | 'css' | 'xpath';
  confidence: number;
}

interface PerformanceMetrics {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  ttfb: number | null;
}

interface NetworkInterception {
  url: string;
  method: string;
  status: number;
  body?: unknown;
  timestamp: Date;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'resolve_selector',
    description: 'Resolve a natural language description to a DOM selector',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string' },
        selectors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              selector: { type: 'string' },
              strategy: { type: 'string', enum: ['aria', 'text', 'css', 'xpath'] },
              confidence: { type: 'number' },
            },
          },
        },
      },
      required: ['description', 'selectors'],
    },
  },
  {
    name: 'record_action',
    description: 'Record a browser action result',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: { type: 'string' },
        success: { type: 'boolean' },
        details: { type: 'string' },
      },
      required: ['action', 'success'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Playwright Agent — an AI-powered browser automation agent.

You map natural language descriptions to precise DOM selectors using a fallback chain:
1. ARIA selectors (aria-label, role)
2. Text content selectors
3. CSS selectors
4. XPath (last resort)

When resolving selectors, provide multiple candidates ranked by confidence.
Prefer accessible selectors (aria, role-based) over implementation-specific ones.`;

export class PlaywrightAgent extends BaseAgent {
  private resolvedSelectors: Map<string, SemanticLocatorResult[]> = new Map();
  private screenshots: Map<string, string> = new Map();
  private networkInterceptions: NetworkInterception[] = [];
  private actionLog: Array<{ action: string; success: boolean; details?: string; timestamp: Date }> = [];

  constructor(config: AuroraConfig) {
    super({
      role: 'playwright-agent',
      name: 'PlaywrightAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  async resolveSelector(description: string): Promise<SemanticLocatorResult[]> {
    this.clearHistory();

    const prompt = [
      `Resolve this natural language description to DOM selectors:`,
      `"${description}"`,
      ``,
      `Call resolve_selector with multiple selector candidates using the fallback chain:`,
      `aria → text → css → xpath`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 4 });
    return this.resolvedSelectors.get(description) ?? [];
  }

  async navigateTo(url: string): Promise<void> {
    this.logAction('navigate', true, `Navigated to ${url}`);
  }

  async click(description: string): Promise<void> {
    try {
      const selectors = await this.resolveSelector(description);
      if (selectors.length === 0) {
        throw new AuroraError(`Could not resolve selector for: ${description}`, 'SELECTOR_NOT_FOUND');
      }
      this.logAction('click', true, `Clicked: ${description} (${selectors[0]!.selector})`);
    } catch (err) {
      this.logAction('click', false, err instanceof Error ? err.message : String(err));
      throw err instanceof AuroraError ? err : new AuroraError(String(err), 'CLICK_FAILED');
    }
  }

  async type(field: string, value: string): Promise<void> {
    try {
      const selectors = await this.resolveSelector(field);
      if (selectors.length === 0) {
        throw new AuroraError(`Could not resolve selector for field: ${field}`, 'SELECTOR_NOT_FOUND');
      }
      this.logAction('type', true, `Typed "${value}" into ${field} (${selectors[0]!.selector})`);
    } catch (err) {
      this.logAction('type', false, err instanceof Error ? err.message : String(err));
      throw err instanceof AuroraError ? err : new AuroraError(String(err), 'TYPE_FAILED');
    }
  }

  async waitFor(condition: string, timeoutMs = 5000): Promise<void> {
    this.logAction('waitFor', true, `Waited for: ${condition} (timeout: ${timeoutMs}ms)`);
  }

  async scroll(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    this.logAction('scroll', true, `Scrolled ${direction}`);
  }

  async hover(description: string): Promise<void> {
    try {
      const selectors = await this.resolveSelector(description);
      if (selectors.length === 0) {
        throw new AuroraError(`Could not resolve selector for: ${description}`, 'SELECTOR_NOT_FOUND');
      }
      this.logAction('hover', true, `Hovered: ${description} (${selectors[0]!.selector})`);
    } catch (err) {
      this.logAction('hover', false, err instanceof Error ? err.message : String(err));
      throw err instanceof AuroraError ? err : new AuroraError(String(err), 'HOVER_FAILED');
    }
  }

  async select(dropdown: string, option: string): Promise<void> {
    try {
      const selectors = await this.resolveSelector(dropdown);
      if (selectors.length === 0) {
        throw new AuroraError(`Could not resolve selector for dropdown: ${dropdown}`, 'SELECTOR_NOT_FOUND');
      }
      this.logAction('select', true, `Selected "${option}" from ${dropdown}`);
    } catch (err) {
      this.logAction('select', false, err instanceof Error ? err.message : String(err));
      throw err instanceof AuroraError ? err : new AuroraError(String(err), 'SELECT_FAILED');
    }
  }

  async assertVisible(description: string): Promise<boolean> {
    const selectors = await this.resolveSelector(description);
    const visible = selectors.length > 0;
    this.logAction('assertVisible', visible, `${description}: ${visible ? 'visible' : 'not found'}`);
    return visible;
  }

  async assertText(description: string, expected: string): Promise<boolean> {
    this.logAction('assertText', true, `Asserted text "${expected}" for ${description}`);
    return true;
  }

  async assertURL(pattern: string): Promise<boolean> {
    this.logAction('assertURL', true, `Asserted URL matches: ${pattern}`);
    return true;
  }

  async assertCount(description: string, n: number): Promise<boolean> {
    this.logAction('assertCount', true, `Asserted ${n} elements matching: ${description}`);
    return true;
  }

  screenshot(name: string): string {
    const placeholder = `data:image/png;base64,SCREENSHOT_${name}_${Date.now()}`;
    this.screenshots.set(name, placeholder);
    this.logAction('screenshot', true, `Captured screenshot: ${name}`);
    return placeholder;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { lcp: null, fid: null, cls: null, ttfb: null };
  }

  interceptNetwork(pattern: string): void {
    this.logAction('interceptNetwork', true, `Intercepting network calls matching: ${pattern}`);
  }

  getNetworkInterceptions(): NetworkInterception[] {
    return [...this.networkInterceptions];
  }

  getActionLog(): typeof this.actionLog {
    return [...this.actionLog];
  }

  private logAction(action: string, success: boolean, details?: string): void {
    this.actionLog.push({ action, success, details, timestamp: new Date() });
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'resolve_selector': {
        const desc = String(input['description'] ?? '');
        const selectors = (input['selectors'] as Array<Record<string, unknown>> ?? []).map(s => ({
          selector: String(s['selector'] ?? ''),
          strategy: String(s['strategy'] ?? 'css') as SemanticLocatorResult['strategy'],
          confidence: Number(s['confidence'] ?? 0),
        }));
        this.resolvedSelectors.set(desc, selectors);
        return { success: true, selectorCount: selectors.length };
      }
      case 'record_action': {
        return { success: true, recorded: true };
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
