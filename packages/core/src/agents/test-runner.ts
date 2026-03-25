import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseAgent } from './base-agent.js';
import type {
  AuroraConfig,
  RunTestsInput,
  RunTestsOutput,
  TestResult,
  TestSummary,
  TestStatus,
} from '../types/index.js';
import type Anthropic from '@anthropic-ai/sdk';

const execFileAsync = promisify(execFile);

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'parse_test_output',
    description:
      'Parse raw test runner output and extract structured results for each test case.',
    input_schema: {
      type: 'object' as const,
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: {
                type: 'string',
                enum: ['passing', 'failing', 'skipped', 'error'],
              },
              durationMs: { type: 'number' },
              error: { type: 'string' },
              errorStack: { type: 'string' },
            },
            required: ['name', 'status'],
          },
          description: 'Extracted test results',
        },
        summary: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            passing: { type: 'number' },
            failing: { type: 'number' },
            skipped: { type: 'number' },
          },
          required: ['total', 'passing', 'failing', 'skipped'],
        },
      },
      required: ['results', 'summary'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Test Runner Agent — an expert at interpreting test execution output.

Your task is to analyze raw output from test runners (Jest, Vitest, Mocha, etc.) and extract structured results.
Call parse_test_output with the structured data extracted from the raw output.

Be precise about:
- Which tests passed vs failed
- Exact error messages for failing tests
- Test durations when available
- Distinguishing errors (runtime crashes) from failures (assertion failures)`;

interface ParsedResult {
  name: string;
  status: TestStatus;
  durationMs?: number;
  error?: string;
  errorStack?: string;
}

export class TestRunnerAgent extends BaseAgent {
  private parsedResults: ParsedResult[] = [];
  private parsedSummary: Partial<TestSummary> = {};

  constructor(config: AuroraConfig) {
    super({
      role: 'test-runner',
      name: 'TestRunnerAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  async runTests(input: RunTestsInput): Promise<RunTestsOutput> {
    this.parsedResults = [];
    this.parsedSummary = {};
    const startTime = performance.now();

    // Step 1: Execute tests
    const { stdout, stderr, exitCode } = await this.execute(input);
    const rawOutput = stdout + (stderr ? `\n--- stderr ---\n${stderr}` : '');
    const durationMs = performance.now() - startTime;

    this.logger.info(`Test execution complete`, {
      exitCode,
      durationMs: durationMs.toFixed(0),
    });

    // Step 2: Parse output with AI
    this.clearHistory();
    const parsePrompt = [
      `Parse the following test runner output and call \`parse_test_output\` with structured results.`,
      ``,
      `**Exit code:** ${exitCode}`,
      `**Raw output:**`,
      '```',
      rawOutput.slice(0, 8000), // cap to avoid token overflow
      '```',
    ].join('\n');

    await this.runLoop(parsePrompt, { maxIterations: 5 });

    const runId = crypto.randomUUID();
    const results: TestResult[] = this.parsedResults.map(r => ({
      id: crypto.randomUUID(),
      testCaseId: '',
      runId,
      status: r.status,
      durationMs: r.durationMs ?? 0,
      error: r.error,
      errorStack: r.errorStack,
      output: rawOutput,
      timestamp: new Date(),
    }));

    const summary = this.buildSummary(results);

    return { results, summary, rawOutput, durationMs };
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    if (toolName !== 'parse_test_output') {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const rawResults = Array.isArray(input['results']) ? input['results'] : [];
    const rawSummary =
      typeof input['summary'] === 'object' && input['summary'] !== null
        ? (input['summary'] as Record<string, unknown>)
        : {};

    this.parsedResults = rawResults.map((r: unknown) => {
      const result = r as Record<string, unknown>;
      return {
        name: String(result['name'] ?? ''),
        status: (result['status'] as TestStatus) ?? 'error',
        durationMs: typeof result['durationMs'] === 'number' ? result['durationMs'] : undefined,
        error: result['error'] ? String(result['error']) : undefined,
        errorStack: result['errorStack'] ? String(result['errorStack']) : undefined,
      };
    });

    this.parsedSummary = {
      total: Number(rawSummary['total'] ?? this.parsedResults.length),
      passing: Number(rawSummary['passing'] ?? 0),
      failing: Number(rawSummary['failing'] ?? 0),
      skipped: Number(rawSummary['skipped'] ?? 0),
      errors: 0,
      passRate: 0,
    };

    return { success: true, parsed: this.parsedResults.length };
  }

  private async execute(
    input: RunTestsInput,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const timeoutMs = input.timeout ?? 120_000;
    const [cmd, ...args] = input.command.split(' ');

    if (!cmd) throw new Error('Empty test command');

    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        cwd: input.cwd ?? process.cwd(),
        env: { ...process.env, ...input.env },
        timeout: timeoutMs,
        maxBuffer: 50 * 1024 * 1024, // 50MB
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: unknown) {
      const execErr = err as {
        stdout?: string;
        stderr?: string;
        code?: number | string;
        message?: string;
      };
      return {
        stdout: execErr.stdout ?? '',
        stderr: execErr.stderr ?? execErr.message ?? String(err),
        exitCode: typeof execErr.code === 'number' ? execErr.code : 1,
      };
    }
  }

  private buildSummary(results: TestResult[]): TestSummary {
    const total = results.length;
    const passing = results.filter(r => r.status === 'passing').length;
    const failing = results.filter(r => r.status === 'failing').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    return {
      total,
      passing,
      failing,
      skipped,
      errors,
      passRate: total > 0 ? (passing / total) * 100 : 0,
    };
  }
}
