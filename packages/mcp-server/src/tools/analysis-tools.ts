import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';

export const AnalyzeBugsSchema = z.object({
  code: z.string().describe('Source code to analyze for bugs'),
  filePath: z.string().describe('Path of the file being analyzed'),
  language: z.string().optional().describe('Programming language (auto-detected if omitted)'),
  context: z.string().optional().describe('Additional context about the code'),
  errorMessage: z.string().optional().describe('Error message from a failure to help guide analysis'),
  testOutput: z.string().optional().describe('Failing test output to help pinpoint the bug'),
});

export const ReviewCodeSchema = z.object({
  code: z.string().describe('Source code to review'),
  filePath: z.string().describe('Path of the file being reviewed'),
  language: z.string().optional().describe('Programming language'),
  context: z.string().optional().describe('Context about what this code does'),
  strictness: z
    .enum(['lenient', 'standard', 'strict'])
    .optional()
    .describe('Review strictness level (default: standard)'),
  focusAreas: z
    .array(
      z.enum([
        'correctness',
        'security',
        'performance',
        'maintainability',
        'style',
        'testability',
        'documentation',
      ]),
    )
    .optional()
    .describe('Specific aspects to focus on'),
});

export const AnalyzeCoverageSchema = z.object({
  coverageJson: z.string().optional().describe('JSON coverage report (e.g. from Istanbul/V8)'),
  coverageSummary: z.string().optional().describe('Text coverage summary'),
  thresholds: z
    .object({
      statements: z.number().min(0).max(100).optional(),
      branches: z.number().min(0).max(100).optional(),
      functions: z.number().min(0).max(100).optional(),
      lines: z.number().min(0).max(100).optional(),
    })
    .optional()
    .describe('Coverage thresholds to check against'),
});

export const QueryKnowledgeSchema = z.object({
  query: z.string().describe('Natural language query to search the knowledge base'),
  type: z
    .enum(['test-pattern', 'bug-pattern', 'code-insight', 'fix-recipe', 'coverage-gap', 'review-pattern'])
    .optional()
    .describe('Filter by memory entry type'),
  limit: z.number().int().positive().max(20).optional().describe('Max results (default: 5)'),
});

export function createAnalysisTools(orchestrator: Orchestrator) {
  return {
    analyze_bugs: {
      description:
        'Perform deep static analysis on source code to find bugs, security vulnerabilities, ' +
        'and logic errors. Returns detailed bug reports with severity ratings and fix suggestions.',
      inputSchema: AnalyzeBugsSchema,
      async handler(input: z.infer<typeof AnalyzeBugsSchema>) {
        const output = await orchestrator.analyzeBugs({
          code: input.code,
          filePath: input.filePath,
          language: input.language,
          context: input.context,
          errorMessage: input.errorMessage,
          testOutput: input.testOutput,
        });

        return {
          riskScore: output.riskScore,
          summary: output.summary,
          bugCount: output.bugs.length,
          recommendations: output.recommendations,
          bugs: output.bugs.map(b => ({
            id: b.id,
            title: b.title,
            severity: b.severity,
            category: b.category,
            description: b.description,
            lineStart: b.lineStart,
            lineEnd: b.lineEnd,
            codeSnippet: b.codeSnippet,
            suggestedFix: b.suggestedFix,
            fixCode: b.fixCode,
            confidence: b.confidence,
          })),
        };
      },
    },

    review_code: {
      description:
        'Conduct a thorough code review covering correctness, security, performance, ' +
        'maintainability, and style. Returns scored review with specific issues and improvement suggestions.',
      inputSchema: ReviewCodeSchema,
      async handler(input: z.infer<typeof ReviewCodeSchema>) {
        const output = await orchestrator.reviewCode({
          code: input.code,
          filePath: input.filePath,
          language: input.language,
          context: input.context,
          strictness: input.strictness,
          focusAreas: input.focusAreas,
        });

        return {
          score: output.review.score,
          grade: output.review.grade,
          summary: output.review.summary,
          strengths: output.review.strengths,
          suggestions: output.review.suggestions,
          criticalIssueCount: output.criticalIssues.length,
          totalIssueCount: output.review.issues.length,
          criticalIssues: output.criticalIssues.map(i => ({
            severity: i.severity,
            category: i.category,
            message: i.message,
            lineStart: i.lineStart,
            suggestion: i.suggestion,
            fixCode: i.fixCode,
          })),
          allIssues: output.review.issues.map(i => ({
            id: i.id,
            severity: i.severity,
            category: i.category,
            message: i.message,
            lineStart: i.lineStart,
            lineEnd: i.lineEnd,
            suggestion: i.suggestion,
          })),
        };
      },
    },

    analyze_coverage: {
      description:
        'Analyze test coverage reports to identify gaps and recommend which tests to add. ' +
        'Checks against configurable thresholds and prioritizes files by risk.',
      inputSchema: AnalyzeCoverageSchema,
      async handler(input: z.infer<typeof AnalyzeCoverageSchema>) {
        const output = await orchestrator.analyzeCoverage({
          coverageJson: input.coverageJson,
          coverageSummary: input.coverageSummary,
          thresholds: input.thresholds,
        });

        return {
          overall: output.report.overall,
          meetsThresholds: output.report.meetsThresholds,
          thresholds: output.report.thresholds,
          gapCount: output.gaps.length,
          suggestions: output.suggestions,
          prioritizedFiles: output.prioritizedFiles,
          gaps: output.gaps.map(g => ({
            filePath: g.filePath,
            metric: g.metric,
            current: g.current,
            target: g.target,
            gap: g.target - g.current,
            uncoveredItems: g.uncoveredItems.slice(0, 10),
          })),
        };
      },
    },

    query_knowledge: {
      description:
        'Search the Aurora QA knowledge base for relevant patterns, past bugs, test examples, ' +
        'and code insights learned from previous analysis sessions.',
      inputSchema: QueryKnowledgeSchema,
      async handler(input: z.infer<typeof QueryKnowledgeSchema>) {
        const results = orchestrator.knowledgeBase.query({
          query: input.query,
          type: input.type,
          limit: input.limit ?? 5,
        });

        return {
          count: results.length,
          results: results.map(r => ({
            id: r.entry.id,
            type: r.entry.type,
            similarity: Math.round(r.similarity * 100) / 100,
            content: r.entry.content.slice(0, 400),
            metadata: r.entry.metadata,
            tags: r.entry.tags,
            accessCount: r.entry.accessCount,
          })),
        };
      },
    },
  };
}
