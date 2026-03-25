import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import { PerformanceAgent, loadConfig } from '@aurora-qa/core';

export const AnalyzePerformanceSchema = z.object({
  code: z.string().describe('Source code to analyze for performance issues'),
  filePath: z.string().optional().describe('File path for context'),
});

export const EstimateComplexitySchema = z.object({
  code: z.string().describe('Code to estimate complexity for'),
  language: z.string().optional().describe('Programming language'),
});

export function createPerformanceTools(_orchestrator: Orchestrator) {
  return {
    analyze_performance: {
      description: 'Analyze code for performance issues: N+1 queries, memory leaks, blocking operations, and more.',
      inputSchema: AnalyzePerformanceSchema,
      async handler(input: z.infer<typeof AnalyzePerformanceSchema>) {
        const agent = new PerformanceAgent(loadConfig());
        const analysis = await agent.analyze(input.code, undefined);
        return {
          timeComplexity: analysis.timeComplexity,
          spaceComplexity: analysis.spaceComplexity,
          issueCount: analysis.issues.length,
          issues: analysis.issues.map(i => ({
            type: i.type,
            description: i.description,
            location: i.location,
            severity: i.severity,
          })),
          optimizations: analysis.optimizations.map(o => ({
            description: o.description,
            impact: o.impact,
            before: o.before?.slice(0, 200),
            after: o.after?.slice(0, 200),
          })),
        };
      },
    },

    estimate_complexity: {
      description: 'Estimate the Big O time and space complexity of code.',
      inputSchema: EstimateComplexitySchema,
      async handler(input: z.infer<typeof EstimateComplexitySchema>) {
        const agent = new PerformanceAgent(loadConfig());
        const result = await agent.analyzeTimeComplexity(input.code, input.language);
        return { timeComplexity: result.time, spaceComplexity: result.space };
      },
    },
  };
}
