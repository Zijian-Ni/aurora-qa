import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type {
  AuroraConfig,
  ReviewCodeInput,
  ReviewCodeOutput,
  CodeReview,
  ReviewIssue,
  IssueSeverity,
  IssueCategory,
} from '../types/index.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_review_issue',
    description:
      'Add a specific code review issue. Call once per distinct problem found.',
    input_schema: {
      type: 'object' as const,
      properties: {
        severity: {
          type: 'string',
          enum: ['error', 'warning', 'suggestion', 'info'],
          description:
            'error=must fix before merge, warning=should fix, suggestion=nice to have, info=FYI',
        },
        category: {
          type: 'string',
          enum: [
            'correctness',
            'security',
            'performance',
            'maintainability',
            'style',
            'testability',
            'documentation',
          ],
        },
        message: { type: 'string', description: 'Clear description of the issue' },
        lineStart: { type: 'number' },
        lineEnd: { type: 'number' },
        codeSnippet: { type: 'string', description: 'The problematic code' },
        suggestion: { type: 'string', description: 'How to fix it in plain English' },
        fixCode: { type: 'string', description: 'Suggested fixed code' },
        rule: { type: 'string', description: 'Applicable rule or best practice (e.g. no-unused-vars)' },
      },
      required: ['severity', 'category', 'message'],
    },
  },
  {
    name: 'finalize_review',
    description: 'Submit the complete code review with score and summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        score: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Overall code quality score 0-100',
        },
        grade: {
          type: 'string',
          enum: ['A', 'B', 'C', 'D', 'F'],
          description: 'Letter grade based on score: A=90+, B=80+, C=70+, D=60+, F=<60',
        },
        summary: { type: 'string', description: 'Overall review summary (2-4 sentences)' },
        strengths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Things the code does well',
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'High-level improvement suggestions not captured in issues',
        },
      },
      required: ['score', 'grade', 'summary', 'strengths', 'suggestions'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Code Review Agent — a senior engineer who provides thorough, constructive code reviews.

Your review covers:
- **Correctness**: Logic errors, off-by-ones, incorrect assumptions
- **Security**: Injection, auth issues, insecure defaults, sensitive data exposure
- **Performance**: Unnecessary allocations, N+1 queries, blocking operations
- **Maintainability**: Complexity, naming, DRY violations, SOLID principles
- **Style**: Consistency, readability, idiomatic patterns
- **Testability**: Coupling, dependency injection, side effects
- **Documentation**: Missing or misleading docs/comments

Process:
1. Call \`add_review_issue\` for each distinct problem — be specific and actionable
2. Call \`finalize_review\` with the overall assessment including strengths

Tone: Be constructive and educational. Explain *why* something is a problem and *how* to fix it.
Be honest but not harsh. Highlight strengths alongside issues.`;

export class ReviewAgent extends BaseAgent {
  private issues: ReviewIssue[] = [];
  private _score: number | null = null;
  private _grade: string | null = null;
  private _summary: string | null = null;
  private _strengths: string[] | null = null;
  private _suggestions: string[] | null = null;

  constructor(config: AuroraConfig) {
    super({
      role: 'review-agent',
      name: 'ReviewAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  async reviewCode(input: ReviewCodeInput): Promise<ReviewCodeOutput> {
    this.issues = [];
    this._score = null;
    this._grade = null;
    this._summary = null;
    this._strengths = null;
    this._suggestions = null;
    this.clearHistory();

    const prompt = this.buildPrompt(input);
    await this.runLoop(prompt, { maxIterations: 20 });

    const language = input.language ?? this.inferLanguage(input.filePath);
    const score = this._score ?? this.inferScore();
    const grade = (this._grade as CodeReview['grade'] | null) ?? this.scoreToGrade(score);

    const review: CodeReview = {
      id: crypto.randomUUID(),
      filePath: input.filePath,
      language,
      issues: this.issues,
      suggestions: this._suggestions ?? [],
      strengths: this._strengths ?? [],
      score,
      grade,
      summary:
        this._summary ??
        `Review complete. Found ${this.issues.length} issue(s). Score: ${score}/100.`,
      timestamp: new Date(),
    };

    const criticalIssues = this.issues.filter(i => i.severity === 'error');
    const quickWins = this.issues
      .filter(i => i.severity === 'suggestion' && i.fixCode)
      .slice(0, 5);

    return { review, criticalIssues, quickWins };
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'add_review_issue': {
        const issue: ReviewIssue = {
          id: crypto.randomUUID(),
          severity: (input['severity'] as IssueSeverity) ?? 'warning',
          category: (input['category'] as IssueCategory) ?? 'maintainability',
          message: String(input['message'] ?? ''),
          lineStart:
            typeof input['lineStart'] === 'number' ? input['lineStart'] : undefined,
          lineEnd: typeof input['lineEnd'] === 'number' ? input['lineEnd'] : undefined,
          codeSnippet: input['codeSnippet'] ? String(input['codeSnippet']) : undefined,
          suggestion: input['suggestion'] ? String(input['suggestion']) : undefined,
          fixCode: input['fixCode'] ? String(input['fixCode']) : undefined,
          rule: input['rule'] ? String(input['rule']) : undefined,
        };
        this.issues.push(issue);
        return { success: true, issueId: issue.id };
      }

      case 'finalize_review': {
        this._score = typeof input['score'] === 'number' ? input['score'] : 75;
        this._grade = String(input['grade'] ?? 'C');
        this._summary = String(input['summary'] ?? '');
        this._strengths = Array.isArray(input['strengths']) ? (input['strengths'] as string[]) : [];
        this._suggestions = Array.isArray(input['suggestions']) ? (input['suggestions'] as string[]) : [];
        return { success: true, issuesReviewed: this.issues.length };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private buildPrompt(input: ReviewCodeInput): string {
    const parts = [
      `Review the following code thoroughly.`,
      ``,
      `**File:** \`${input.filePath}\``,
    ];

    if (input.language) parts.push(`**Language:** ${input.language}`);

    if (input.strictness) parts.push(`**Strictness:** ${input.strictness}`);

    if (input.focusAreas && input.focusAreas.length > 0) {
      parts.push(`**Focus areas:** ${input.focusAreas.join(', ')}`);
    }

    if (input.context) parts.push(`**Context:** ${input.context}`);

    parts.push(``, `**Code:**`, '```', input.code, '```');

    return parts.join('\n');
  }

  private inferLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript/React',
      js: 'JavaScript',
      jsx: 'JavaScript/React',
      py: 'Python',
      go: 'Go',
      rs: 'Rust',
      java: 'Java',
      cs: 'C#',
      cpp: 'C++',
      rb: 'Ruby',
    };
    return map[ext] ?? 'Unknown';
  }

  private inferScore(): number {
    const errorCount = this.issues.filter(i => i.severity === 'error').length;
    const warningCount = this.issues.filter(i => i.severity === 'warning').length;
    const score = Math.max(0, 100 - errorCount * 15 - warningCount * 5);
    return Math.round(score);
  }

  private scoreToGrade(score: number): CodeReview['grade'] {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}
