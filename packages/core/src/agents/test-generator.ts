import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type {
  AuroraConfig,
  GenerateTestsInput,
  GenerateTestsOutput,
  TestCase,
  TestFramework,
} from '../types/index.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_test_case',
    description:
      'Create a single test case with a name, description, and the full test code. Call this for each logical test scenario.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Short descriptive test name' },
        description: { type: 'string', description: 'What this test verifies' },
        code: { type: 'string', description: 'Complete test code for this case' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags like unit, integration, edge-case, happy-path, error-handling',
        },
        coverageTarget: {
          type: 'string',
          description: 'The function/method/branch this test exercises',
        },
      },
      required: ['name', 'description', 'code'],
    },
  },
  {
    name: 'finalize_test_suite',
    description:
      'Finalize the test suite with the complete, runnable test file code and metadata.',
    input_schema: {
      type: 'object' as const,
      properties: {
        testCode: {
          type: 'string',
          description: 'Complete, runnable test file that imports and runs all generated tests',
        },
        framework: {
          type: 'string',
          enum: ['jest', 'vitest', 'mocha', 'jasmine', 'node:test'],
          description: 'Test framework used',
        },
        coverageTargets: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of functions/branches/paths targeted for coverage',
        },
        notes: { type: 'string', description: 'Any important notes about the test suite' },
      },
      required: ['testCode', 'framework', 'coverageTargets'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Test Generation Agent — an expert in writing comprehensive, production-quality automated tests.

Your mission is to analyze source code and generate thorough test suites that:
1. Cover happy paths, edge cases, error conditions, and boundary values
2. Test each public function/method individually
3. Include integration tests where appropriate
4. Are readable, maintainable, and follow best practices
5. Use idiomatic patterns for the target test framework

Process:
1. First, call \`create_test_case\` for each individual test scenario you identify
2. Then call \`finalize_test_suite\` once with the complete, assembled test file

Guidelines:
- Generate at least 3 tests per public function
- Always test null/undefined/empty inputs
- Test async code properly (async/await, promises)
- Mock external dependencies
- Use descriptive test names that explain the expected behavior
- Group related tests with describe blocks
- Prefer \`vitest\` unless another framework is specified`;

export class TestGeneratorAgent extends BaseAgent {
  private generatedTests: TestCase[] = [];
  private finalOutput: Partial<GenerateTestsOutput> = {};

  constructor(config: AuroraConfig) {
    super({
      role: 'test-generator',
      name: 'TestGeneratorAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
  }

  async generateTests(input: GenerateTestsInput): Promise<GenerateTestsOutput> {
    this.generatedTests = [];
    this.finalOutput = {};
    this.clearHistory();

    const prompt = this.buildPrompt(input);
    await this.runLoop(prompt, { maxIterations: 20 });

    const tests = this.generatedTests;
    const testCode = this.finalOutput.testCode ?? this.assembleTestCode(tests, input);
    const framework = this.finalOutput.framework ?? (input.framework ?? 'vitest');
    const coverage_targets = this.finalOutput.coverage_targets ?? [];

    return { tests, testCode, framework, coverage_targets };
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'create_test_case': {
        const test: TestCase = {
          id: crypto.randomUUID(),
          name: String(input['name'] ?? ''),
          description: String(input['description'] ?? ''),
          code: String(input['code'] ?? ''),
          filePath: '',
          framework: 'vitest',
          status: 'pending',
          tags: Array.isArray(input['tags']) ? (input['tags'] as string[]) : [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.generatedTests.push(test);
        this.logger.debug(`Created test case: ${test.name}`);
        return { success: true, testId: test.id, message: `Test case "${test.name}" recorded` };
      }

      case 'finalize_test_suite': {
        this.finalOutput = {
          testCode: String(input['testCode'] ?? ''),
          framework: String(input['framework'] ?? 'vitest') as TestFramework,
          coverage_targets: Array.isArray(input['coverageTargets'])
            ? (input['coverageTargets'] as string[])
            : [],
        };
        return {
          success: true,
          message: `Test suite finalized with ${this.generatedTests.length} test cases`,
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private buildPrompt(input: GenerateTestsInput): string {
    const parts: string[] = [
      `Generate comprehensive tests for the following source code.`,
      ``,
      `**File:** \`${input.filePath}\``,
      `**Framework:** ${input.framework ?? 'vitest (preferred)'}`,
    ];

    if (input.maxTests) {
      parts.push(`**Max tests:** ${input.maxTests}`);
    }

    if (input.focusAreas && input.focusAreas.length > 0) {
      parts.push(`**Focus areas:** ${input.focusAreas.join(', ')}`);
    }

    parts.push(``, `**Source code:**`, '```', input.sourceCode, '```');

    if (input.existingTests) {
      parts.push(
        ``,
        `**Existing tests (avoid duplication):**`,
        '```',
        input.existingTests,
        '```',
      );
    }

    parts.push(
      ``,
      `Begin by calling \`create_test_case\` for each test scenario, then call \`finalize_test_suite\` with the complete test file.`,
    );

    return parts.join('\n');
  }

  private assembleTestCode(tests: TestCase[], input: GenerateTestsInput): string {
    if (tests.length === 0) return '';
    const framework = input.framework ?? 'vitest';
    const header =
      framework === 'vitest'
        ? `import { describe, it, expect, vi } from 'vitest';\n`
        : `import { describe, it, expect, jest } from '@jest/globals';\n`;

    return [
      header,
      `// Generated by Aurora QA — ${new Date().toISOString()}`,
      `// Source: ${input.filePath}`,
      ``,
      ...tests.map(t => t.code),
    ].join('\n');
  }
}
