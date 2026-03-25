import type { PipelineConfig } from '../types/index.js';

export function createSecurityAuditPipeline(options: {
  sourceCode: string;
  filePath: string;
  language?: string;
}): PipelineConfig {
  return {
    id: `security-audit-${Date.now()}`,
    name: 'Security Audit Pipeline',
    description: 'Security-focused pipeline: security → mutation → review (strict)',
    steps: [
      {
        id: 'bugs',
        type: 'analyze-bugs',
        name: 'Deep Bug & Security Analysis',
        config: { code: options.sourceCode, filePath: options.filePath, language: options.language, context: 'security audit' },
      },
      {
        id: 'review',
        type: 'review-code',
        name: 'Strict Code Review',
        config: {
          code: options.sourceCode,
          filePath: options.filePath,
          language: options.language,
          strictness: 'strict',
          focusAreas: ['security', 'correctness'],
        },
        dependsOn: ['bugs'],
      },
    ],
    triggers: [{ type: 'manual' }],
    environment: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
