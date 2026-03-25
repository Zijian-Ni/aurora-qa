import { VectorStore } from './vector-store.js';
import type {
  MemoryEntry,
  MemoryEntryType,
  VectorSearchResult,
  KnowledgeQuery,
  BugReport,
  TestCase,
  CodeReview,
  CoverageReport,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface KnowledgeBaseOptions {
  maxEntries?: number;
  persistPath?: string;
  similarityThreshold?: number;
}

/**
 * KnowledgeBase wraps the VectorStore with domain-specific ingestion helpers
 * and query patterns for QA knowledge.
 */
export class KnowledgeBase {
  private store: VectorStore;
  private readonly similarityThreshold: number;
  private readonly log = logger.child('knowledge-base');

  constructor(options: KnowledgeBaseOptions = {}) {
    this.similarityThreshold = options.similarityThreshold ?? 0.72;
    this.store = new VectorStore({
      maxEntries: options.maxEntries ?? 50_000,
      persistPath: options.persistPath,
    });
  }

  // ─── Ingestion ───────────────────────────────────────────────────────────────

  learnFromBugs(bugs: BugReport[], context?: string): void {
    for (const bug of bugs) {
      const content = [
        `Bug: ${bug.title}`,
        `Severity: ${bug.severity}`,
        `Category: ${bug.category}`,
        `Description: ${bug.description}`,
        bug.codeSnippet ? `Code: ${bug.codeSnippet}` : '',
        bug.suggestedFix ? `Fix: ${bug.suggestedFix}` : '',
        context ? `Context: ${context}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      this.upsert({
        type: 'bug-pattern',
        content,
        metadata: {
          bugId: bug.id,
          severity: bug.severity,
          category: bug.category,
          filePath: bug.filePath,
          confidence: bug.confidence,
        },
        tags: [bug.severity, bug.category, 'bug'],
      });
    }
    this.log.debug(`Learned from ${bugs.length} bugs`);
  }

  learnFromTests(tests: TestCase[], context?: string): void {
    for (const test of tests) {
      const content = [
        `Test: ${test.name}`,
        `Description: ${test.description}`,
        `Framework: ${test.framework}`,
        `Tags: ${test.tags.join(', ')}`,
        `Code: ${test.code.slice(0, 500)}`,
        context ? `Context: ${context}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      this.upsert({
        type: 'test-pattern',
        content,
        metadata: {
          testId: test.id,
          framework: test.framework,
          filePath: test.filePath,
          status: test.status,
        },
        tags: [...test.tags, test.framework, 'test'],
      });
    }
    this.log.debug(`Learned from ${tests.length} tests`);
  }

  learnFromReview(review: CodeReview): void {
    for (const issue of review.issues) {
      const content = [
        `Review issue: ${issue.message}`,
        `Severity: ${issue.severity}`,
        `Category: ${issue.category}`,
        issue.codeSnippet ? `Code: ${issue.codeSnippet}` : '',
        issue.suggestion ? `Suggestion: ${issue.suggestion}` : '',
        issue.rule ? `Rule: ${issue.rule}` : '',
        `File: ${review.filePath}`,
        `Language: ${review.language}`,
      ]
        .filter(Boolean)
        .join('\n');

      this.upsert({
        type: 'review-pattern',
        content,
        metadata: {
          reviewId: review.id,
          severity: issue.severity,
          category: issue.category,
          filePath: review.filePath,
          language: review.language,
          rule: issue.rule,
        },
        tags: [issue.severity, issue.category, review.language, 'review'],
      });
    }

    if (review.suggestions.length > 0) {
      const content = [
        `Code review for ${review.filePath}`,
        `Score: ${review.score}/100 (${review.grade})`,
        `Summary: ${review.summary}`,
        `Strengths: ${review.strengths.join(', ')}`,
        `Suggestions: ${review.suggestions.join('; ')}`,
      ].join('\n');

      this.upsert({
        type: 'code-insight',
        content,
        metadata: {
          reviewId: review.id,
          filePath: review.filePath,
          score: review.score,
          grade: review.grade,
          language: review.language,
        },
        tags: [review.language, review.grade, 'insight'],
      });
    }

    this.log.debug(`Learned from review: ${review.filePath} (${review.grade})`);
  }

  learnFromCoverage(report: CoverageReport, filePath?: string): void {
    const content = [
      filePath ? `Coverage gaps in ${filePath}` : 'Coverage report',
      `Overall: statements=${report.overall.statements.toFixed(1)}%, ` +
        `branches=${report.overall.branches.toFixed(1)}%, ` +
        `functions=${report.overall.functions.toFixed(1)}%, ` +
        `lines=${report.overall.lines.toFixed(1)}%`,
      `Meets thresholds: ${report.meetsThresholds}`,
      `Files analyzed: ${report.files.length}`,
    ].join('\n');

    this.upsert({
      type: 'coverage-gap',
      content,
      metadata: {
        reportId: report.id,
        overall: report.overall,
        meetsThresholds: report.meetsThresholds,
        fileCount: report.files.length,
      },
      tags: ['coverage', report.meetsThresholds ? 'passing' : 'failing'],
    });

    this.log.debug(`Learned from coverage report`);
  }

  learnFact(
    type: MemoryEntryType,
    content: string,
    metadata: Record<string, unknown> = {},
    tags: string[] = [],
  ): string {
    return this.upsert({ type, content, metadata, tags }).id;
  }

  // ─── Query ──────────────────────────────────────────────────────────────────

  query(q: KnowledgeQuery): VectorSearchResult[] {
    return this.store.search(q.query, {
      type: q.type,
      tags: q.tags,
      limit: q.limit ?? 10,
      minSimilarity: q.minSimilarity ?? this.similarityThreshold,
    });
  }

  findSimilarBugs(description: string, limit = 5): VectorSearchResult[] {
    return this.store.search(description, {
      type: 'bug-pattern',
      limit,
      minSimilarity: this.similarityThreshold,
    });
  }

  findSimilarTests(description: string, limit = 5): VectorSearchResult[] {
    return this.store.search(description, {
      type: 'test-pattern',
      limit,
      minSimilarity: this.similarityThreshold,
    });
  }

  findReviewPatterns(code: string, limit = 5): VectorSearchResult[] {
    return this.store.search(code, {
      type: 'review-pattern',
      limit,
      minSimilarity: this.similarityThreshold,
    });
  }

  findFixRecipes(errorMessage: string, limit = 3): VectorSearchResult[] {
    return this.store.search(errorMessage, {
      type: 'fix-recipe',
      limit,
      minSimilarity: this.similarityThreshold,
    });
  }

  // ─── Maintenance ─────────────────────────────────────────────────────────────

  flush(): void {
    this.store.flush();
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  stats(): Record<string, number> {
    const all = this.store.all();
    const counts: Record<string, number> = { total: all.length };
    for (const entry of all) {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    }
    return counts;
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private upsert(
    partial: Pick<MemoryEntry, 'type' | 'content' | 'metadata' | 'tags'>,
  ): MemoryEntry {
    const now = new Date();
    return this.store.upsert({
      id: crypto.randomUUID(),
      type: partial.type,
      content: partial.content,
      metadata: partial.metadata,
      tags: partial.tags,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
    });
  }
}
