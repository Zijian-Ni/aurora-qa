import type { PipelineConfig } from '../types/index.js';

export function createQuickCheckPipeline(options: {
  sourceCode: string;
  filePath: string;
}): PipelineConfig {
  return {
    id: `quick-check-${Date.now()}`,
    name: 'Quick Check Pipeline',
    description: 'Fast pipeline: lint → test (priority tests only) → review',
    steps: [
      {
        id: 'run-tests',
        type: 'run-tests',
        name: 'Run Priority Tests',
        config: { command: 'pnpm test --bail', timeout: 60000 },
        timeoutMs: 60000,
      },
      {
        id: 'review',
        type: 'review-code',
        name: 'Quick Review',
        config: { code: options.sourceCode, filePath: options.filePath, strictness: 'lenient' },
        dependsOn: ['run-tests'],
        continueOnError: true,
      },
    ],
    triggers: [{ type: 'manual' }],
    environment: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
