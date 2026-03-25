import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type {
  AuroraConfig,
  AnalyzeBugsInput,
  AnalyzeBugsOutput,
  BugReport,
  BugSeverity,
  BugCategory,
} from '../types/index.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'report_bug',
    description:
      'Report a specific bug found in the code. Call this once per distinct issue.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Concise bug title' },
        description: {
          type: 'string',
          description: 'Detailed description of the bug and why it is a problem',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description:
            'critical=data loss/security breach, high=major functionality broken, medium=partial failure, low=minor issue, info=style/convention',
        },
        category: {
          type: 'string',
          enum: [
            'null-pointer',
            'race-condition',
            'memory-leak',
            'security',
            'logic-error',
            'type-error',
            'performance',
            'edge-case',
            'other',
          ],
        },
        lineStart: { type: 'number', description: 'Starting line number (1-indexed)' },
        lineEnd: { type: 'number', description: 'Ending line number' },
        codeSnippet: { type: 'string', description: 'The problematic code snippet' },
        reproducibleSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Steps to reproduce the bug',
        },
        suggestedFix: { type: 'string', description: 'Plain English description of the fix' },
        fixCode: {
          type: 'string',
          description: 'Corrected code to replace the buggy snippet',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence this is actually a bug (0–1)',
        },
      },
      required: ['title', 'description', 'severity', 'category', 'confidence'],
    },
  },
  {
    name: 'finalize_analysis',
    description:
      'Submit the final analysis summary after all bugs have been reported.',
    input_schema: {
      type: 'object' as const,
      properties: {
        riskScore: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description: 'Overall risk score 0-10 (0=no risk, 10=critical)',
        },
        summary: { type: 'string', description: 'Executive summary of the analysis' },
        recommendations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Top 3-5 actionable recommendations',
        },
      },
      required: ['riskScore', 'summary', 'recommendations'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Bug Analysis Agent — a security-minded senior engineer specializing in static analysis and runtime bug detection.

Your mission is to deeply analyze code for:
- Null pointer / undefined dereferences
- Race conditions and concurrency issues
- Memory leaks and resource mismanagement
- Security vulnerabilities (injection, XSS, auth bypass, insecure defaults)
- Logic errors and off-by-one errors
- Improper error handling
- Type errors and unsafe casts
- Performance bottlenecks
- Edge cases that cause incorrect behavior

Process:
1. Carefully read through the entire code
2. For each bug found, call \`report_bug\` with full details including a fix
3. After reporting all bugs, call \`finalize_analysis\` with the overall risk score and recommendations

Be thorough but accurate. Avoid false positives — only report genuine bugs.
Assign severity honestly: critical for security/data issues, high for correctness, etc.`;

export class BugAnalyzerAgent extends BaseAgent {
  private foundBugs: BugReport[] = [];
  // Stored as separate primitives to avoid TypeScript 5.x class-field narrowing to `null`
  private _riskScore: number | null = null;
  private _summary: string | null = null;
  private _recommendations: string[] | null = null;

  constructor(config: AuroraConfig) {
    super({
      role: 'bug-analyzer',
      name: 'BugAnalyzerAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  async analyzeBugs(input: AnalyzeBugsInput): Promise<AnalyzeBugsOutput> {
    this.foundBugs = [];
    this._riskScore = null;
    this._summary = null;
    this._recommendations = null;
    this.clearHistory();

    const prompt = this.buildPrompt(input);
    await this.runLoop(prompt, { maxIterations: 25 });

    const bugs = this.foundBugs;
    const riskScore = this._riskScore ?? this.inferRiskScore(bugs);
    const summary =
      this._summary ?? `Found ${bugs.length} issue(s). Risk score: ${riskScore.toFixed(1)}/10.`;
    const recommendations = this._recommendations ?? [];

    return { bugs, riskScore, summary, recommendations };
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'report_bug': {
        const bug: BugReport = {
          id: crypto.randomUUID(),
          title: String(input['title'] ?? ''),
          description: String(input['description'] ?? ''),
          severity: (input['severity'] as BugSeverity) ?? 'medium',
          category: (input['category'] as BugCategory) ?? 'other',
          status: 'open',
          lineStart:
            typeof input['lineStart'] === 'number' ? input['lineStart'] : undefined,
          lineEnd: typeof input['lineEnd'] === 'number' ? input['lineEnd'] : undefined,
          codeSnippet: input['codeSnippet'] ? String(input['codeSnippet']) : undefined,
          reproducibleSteps: Array.isArray(input['reproducibleSteps'])
            ? (input['reproducibleSteps'] as string[])
            : undefined,
          suggestedFix: input['suggestedFix'] ? String(input['suggestedFix']) : undefined,
          fixCode: input['fixCode'] ? String(input['fixCode']) : undefined,
          confidence: typeof input['confidence'] === 'number' ? input['confidence'] : 0.8,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.foundBugs.push(bug);
        this.logger.debug(`Bug reported: ${bug.title}`, { severity: bug.severity });
        return { success: true, bugId: bug.id };
      }

      case 'finalize_analysis': {
        this._riskScore = typeof input['riskScore'] === 'number' ? input['riskScore'] : 5;
        this._summary = String(input['summary'] ?? '');
        this._recommendations = Array.isArray(input['recommendations'])
          ? (input['recommendations'] as string[])
          : [];
        return { success: true, bugsAnalyzed: this.foundBugs.length };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private buildPrompt(input: AnalyzeBugsInput): string {
    const parts = [
      `Analyze the following code for bugs and security issues.`,
      ``,
      `**File:** \`${input.filePath}\``,
    ];

    if (input.language) parts.push(`**Language:** ${input.language}`);
    if (input.context) parts.push(`**Context:** ${input.context}`);

    parts.push(``, `**Code:**`, '```', input.code, '```');

    if (input.errorMessage) {
      parts.push(``, `**Error message:**`, '```', input.errorMessage, '```');
    }

    if (input.testOutput) {
      parts.push(``, `**Failing test output:**`, '```', input.testOutput, '```');
    }

    parts.push(
      ``,
      `Call \`report_bug\` for each issue, then \`finalize_analysis\` with the overall assessment.`,
    );

    return parts.join('\n');
  }

  private inferRiskScore(bugs: BugReport[]): number {
    if (bugs.length === 0) return 0;
    const weights: Record<BugSeverity, number> = {
      critical: 4,
      high: 2.5,
      medium: 1.5,
      low: 0.5,
      info: 0.1,
    };
    const raw = bugs.reduce((acc, b) => acc + (weights[b.severity] ?? 1), 0);
    return Math.min(10, raw);
  }
}
