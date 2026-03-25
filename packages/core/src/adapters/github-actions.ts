import { BaseAdapter } from './base-adapter.js';
import type { PipelineRun, CIAdapterResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class GitHubActionsAdapter extends BaseAdapter {
  readonly name = 'github-actions';
  private readonly log = logger.child('github-adapter');

  constructor(
    private options: { token?: string; repo?: string; prNumber?: number } = {},
  ) {
    super();
  }

  async reportResults(run: PipelineRun): Promise<CIAdapterResult> {
    const summary = this.formatRunSummary(run);
    this.log.info('Reporting results to GitHub', { status: run.status });

    // Write to GitHub Actions job summary if running in CI
    if (process.env['GITHUB_STEP_SUMMARY']) {
      try {
        const { appendFileSync } = await import('node:fs');
        appendFileSync(process.env['GITHUB_STEP_SUMMARY'], summary + '\n');
        return { success: true, message: 'Results written to job summary' };
      } catch (err) {
        this.log.warn('Failed to write job summary', { err });
      }
    }

    return { success: true, message: 'Results formatted', data: summary };
  }

  async getChangedFiles(): Promise<string[]> {
    const eventPath = process.env['GITHUB_EVENT_PATH'];
    if (!eventPath) return [];

    try {
      const { readFileSync } = await import('node:fs');
      const event = JSON.parse(readFileSync(eventPath, 'utf8'));

      // PR event
      if (event.pull_request) {
        const { execSync } = await import('node:child_process');
        const base = event.pull_request.base.sha;
        const head = event.pull_request.head.sha;
        const output = execSync(`git diff --name-only ${base}...${head}`, { encoding: 'utf8' });
        return output.trim().split('\n').filter(Boolean);
      }

      // Push event
      if (event.before && event.after) {
        const { execSync } = await import('node:child_process');
        const output = execSync(`git diff --name-only ${event.before}...${event.after}`, { encoding: 'utf8' });
        return output.trim().split('\n').filter(Boolean);
      }
    } catch (err) {
      this.log.warn('Failed to get changed files from GitHub event', { err });
    }

    return [];
  }

  async postComment(message: string): Promise<CIAdapterResult> {
    const token = this.options.token ?? process.env['GITHUB_TOKEN'];
    const repo = this.options.repo ?? process.env['GITHUB_REPOSITORY'];
    const prNumber = this.options.prNumber;

    if (!token || !repo || !prNumber) {
      return { success: false, message: 'Missing GitHub token, repo, or PR number' };
    }

    this.log.info(`Posting comment to PR #${prNumber}`);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: message }),
        },
      );

      if (!response.ok) {
        return { success: false, message: `GitHub API error: ${response.status}` };
      }

      return { success: true, message: `Comment posted to PR #${prNumber}` };
    } catch (err) {
      return { success: false, message: `Failed to post comment: ${err}` };
    }
  }
}
