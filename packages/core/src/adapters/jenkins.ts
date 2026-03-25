import { BaseAdapter } from './base-adapter.js';
import type { PipelineRun, CIAdapterResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class JenkinsAdapter extends BaseAdapter {
  readonly name = 'jenkins';
  private readonly log = logger.child('jenkins-adapter');

  async reportResults(run: PipelineRun): Promise<CIAdapterResult> {
    const junitXml = this.toJUnitXml(run);
    this.log.info('Generated JUnit XML report', { status: run.status });
    return { success: true, message: 'JUnit XML generated', data: junitXml };
  }

  async getChangedFiles(): Promise<string[]> {
    try {
      const { execSync } = await import('node:child_process');
      const output = execSync('git diff --name-only HEAD~1', { encoding: 'utf8' });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  async postComment(message: string): Promise<CIAdapterResult> {
    this.log.info('Jenkins comment (logged)', { message: message.slice(0, 200) });
    return { success: true, message: 'Comment logged (Jenkins has no native comment API)' };
  }

  private toJUnitXml(run: PipelineRun): string {
    const steps = run.steps;
    const failed = steps.filter(s => s.status === 'failed').length;
    const skipped = steps.filter(s => s.status === 'skipped').length;

    const testCases = steps.map(step => {
      if (step.status === 'failed') {
        return `    <testcase name="${this.escapeXml(step.stepName)}" classname="aurora.${step.stepType}" time="${((step.durationMs ?? 0) / 1000).toFixed(3)}">
      <failure message="${this.escapeXml(step.error ?? 'Unknown error')}" />
    </testcase>`;
      }
      if (step.status === 'skipped') {
        return `    <testcase name="${this.escapeXml(step.stepName)}" classname="aurora.${step.stepType}">
      <skipped />
    </testcase>`;
      }
      return `    <testcase name="${this.escapeXml(step.stepName)}" classname="aurora.${step.stepType}" time="${((step.durationMs ?? 0) / 1000).toFixed(3)}" />`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${this.escapeXml(run.pipelineName)}" tests="${steps.length}" failures="${failed}" skipped="${skipped}" time="${((run.durationMs ?? 0) / 1000).toFixed(3)}">
${testCases.join('\n')}
</testsuite>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
