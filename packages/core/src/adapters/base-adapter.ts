import type { PipelineRun, CIAdapterResult } from '../types/index.js';

export abstract class BaseAdapter {
  abstract readonly name: string;

  abstract reportResults(run: PipelineRun): Promise<CIAdapterResult>;
  abstract getChangedFiles(): Promise<string[]>;
  abstract postComment(message: string): Promise<CIAdapterResult>;

  protected formatRunSummary(run: PipelineRun): string {
    const status = run.status === 'completed' ? '✅' : '❌';
    const lines = [
      `${status} **Aurora QA — ${run.pipelineName}**`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Status | ${run.status} |`,
      `| Duration | ${run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : 'N/A'} |`,
    ];

    if (run.results.testsTotal !== undefined) {
      lines.push(`| Tests | ${run.results.testsPassing}/${run.results.testsTotal} passing |`);
    }
    if (run.results.bugsFound !== undefined) {
      lines.push(`| Bugs Found | ${run.results.bugsFound} |`);
    }
    if (run.results.coveragePercent !== undefined) {
      lines.push(`| Coverage | ${run.results.coveragePercent.toFixed(1)}% |`);
    }
    if (run.results.reviewScore !== undefined) {
      lines.push(`| Review Score | ${run.results.reviewScore}/100 (${run.results.reviewGrade}) |`);
    }

    return lines.join('\n');
  }
}
