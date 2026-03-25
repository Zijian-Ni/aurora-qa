import { BaseAdapter } from './base-adapter.js';
import type { PipelineRun, CIAdapterResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class GitLabCIAdapter extends BaseAdapter {
  readonly name = 'gitlab-ci';
  private readonly log = logger.child('gitlab-adapter');

  constructor(
    private options: { token?: string; projectId?: string; mrIid?: number; apiUrl?: string } = {},
  ) {
    super();
  }

  async reportResults(run: PipelineRun): Promise<CIAdapterResult> {
    const summary = this.formatRunSummary(run);
    this.log.info('Reporting results to GitLab', { status: run.status });

    if (this.options.mrIid) {
      return this.postComment(summary);
    }

    return { success: true, message: 'Results formatted', data: summary };
  }

  async getChangedFiles(): Promise<string[]> {
    const token = this.options.token ?? process.env['CI_JOB_TOKEN'];
    const projectId = this.options.projectId ?? process.env['CI_PROJECT_ID'];
    const mrIid = this.options.mrIid ?? Number(process.env['CI_MERGE_REQUEST_IID']);
    const apiUrl = this.options.apiUrl ?? process.env['CI_API_V4_URL'] ?? 'https://gitlab.com/api/v4';

    if (!token || !projectId || !mrIid) return [];

    try {
      const response = await fetch(
        `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/changes`,
        { headers: { 'PRIVATE-TOKEN': token } },
      );

      if (!response.ok) return [];

      const data = await response.json() as { changes?: Array<{ new_path: string }> };
      return data.changes?.map(c => c.new_path) ?? [];
    } catch (err) {
      this.log.warn('Failed to get changed files from GitLab', { err });
      return [];
    }
  }

  async postComment(message: string): Promise<CIAdapterResult> {
    const token = this.options.token ?? process.env['CI_JOB_TOKEN'];
    const projectId = this.options.projectId ?? process.env['CI_PROJECT_ID'];
    const mrIid = this.options.mrIid ?? Number(process.env['CI_MERGE_REQUEST_IID']);
    const apiUrl = this.options.apiUrl ?? process.env['CI_API_V4_URL'] ?? 'https://gitlab.com/api/v4';

    if (!token || !projectId || !mrIid) {
      return { success: false, message: 'Missing GitLab token, project ID, or MR IID' };
    }

    try {
      const response = await fetch(
        `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/notes`,
        {
          method: 'POST',
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: message }),
        },
      );

      if (!response.ok) {
        return { success: false, message: `GitLab API error: ${response.status}` };
      }

      return { success: true, message: `Comment posted to MR !${mrIid}` };
    } catch (err) {
      return { success: false, message: `Failed to post comment: ${err}` };
    }
  }
}
