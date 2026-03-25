import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';

export const GenerateTestsSchema = z.object({
  sourceCode: z.string().describe('Source code to generate tests for'),
  filePath: z.string().describe('Path of the source file'),
  framework: z
    .enum(['jest', 'vitest', 'mocha', 'jasmine', 'node:test'])
    .optional()
    .describe('Test framework to use (default: vitest)'),
  maxTests: z.number().int().positive().optional().describe('Maximum number of tests to generate'),
  focusAreas: z
    .array(z.string())
    .optional()
    .describe('Specific areas or functions to focus on'),
  existingTests: z.string().optional().describe('Existing test code to avoid duplicating'),
});

export const RunTestsSchema = z.object({
  command: z.string().describe('Test command to run (e.g. "pnpm test", "npx vitest run")'),
  cwd: z.string().optional().describe('Working directory for the command'),
  timeout: z.number().int().positive().optional().describe('Timeout in milliseconds (default: 120000)'),
});

export function createTestTools(orchestrator: Orchestrator) {
  return {
    generate_tests: {
      description:
        'Generate comprehensive test cases for a given source file using AI. ' +
        'Produces a complete, runnable test suite covering happy paths, edge cases, and error conditions.',
      inputSchema: GenerateTestsSchema,
      async handler(input: z.infer<typeof GenerateTestsSchema>) {
        const output = await orchestrator.generateTests({
          sourceCode: input.sourceCode,
          filePath: input.filePath,
          framework: input.framework,
          maxTests: input.maxTests,
          focusAreas: input.focusAreas,
          existingTests: input.existingTests,
        });

        return {
          framework: output.framework,
          testCount: output.tests.length,
          coverageTargets: output.coverage_targets,
          testCode: output.testCode,
          tests: output.tests.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            tags: t.tags,
          })),
        };
      },
    },

    run_tests: {
      description:
        'Execute a test suite and return structured results parsed by AI. ' +
        'Supports Jest, Vitest, Mocha, and other Node.js test runners.',
      inputSchema: RunTestsSchema,
      async handler(input: z.infer<typeof RunTestsSchema>) {
        const output = await orchestrator.runTests({
          command: input.command,
          cwd: input.cwd,
          timeout: input.timeout,
        });

        return {
          summary: output.summary,
          durationMs: output.durationMs,
          results: output.results.map(r => ({
            status: r.status,
            durationMs: r.durationMs,
            error: r.error,
          })),
          rawOutput: output.rawOutput.slice(0, 3000),
        };
      },
    },
  };
}
