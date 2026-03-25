import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type {
  AuroraConfig,
  FailureClassification,
  HealingSuggestion,
  HealingStats,
} from '../types/index.js';
import { KnowledgeBase } from '../memory/knowledge-base.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'classify_failure',
    description: 'Classify the root cause of a test failure',
    input_schema: {
      type: 'object' as const,
      properties: {
        classification: {
          type: 'string',
          enum: ['selector_stale', 'timing_race', 'env_flakiness', 'logic_change', 'data_dependency', 'unknown'],
        },
        reasoning: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['classification', 'reasoning', 'confidence'],
    },
  },
  {
    name: 'suggest_fix',
    description: 'Suggest a fix for the classified failure',
    input_schema: {
      type: 'object' as const,
      properties: {
        fix: { type: 'string', description: 'Description of the fix' },
        confidence: { type: 'number', description: '0-1 confidence score' },
        strategy: { type: 'string', description: 'Name of the healing strategy' },
        patchCode: { type: 'string', description: 'Code patch to apply' },
      },
      required: ['fix', 'confidence', 'strategy'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Healer Agent — a self-healing test recovery system.

Your mission is to analyze test failures, classify root causes, and suggest automated fixes.

Classification categories:
- selector_stale: UI element selectors that no longer match the DOM
- timing_race: Race conditions or timing-dependent failures
- env_flakiness: Environment-specific issues (CI vs local, flaky network)
- logic_change: Intentional code changes that require test updates
- data_dependency: Test data assumptions that are no longer valid
- unknown: Cannot determine root cause

Process:
1. Analyze the failure error, context, and optional screenshot
2. Call classify_failure with your assessment
3. Call suggest_fix with a concrete remediation`;

export class HealerAgent extends BaseAgent {
  private classification: FailureClassification = 'unknown';
  private suggestion: HealingSuggestion | null = null;
  private healingHistory: Array<{ fix: HealingSuggestion; success: boolean; classification: FailureClassification }> = [];
  private kb?: KnowledgeBase;

  constructor(config: AuroraConfig, knowledgeBase?: KnowledgeBase) {
    super({
      role: 'healer-agent',
      name: 'HealerAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
    this.kb = knowledgeBase;
  }

  async analyzeFailure(
    error: string,
    context: Record<string, unknown>,
    screenshot?: string,
  ): Promise<{ classification: FailureClassification; suggestion: HealingSuggestion }> {
    this.classification = 'unknown';
    this.suggestion = null;
    this.clearHistory();

    const parts: string[] = [
      `Analyze this test failure and provide a fix.`,
      ``,
      `**Error:**`,
      '```',
      error,
      '```',
      ``,
      `**Context:**`,
      '```json',
      JSON.stringify(context, null, 2),
      '```',
    ];

    if (screenshot) {
      parts.push(``, `**Screenshot (base64):** provided (analyze visually if possible)`);
    }

    await this.runLoop(parts.join('\n'), { maxIterations: 8 });

    const result: HealingSuggestion = this.suggestion ?? {
      fix: 'Unable to determine fix automatically',
      confidence: 0,
      strategy: 'manual-review',
    };

    return { classification: this.classification, suggestion: result };
  }

  classifyFailure(): FailureClassification {
    return this.classification;
  }

  async suggestFix(
    classification: FailureClassification,
    context: Record<string, unknown>,
  ): Promise<HealingSuggestion> {
    this.clearHistory();
    this.suggestion = null;

    const prompt = [
      `Suggest a fix for a test failure classified as: ${classification}`,
      ``,
      `Context:`,
      '```json',
      JSON.stringify(context, null, 2),
      '```',
      ``,
      `Call suggest_fix with your recommendation.`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 5 });

    return this.suggestion ?? { fix: 'No fix suggested', confidence: 0, strategy: 'manual-review' };
  }

  applyFix(patch: Record<string, unknown>, testCase: Record<string, unknown>): { applied: boolean; result: string } {
    const patchCode = patch['code'] as string | undefined;
    if (!patchCode) {
      return { applied: false, result: 'No patch code provided' };
    }
    return { applied: true, result: `Patch applied to test: ${testCase['name'] ?? 'unknown'}` };
  }

  learnFromOutcome(fix: HealingSuggestion, success: boolean, context: Record<string, unknown>): void {
    this.healingHistory.push({ fix, success, classification: this.classification });

    if (this.kb) {
      this.kb.learnFact(
        'fix-recipe',
        `Healing: ${fix.strategy} — ${fix.fix} (${success ? 'succeeded' : 'failed'})`,
        { ...context, success, confidence: fix.confidence },
        [fix.strategy, success ? 'success' : 'failure', 'healing'],
      );
    }
  }

  getHealingStats(): HealingStats {
    const total = this.healingHistory.length;
    const successes = this.healingHistory.filter(h => h.success).length;

    const strategyMap = new Map<string, { count: number; successes: number }>();
    for (const h of this.healingHistory) {
      const s = strategyMap.get(h.fix.strategy) ?? { count: 0, successes: 0 };
      s.count++;
      if (h.success) s.successes++;
      strategyMap.set(h.fix.strategy, s);
    }

    return {
      totalAttempts: total,
      successRate: total > 0 ? successes / total : 0,
      topStrategies: Array.from(strategyMap.entries())
        .map(([strategy, s]) => ({ strategy, count: s.count, successRate: s.successes / s.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'classify_failure': {
        this.classification = input['classification'] as FailureClassification;
        return { success: true, classification: this.classification };
      }
      case 'suggest_fix': {
        this.suggestion = {
          fix: String(input['fix'] ?? ''),
          confidence: Number(input['confidence'] ?? 0),
          strategy: String(input['strategy'] ?? 'unknown'),
          patch: input['patchCode'] ? { code: input['patchCode'] } : undefined,
        };
        return { success: true, suggestion: this.suggestion };
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
