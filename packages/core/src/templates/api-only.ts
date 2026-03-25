import type { PipelineConfig } from '../types/index.js';

export function createApiOnlyPipeline(options: {
  sourceCode: string;
  filePath: string;
  language?: string;
}): PipelineConfig {
  return {
    id: `api-only-${Date.now()}`,
    name: 'API Only Pipeline',
    description: 'API pipeline: generate → test → contract → security → coverage',
    steps: [
      {
        id: 'generate',
        type: 'generate-tests',
        name: 'Generate API Tests',
        config: { sourceCode: options.sourceCode, filePath: options.filePath, framework: 'vitest', focusAreas: ['api', 'endpoints', 'validation'] },
      },
      {
        id: 'run-tests',
        type: 'run-tests',
        name: 'Run Tests',
        config: { command: 'pnpm test' },
        dependsOn: ['generate'],
      },
      {
        id: 'bugs',
        type: 'analyze-bugs',
        name: 'Security & Bug Analysis',
        config: { code: options.sourceCode, filePath: options.filePath, language: options.language },
        dependsOn: ['run-tests'],
        continueOnError: true,
      },
      {
        id: 'coverage',
        type: 'check-coverage',
        name: 'Coverage Analysis',
        config: { thresholds: { statements: 85, branches: 75, functions: 85, lines: 85 } },
        dependsOn: ['run-tests'],
      },
    ],
    triggers: [{ type: 'manual' }],
    environment: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
