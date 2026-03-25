import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import { AccessibilityAgent, loadConfig } from '@aurora-qa/core';

export const CheckAccessibilitySchema = z.object({
  html: z.string().describe('HTML or React component code to check'),
  wcagLevel: z.enum(['A', 'AA', 'AAA']).optional().describe('WCAG conformance level (default: AA)'),
});

export function createAccessibilityTools(_orchestrator: Orchestrator) {
  return {
    check_accessibility: {
      description: 'Check HTML or React code for WCAG 2.1 accessibility compliance.',
      inputSchema: CheckAccessibilitySchema,
      async handler(input: z.infer<typeof CheckAccessibilitySchema>) {
        const agent = new AccessibilityAgent(loadConfig());
        const isReact = input.html.includes('import React') || input.html.includes('jsx') || input.html.includes('tsx');
        const report = await agent.generateA11yReport(input.html, isReact);
        return {
          score: report.score,
          level: report.level,
          summary: report.summary,
          findingCount: report.findings.length,
          findings: report.findings.map(f => ({
            criterion: f.criterion,
            severity: f.severity,
            description: f.description,
            element: f.element,
            suggestion: f.suggestion,
          })),
        };
      },
    },
  };
}
