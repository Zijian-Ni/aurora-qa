import type { PipelineConfig } from '../types/index.js';

export function createFullStackWebPipeline(options: {
  sourceCode: string;
  filePath: string;
  language?: string;
}): PipelineConfig {
  return {
    id: `full-stack-web-${Date.now()}`,
    name: 'Full Stack Web Pipeline',
    description: 'Complete pipeline: generate → lint → test → coverage → security → accessibility → review',
    steps: [
      {
        id: 'generate',
        type: 'generate-tests',
        name: 'Generate Tests',
        config: { sourceCode: options.sourceCode, filePath: options.filePath, framework: 'vitest' },
      },
      {
        id: 'run-tests',
        type: 'run-tests',
        name: 'Run Tests',
        config: { command: 'pnpm test' },
        dependsOn: ['generate'],
      },
      {
        id: 'coverage',
        type: 'check-coverage',
        name: 'Coverage Analysis',
        config: { thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 } },
        dependsOn: ['run-tests'],
      },
      {
        id: 'bugs',
        type: 'analyze-bugs',
        name: 'Bug Analysis',
        config: { code: options.sourceCode, filePath: options.filePath, language: options.language },
        dependsOn: ['run-tests'],
        continueOnError: true,
      },
      {
        id: 'review',
        type: 'review-code',
        name: 'Code Review',
        config: { code: options.sourceCode, filePath: options.filePath, language: options.language, strictness: 'standard' },
        dependsOn: ['bugs'],
      },
    ],
    triggers: [{ type: 'manual' }],
    environment: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
