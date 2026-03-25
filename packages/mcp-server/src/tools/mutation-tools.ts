import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import { MutationTestingAgent, loadConfig } from '@aurora-qa/core';

export const RunMutationTestingSchema = z.object({
  sourceCode: z.string().describe('Source code to mutate'),
  testCode: z.string().optional().describe('Existing test code'),
  framework: z.string().optional().describe('Test framework'),
});

export const IdentifyWeakTestsSchema = z.object({
  sourceCode: z.string().describe('Source code that was mutated'),
  filePath: z.string().describe('File path of the source code'),
});

export function createMutationTools(orchestrator: Orchestrator) {
  return {
    run_mutation_testing: {
      description: 'Run mutation testing to measure test quality. Generates code mutations and checks if tests catch them.',
      inputSchema: RunMutationTestingSchema,
      async handler(input: z.infer<typeof RunMutationTestingSchema>) {
        const agent = new MutationTestingAgent(loadConfig());
        const report = await agent.runFullMutationTest(
          input.sourceCode,
          'source.ts',
          input.framework ?? 'vitest',
        );
        return {
          score: report.score,
          killed: report.killed,
          survived: report.survived,
          total: report.total,
          weakSpots: report.weakSpots,
        };
      },
    },

    identify_weak_tests: {
      description: 'Identify areas where tests are weak based on mutation analysis.',
      inputSchema: IdentifyWeakTestsSchema,
      async handler(input: z.infer<typeof IdentifyWeakTestsSchema>) {
        const agent = new MutationTestingAgent(loadConfig());
        const mutants = agent.generateMutants(input.sourceCode, input.filePath);
        const weakSpots = agent.identifyWeakSpots(
          mutants.map(m => ({ ...m, status: 'survived' as const })),
        );
        return {
          totalMutants: mutants.length,
          weakSpots,
          mutantsByType: {
            arithmetic: mutants.filter(m => m.type === 'arithmetic').length,
            boolean: mutants.filter(m => m.type === 'boolean').length,
            boundary: mutants.filter(m => m.type === 'boundary').length,
            'return-value': mutants.filter(m => m.type === 'return-value').length,
          },
        };
      },
    },
  };
}
