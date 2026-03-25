import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type {
  AuroraConfig,
  AnalyzeCoverageInput,
  AnalyzeCoverageOutput,
  CoverageReport,
  CoverageGap,
  CoverageThresholds,
  FileCoverage,
  OverallCoverage,
} from '../types/index.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'record_file_coverage',
    description: 'Record coverage metrics for a specific file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string' },
        statements: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            covered: { type: 'number' },
            percentage: { type: 'number' },
            uncoveredItems: { type: 'array', items: { type: 'number' } },
          },
          required: ['total', 'covered', 'percentage'],
        },
        branches: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            covered: { type: 'number' },
            percentage: { type: 'number' },
            uncoveredItems: { type: 'array', items: { type: 'number' } },
          },
          required: ['total', 'covered', 'percentage'],
        },
        functions: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            covered: { type: 'number' },
            percentage: { type: 'number' },
            uncoveredItems: { type: 'array', items: { type: 'number' } },
          },
          required: ['total', 'covered', 'percentage'],
        },
        lines: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            covered: { type: 'number' },
            percentage: { type: 'number' },
            uncoveredItems: { type: 'array', items: { type: 'number' } },
          },
          required: ['total', 'covered', 'percentage'],
        },
      },
      required: ['filePath', 'statements', 'branches', 'functions', 'lines'],
    },
  },
  {
    name: 'report_coverage_gap',
    description: 'Report a specific coverage gap that needs attention.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string' },
        metric: {
          type: 'string',
          enum: ['statements', 'branches', 'functions', 'lines'],
        },
        current: { type: 'number', description: 'Current coverage percentage' },
        target: { type: 'number', description: 'Target coverage percentage' },
        uncoveredItems: {
          type: 'array',
          items: { type: 'string' },
          description: 'Uncovered function names, branch descriptions, or line numbers',
        },
      },
      required: ['filePath', 'metric', 'current', 'target', 'uncoveredItems'],
    },
  },
  {
    name: 'finalize_coverage_report',
    description: 'Submit the final coverage analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        overall: {
          type: 'object',
          properties: {
            statements: { type: 'number' },
            branches: { type: 'number' },
            functions: { type: 'number' },
            lines: { type: 'number' },
          },
          required: ['statements', 'branches', 'functions', 'lines'],
        },
        meetsThresholds: { type: 'boolean' },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Actionable suggestions to improve coverage',
        },
        prioritizedFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files to focus on first, ordered by priority',
        },
      },
      required: ['overall', 'meetsThresholds', 'suggestions', 'prioritizedFiles'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Coverage Analysis Agent — an expert in test coverage analysis and improvement strategies.

Your role is to:
1. Parse coverage reports (JSON, text, or summary formats)
2. Identify meaningful coverage gaps (not just low numbers, but critical uncovered paths)
3. Prioritize which files/functions need tests most urgently
4. Provide actionable, specific suggestions for improving coverage

Process:
1. Call \`record_file_coverage\` for each file in the coverage data
2. Call \`report_coverage_gap\` for each significant gap found
3. Call \`finalize_coverage_report\` with the overall analysis

Focus on:
- Critical business logic with low coverage
- Error handling paths (often undertested)
- Edge cases and boundary conditions
- Recently changed files (regressions)

Default thresholds if not specified: statements 80%, branches 75%, functions 85%, lines 80%.`;

export class CoverageAgent extends BaseAgent {
  private fileCoverages: FileCoverage[] = [];
  private coverageGaps: CoverageGap[] = [];
  private _finalOverall: OverallCoverage | null = null;
  private _meetsThresholds: boolean | null = null;
  private _suggestions: string[] | null = null;
  private _prioritizedFiles: string[] | null = null;

  constructor(config: AuroraConfig) {
    super({
      role: 'coverage-agent',
      name: 'CoverageAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  async analyzeCoverage(input: AnalyzeCoverageInput): Promise<AnalyzeCoverageOutput> {
    this.fileCoverages = [];
    this.coverageGaps = [];
    this._finalOverall = null;
    this._meetsThresholds = null;
    this._suggestions = null;
    this._prioritizedFiles = null;
    this.clearHistory();

    const thresholds: CoverageThresholds = {
      statements: input.thresholds?.statements ?? 80,
      branches: input.thresholds?.branches ?? 75,
      functions: input.thresholds?.functions ?? 85,
      lines: input.thresholds?.lines ?? 80,
    };

    const prompt = this.buildPrompt(input, thresholds);
    await this.runLoop(prompt, { maxIterations: 30 });

    const overall: OverallCoverage = this._finalOverall ?? this.computeOverall();

    const report: CoverageReport = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      overall,
      files: this.fileCoverages,
      thresholds,
      meetsThresholds: this._meetsThresholds ?? this.checkThresholds(overall, thresholds),
    };

    return {
      report,
      gaps: this.coverageGaps,
      suggestions: this._suggestions ?? [],
      prioritizedFiles: this._prioritizedFiles ?? [],
    };
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'record_file_coverage': {
        const parseCoverageMetric = (raw: unknown) => {
          const m = raw as Record<string, unknown>;
          return {
            total: Number(m['total'] ?? 0),
            covered: Number(m['covered'] ?? 0),
            percentage: Number(m['percentage'] ?? 0),
            uncoveredItems: Array.isArray(m['uncoveredItems'])
              ? (m['uncoveredItems'] as number[])
              : [],
          };
        };

        const fc: FileCoverage = {
          filePath: String(input['filePath'] ?? ''),
          statements: parseCoverageMetric(input['statements']),
          branches: parseCoverageMetric(input['branches']),
          functions: parseCoverageMetric(input['functions']),
          lines: parseCoverageMetric(input['lines']),
        };
        this.fileCoverages.push(fc);
        return { success: true };
      }

      case 'report_coverage_gap': {
        const gap: CoverageGap = {
          filePath: String(input['filePath'] ?? ''),
          metric: (input['metric'] as keyof OverallCoverage) ?? 'statements',
          current: Number(input['current'] ?? 0),
          target: Number(input['target'] ?? 80),
          uncoveredItems: Array.isArray(input['uncoveredItems'])
            ? (input['uncoveredItems'] as string[])
            : [],
        };
        this.coverageGaps.push(gap);
        return { success: true };
      }

      case 'finalize_coverage_report': {
        const overall = input['overall'] as Record<string, unknown>;
        this._finalOverall = {
          statements: Number(overall['statements'] ?? 0),
          branches: Number(overall['branches'] ?? 0),
          functions: Number(overall['functions'] ?? 0),
          lines: Number(overall['lines'] ?? 0),
        };
        this._meetsThresholds = Boolean(input['meetsThresholds']);
        this._suggestions = Array.isArray(input['suggestions']) ? (input['suggestions'] as string[]) : [];
        this._prioritizedFiles = Array.isArray(input['prioritizedFiles'])
          ? (input['prioritizedFiles'] as string[])
          : [];
        return { success: true };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private buildPrompt(input: AnalyzeCoverageInput, thresholds: CoverageThresholds): string {
    const parts = [
      `Analyze the following coverage data and identify gaps.`,
      ``,
      `**Thresholds:** statements=${thresholds.statements}%, branches=${thresholds.branches}%, ` +
        `functions=${thresholds.functions}%, lines=${thresholds.lines}%`,
    ];

    if (input.coverageJson) {
      parts.push(``, `**Coverage JSON:**`, '```json', input.coverageJson.slice(0, 10000), '```');
    }

    if (input.coverageSummary) {
      parts.push(``, `**Coverage summary:**`, '```', input.coverageSummary, '```');
    }

    if (input.sourceFiles && input.sourceFiles.length > 0) {
      parts.push(
        ``,
        `**Source files to analyze:**`,
        ...input.sourceFiles.map(f => `- \`${f.path}\``),
      );
    }

    return parts.join('\n');
  }

  private computeOverall(): OverallCoverage {
    if (this.fileCoverages.length === 0) {
      return { statements: 0, branches: 0, functions: 0, lines: 0 };
    }
    const avg = (key: keyof FileCoverage) => {
      const values = this.fileCoverages.map(f => {
        const m = f[key] as { percentage: number };
        return m.percentage;
      });
      return values.reduce((a, b) => a + b, 0) / values.length;
    };
    return {
      statements: avg('statements'),
      branches: avg('branches'),
      functions: avg('functions'),
      lines: avg('lines'),
    };
  }

  private checkThresholds(overall: OverallCoverage, thresholds: CoverageThresholds): boolean {
    return (
      overall.statements >= thresholds.statements &&
      overall.branches >= thresholds.branches &&
      overall.functions >= thresholds.functions &&
      overall.lines >= thresholds.lines
    );
  }
}
