import { EventEmitter } from 'node:events';
import type {
  PipelineConfig,
  PipelineRun,
  PipelineStepRun,
  PipelineStep,
  PipelineStatus,
  StepStatus,
  StepType,
  GenerateTestsInput,
  RunTestsInput,
  AnalyzeBugsInput,
  AnalyzeCoverageInput,
  ReviewCodeInput,
} from '../types/index.js';
import type { TestGeneratorAgent } from '../agents/test-generator.js';
import type { TestRunnerAgent } from '../agents/test-runner.js';
import type { BugAnalyzerAgent } from '../agents/bug-analyzer.js';
import type { CoverageAgent } from '../agents/coverage-agent.js';
import type { ReviewAgent } from '../agents/review-agent.js';
import type { SecurityAgent } from '../agents/security-agent.js';
import type { PerformanceAgent } from '../agents/performance-agent.js';
import type { HealerAgent } from '../agents/healer-agent.js';
import type { KnowledgeBase } from '../memory/knowledge-base.js';
import { logger } from '../utils/logger.js';

export interface PipelineAgents {
  testGenerator: TestGeneratorAgent;
  testRunner: TestRunnerAgent;
  bugAnalyzer: BugAnalyzerAgent;
  coverageAgent: CoverageAgent;
  reviewAgent: ReviewAgent;
  securityAgent?: SecurityAgent;
  performanceAgent?: PerformanceAgent;
  healerAgent?: HealerAgent;
}

export interface PipelineRunnerOptions {
  agents: PipelineAgents;
  knowledgeBase?: KnowledgeBase;
}

/**
 * PipelineRunner executes a pipeline definition by resolving step dependencies
 * and dispatching each step to the appropriate agent.
 */
export class PipelineRunner extends EventEmitter {
  private agents: PipelineAgents;
  private kb?: KnowledgeBase;
  private readonly log = logger.child('pipeline-runner');

  constructor(options: PipelineRunnerOptions) {
    super();
    this.agents = options.agents;
    this.kb = options.knowledgeBase;
  }

  async execute(config: PipelineConfig, trigger: PipelineRun['trigger'] = 'manual'): Promise<PipelineRun> {
    const runId = crypto.randomUUID();
    const run: PipelineRun = {
      id: runId,
      pipelineId: config.id,
      pipelineName: config.name,
      status: 'running',
      trigger,
      startedAt: new Date(),
      steps: config.steps.map(s => ({
        stepId: s.id,
        stepType: s.type,
        stepName: s.name,
        status: 'pending',
      })),
      results: {},
    };

    this.log.info(`Pipeline run started: ${config.name}`, { runId });
    this.emit('run-started', run);

    try {
      // Topological execution respecting dependsOn
      const order = this.topologicalSort(config.steps);

      for (const step of order) {
        const stepRun = run.steps.find(s => s.stepId === step.id);
        if (!stepRun) continue;

        // Check if dependencies completed successfully
        if (!this.dependenciesMet(step, run)) {
          stepRun.status = 'skipped';
          this.emit('step-skipped', { run, step: stepRun });
          continue;
        }

        await this.executeStep(step, stepRun, run, config);

        if (stepRun.status === 'failed' && !step.continueOnError) {
          run.status = 'failed';
          run.error = `Step "${step.name}" failed`;
          break;
        }
      }

      if (run.status !== 'failed') {
        run.status = 'completed';
      }
    } catch (err) {
      run.status = 'failed';
      run.error = err instanceof Error ? err.message : String(err);
      this.log.error('Pipeline run failed', err);
    } finally {
      run.completedAt = new Date();
      run.durationMs = run.completedAt.getTime() - run.startedAt.getTime();
      this.emit('run-completed', run);
      this.log.info(`Pipeline run ${run.status}: ${config.name}`, {
        runId,
        durationMs: run.durationMs,
      });
    }

    return run;
  }

  private async executeStep(
    step: PipelineStep,
    stepRun: PipelineStepRun,
    run: PipelineRun,
    config: PipelineConfig,
  ): Promise<void> {
    stepRun.status = 'running';
    stepRun.startedAt = new Date();
    this.log.info(`Step started: ${step.name}`, { type: step.type });
    this.emit('step-started', { run, step: stepRun });

    const timeout = step.timeoutMs ?? 300_000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Step "${step.name}" timed out after ${timeout}ms`)), timeout);
    });

    try {
      const output = await Promise.race([
        this.dispatchStep(step, run, config),
        timeoutPromise,
      ]);

      stepRun.output = output;
      stepRun.status = 'completed';
      this.mergeResults(run, step.type, output);
    } catch (err) {
      stepRun.status = 'failed';
      stepRun.error = err instanceof Error ? err.message : String(err);
      this.log.error(`Step failed: ${step.name}`, err);
    } finally {
      clearTimeout(timeoutId);
      stepRun.completedAt = new Date();
      stepRun.durationMs = stepRun.completedAt.getTime() - (stepRun.startedAt?.getTime() ?? 0);
      this.emit('step-completed', { run, step: stepRun });
    }
  }

  private async dispatchStep(
    step: PipelineStep,
    run: PipelineRun,
    config: PipelineConfig,
  ): Promise<unknown> {
    const env = config.environment;

    switch (step.type as StepType) {
      case 'generate-tests': {
        const input: GenerateTestsInput = {
          sourceCode: String(step.config['sourceCode'] ?? ''),
          filePath: String(step.config['filePath'] ?? ''),
          framework: step.config['framework'] as GenerateTestsInput['framework'],
          maxTests: step.config['maxTests'] as number | undefined,
          focusAreas: step.config['focusAreas'] as string[] | undefined,
        };
        const output = await this.agents.testGenerator.generateTests(input);
        this.kb?.learnFromTests(output.tests, `Pipeline: ${run.pipelineName}`);
        return output;
      }

      case 'run-tests': {
        const input: RunTestsInput = {
          command: String(step.config['command'] ?? 'pnpm test'),
          cwd: String(step.config['cwd'] ?? process.cwd()),
          env: { ...env, ...(step.config['env'] as Record<string, string> | undefined) },
          timeout: step.config['timeout'] as number | undefined,
        };
        return this.agents.testRunner.runTests(input);
      }

      case 'analyze-bugs': {
        const input: AnalyzeBugsInput = {
          code: String(step.config['code'] ?? ''),
          filePath: String(step.config['filePath'] ?? ''),
          language: step.config['language'] as string | undefined,
          context: step.config['context'] as string | undefined,
        };
        const output = await this.agents.bugAnalyzer.analyzeBugs(input);
        this.kb?.learnFromBugs(output.bugs, `Pipeline: ${run.pipelineName}`);
        return output;
      }

      case 'check-coverage': {
        const input: AnalyzeCoverageInput = {
          coverageJson: step.config['coverageJson'] as string | undefined,
          coverageSummary: step.config['coverageSummary'] as string | undefined,
          thresholds: step.config['thresholds'] as Partial<{
            statements: number;
            branches: number;
            functions: number;
            lines: number;
          }> | undefined,
        };
        const output = await this.agents.coverageAgent.analyzeCoverage(input);
        this.kb?.learnFromCoverage(output.report);
        return output;
      }

      case 'review-code': {
        const input: ReviewCodeInput = {
          code: String(step.config['code'] ?? ''),
          filePath: String(step.config['filePath'] ?? ''),
          language: step.config['language'] as string | undefined,
          context: step.config['context'] as string | undefined,
          strictness: step.config['strictness'] as ReviewCodeInput['strictness'],
        };
        const output = await this.agents.reviewAgent.reviewCode(input);
        this.kb?.learnFromReview(output.review);
        return output;
      }

      case 'scan-security': {
        if (!this.agents.securityAgent) throw new Error('SecurityAgent not configured in pipeline');
        const code = String(step.config['code'] ?? '');
        const filePath = step.config['filePath'] as string | undefined;
        return this.agents.securityAgent.generateSecurityReport(code, filePath);
      }

      case 'analyze-performance': {
        if (!this.agents.performanceAgent) throw new Error('PerformanceAgent not configured in pipeline');
        const code = String(step.config['code'] ?? '');
        const language = step.config['language'] as string | undefined;
        return this.agents.performanceAgent.analyze(code, language);
      }

      case 'heal-tests': {
        if (!this.agents.healerAgent) throw new Error('HealerAgent not configured in pipeline');
        const error = String(step.config['error'] ?? '');
        const context = (step.config['context'] as Record<string, unknown>) ?? {};
        return this.agents.healerAgent.analyzeFailure(error, context);
      }

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private mergeResults(run: PipelineRun, stepType: StepType, output: unknown): void {
    const o = output as Record<string, unknown>;
    switch (stepType) {
      case 'generate-tests': {
        const tests = o as { tests?: unknown[] };
        run.results.testsGenerated = tests.tests?.length ?? 0;
        break;
      }
      case 'run-tests': {
        const r = o as { summary?: { total?: number; passing?: number; failing?: number } };
        run.results.testsTotal = r.summary?.total;
        run.results.testsPassing = r.summary?.passing;
        run.results.testsFailing = r.summary?.failing;
        break;
      }
      case 'analyze-bugs': {
        const bugs = o as { bugs?: unknown[]; riskScore?: number };
        run.results.bugsFound = bugs.bugs?.length ?? 0;
        break;
      }
      case 'check-coverage': {
        const cov = o as { report?: { overall?: { lines?: number } } };
        run.results.coveragePercent = cov.report?.overall?.lines;
        break;
      }
      case 'review-code': {
        const rev = o as { review?: { score?: number; grade?: string } };
        run.results.reviewScore = rev.review?.score;
        run.results.reviewGrade = rev.review?.grade;
        break;
      }
      case 'scan-security': {
        const sec = o as { findings?: unknown[]; riskScore?: number };
        run.results.securityFindings = sec.findings?.length ?? 0;
        run.results.securityRiskScore = sec.riskScore;
        break;
      }
      case 'analyze-performance': {
        const perf = o as { issues?: unknown[] };
        run.results.performanceIssues = perf.issues?.length ?? 0;
        break;
      }
      case 'heal-tests': {
        const heal = o as { suggestion?: unknown };
        run.results.healingSuggestions = heal.suggestion ? 1 : 0;
        break;
      }
    }
  }

  // ─── Topology ────────────────────────────────────────────────────────────────

  private topologicalSort(steps: PipelineStep[]): PipelineStep[] {
    const visited = new Set<string>();
    const order: PipelineStep[] = [];
    const stepMap = new Map(steps.map(s => [s.id, s]));

    const visit = (step: PipelineStep) => {
      if (visited.has(step.id)) return;
      visited.add(step.id);
      for (const depId of step.dependsOn ?? []) {
        const dep = stepMap.get(depId);
        if (dep) visit(dep);
      }
      order.push(step);
    };

    for (const step of steps) visit(step);
    return order;
  }

  private dependenciesMet(step: PipelineStep, run: PipelineRun): boolean {
    if (!step.dependsOn || step.dependsOn.length === 0) return true;
    return step.dependsOn.every(depId => {
      const depRun = run.steps.find(s => s.stepId === depId);
      return depRun?.status === 'completed';
    });
  }
}
