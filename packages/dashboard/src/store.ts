import type {
  PipelineConfig,
  PipelineRun,
  TestCase,
  TestResult,
  BugReport,
  CoverageReport,
  CodeReview,
} from '@aurora-qa/core';

/**
 * In-memory data store for the dashboard.
 * Production deployments can swap this for Redis/Postgres.
 */
export class DashboardStore {
  private pipelines = new Map<string, PipelineConfig>();
  private pipelineRuns = new Map<string, PipelineRun>();
  private tests = new Map<string, TestCase>();
  private testResults = new Map<string, TestResult>();
  private bugs = new Map<string, BugReport>();
  private coverageReports = new Map<string, CoverageReport>();
  private codeReviews = new Map<string, CodeReview>();

  // ─── Pipelines ───────────────────────────────────────────────────────────────

  savePipeline(config: PipelineConfig): void {
    this.pipelines.set(config.id, config);
  }

  getPipeline(id: string): PipelineConfig | undefined {
    return this.pipelines.get(id);
  }

  listPipelines(): PipelineConfig[] {
    return Array.from(this.pipelines.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }

  deletePipeline(id: string): boolean {
    return this.pipelines.delete(id);
  }

  // ─── Pipeline Runs ────────────────────────────────────────────────────────────

  savePipelineRun(run: PipelineRun): void {
    this.pipelineRuns.set(run.id, run);
  }

  getPipelineRun(id: string): PipelineRun | undefined {
    return this.pipelineRuns.get(id);
  }

  listPipelineRuns(pipelineId?: string, limit = 50): PipelineRun[] {
    let runs = Array.from(this.pipelineRuns.values());
    if (pipelineId) runs = runs.filter(r => r.pipelineId === pipelineId);
    return runs
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  // ─── Tests ───────────────────────────────────────────────────────────────────

  saveTests(tests: TestCase[]): void {
    for (const t of tests) this.tests.set(t.id, t);
  }

  getTest(id: string): TestCase | undefined {
    return this.tests.get(id);
  }

  listTests(filePath?: string): TestCase[] {
    let tests = Array.from(this.tests.values());
    if (filePath) tests = tests.filter(t => t.filePath === filePath);
    return tests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ─── Test Results ────────────────────────────────────────────────────────────

  saveTestResults(results: TestResult[]): void {
    for (const r of results) this.testResults.set(r.id, r);
  }

  listTestResults(runId?: string, limit = 100): TestResult[] {
    let results = Array.from(this.testResults.values());
    if (runId) results = results.filter(r => r.runId === runId);
    return results
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // ─── Bugs ────────────────────────────────────────────────────────────────────

  saveBugs(bugs: BugReport[]): void {
    for (const b of bugs) this.bugs.set(b.id, b);
  }

  getBug(id: string): BugReport | undefined {
    return this.bugs.get(id);
  }

  updateBug(id: string, patch: Partial<BugReport>): BugReport | undefined {
    const bug = this.bugs.get(id);
    if (!bug) return undefined;
    const updated = { ...bug, ...patch, updatedAt: new Date() };
    this.bugs.set(id, updated);
    return updated;
  }

  listBugs(opts: { filePath?: string; severity?: string; status?: string } = {}): BugReport[] {
    let bugs = Array.from(this.bugs.values());
    if (opts.filePath) bugs = bugs.filter(b => b.filePath === opts.filePath);
    if (opts.severity) bugs = bugs.filter(b => b.severity === opts.severity);
    if (opts.status) bugs = bugs.filter(b => b.status === opts.status);
    return bugs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ─── Coverage ────────────────────────────────────────────────────────────────

  saveCoverageReport(report: CoverageReport): void {
    this.coverageReports.set(report.id, report);
  }

  getLatestCoverageReport(): CoverageReport | undefined {
    const reports = Array.from(this.coverageReports.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
    return reports[0];
  }

  listCoverageReports(limit = 20): CoverageReport[] {
    return Array.from(this.coverageReports.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // ─── Code Reviews ────────────────────────────────────────────────────────────

  saveCodeReview(review: CodeReview): void {
    this.codeReviews.set(review.id, review);
  }

  getCodeReview(id: string): CodeReview | undefined {
    return this.codeReviews.get(id);
  }

  listCodeReviews(filePath?: string, limit = 50): CodeReview[] {
    let reviews = Array.from(this.codeReviews.values());
    if (filePath) reviews = reviews.filter(r => r.filePath === filePath);
    return reviews
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // ─── Dashboard Stats ─────────────────────────────────────────────────────────

  getStats(): DashboardStats {
    const bugs = Array.from(this.bugs.values());
    const runs = Array.from(this.pipelineRuns.values());
    const testResults = Array.from(this.testResults.values());

    return {
      pipelines: {
        total: this.pipelines.size,
        runs: runs.length,
        lastRunAt: runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]?.startedAt,
      },
      tests: {
        total: this.tests.size,
        results: testResults.length,
        passing: testResults.filter(r => r.status === 'passing').length,
        failing: testResults.filter(r => r.status === 'failing').length,
      },
      bugs: {
        total: bugs.length,
        open: bugs.filter(b => b.status === 'open').length,
        critical: bugs.filter(b => b.severity === 'critical' && b.status === 'open').length,
        high: bugs.filter(b => b.severity === 'high' && b.status === 'open').length,
      },
      coverage: {
        reports: this.coverageReports.size,
        latest: this.getLatestCoverageReport()?.overall.lines,
      },
      reviews: {
        total: this.codeReviews.size,
        averageScore: this.computeAverageReviewScore(),
      },
    };
  }

  private computeAverageReviewScore(): number | undefined {
    const reviews = Array.from(this.codeReviews.values());
    if (reviews.length === 0) return undefined;
    return reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
  }
}

export interface DashboardStats {
  pipelines: {
    total: number;
    runs: number;
    lastRunAt?: Date;
  };
  tests: {
    total: number;
    results: number;
    passing: number;
    failing: number;
  };
  bugs: {
    total: number;
    open: number;
    critical: number;
    high: number;
  };
  coverage: {
    reports: number;
    latest?: number;
  };
  reviews: {
    total: number;
    averageScore?: number;
  };
}
