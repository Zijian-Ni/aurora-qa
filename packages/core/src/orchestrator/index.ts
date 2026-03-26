import { EventEmitter } from 'node:events';
import { PipelineRunner } from './pipeline.js';
import { TestGeneratorAgent } from '../agents/test-generator.js';
import { TestRunnerAgent } from '../agents/test-runner.js';
import { BugAnalyzerAgent } from '../agents/bug-analyzer.js';
import { CoverageAgent } from '../agents/coverage-agent.js';
import { ReviewAgent } from '../agents/review-agent.js';
import { SecurityAgent } from '../agents/security-agent.js';
import { PerformanceAgent } from '../agents/performance-agent.js';
import { HealerAgent } from '../agents/healer-agent.js';
import { KnowledgeBase } from '../memory/knowledge-base.js';
import type {
  AuroraConfig,
  PipelineConfig,
  PipelineRun,
  GenerateTestsInput,
  GenerateTestsOutput,
  RunTestsInput,
  RunTestsOutput,
  AnalyzeBugsInput,
  AnalyzeBugsOutput,
  AnalyzeCoverageInput,
  AnalyzeCoverageOutput,
  ReviewCodeInput,
  ReviewCodeOutput,
  SecurityReport,
  PerformanceAnalysis,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface OrchestratorOptions {
  config: AuroraConfig;
}

/**
 * Orchestrator is the main entry point for Aurora QA.
 * It manages all agents, the knowledge base, and pipeline execution.
 */
export class Orchestrator extends EventEmitter {
  private config: AuroraConfig;
  private readonly log = logger.child('orchestrator');

  readonly testGenerator: TestGeneratorAgent;
  readonly testRunner: TestRunnerAgent;
  readonly bugAnalyzer: BugAnalyzerAgent;
  readonly coverageAgent: CoverageAgent;
  readonly reviewAgent: ReviewAgent;
  readonly securityAgent: SecurityAgent;
  readonly performanceAgent: PerformanceAgent;
  readonly healerAgent: HealerAgent;
  readonly knowledgeBase: KnowledgeBase;

  private pipelineRunner: PipelineRunner;
  private pipelineHistory: PipelineRun[] = [];

  constructor(options: OrchestratorOptions) {
    super();
    this.config = options.config;

    // Initialize knowledge base
    this.knowledgeBase = new KnowledgeBase({
      maxEntries: this.config.memory.maxEntries,
      persistPath: this.config.memory.persistPath,
      similarityThreshold: this.config.memory.similarityThreshold,
    });

    // Initialize agents
    this.testGenerator = new TestGeneratorAgent(this.config);
    this.testRunner = new TestRunnerAgent(this.config);
    this.bugAnalyzer = new BugAnalyzerAgent(this.config);
    this.coverageAgent = new CoverageAgent(this.config);
    this.reviewAgent = new ReviewAgent(this.config);
    this.securityAgent = new SecurityAgent(this.config);
    this.performanceAgent = new PerformanceAgent(this.config);
    this.healerAgent = new HealerAgent(this.config, this.knowledgeBase);

    // Wire agents to pipeline runner
    this.pipelineRunner = new PipelineRunner({
      agents: {
        testGenerator: this.testGenerator,
        testRunner: this.testRunner,
        bugAnalyzer: this.bugAnalyzer,
        coverageAgent: this.coverageAgent,
        reviewAgent: this.reviewAgent,
        securityAgent: this.securityAgent,
        performanceAgent: this.performanceAgent,
        healerAgent: this.healerAgent,
      },
      knowledgeBase: this.knowledgeBase,
    });

    // Forward pipeline events
    this.pipelineRunner.on('run-started', run => this.emit('pipeline:started', run));
    this.pipelineRunner.on('run-completed', run => this.emit('pipeline:completed', run));
    this.pipelineRunner.on('step-started', e => this.emit('pipeline:step-started', e));
    this.pipelineRunner.on('step-completed', e => this.emit('pipeline:step-completed', e));
    this.pipelineRunner.on('step-skipped', e => this.emit('pipeline:step-skipped', e));

    this.log.info('Orchestrator initialized', { model: this.config.model });
  }

  // ─── Pipeline execution ──────────────────────────────────────────────────────

  async runPipeline(
    config: PipelineConfig,
    trigger: PipelineRun['trigger'] = 'manual',
  ): Promise<PipelineRun> {
    const run = await this.pipelineRunner.execute(config, trigger);
    this.pipelineHistory.push(run);
    return run;
  }

  getPipelineHistory(limit = 50): PipelineRun[] {
    return this.pipelineHistory.slice(-limit).reverse();
  }

  getLatestRun(): PipelineRun | undefined {
    return this.pipelineHistory[this.pipelineHistory.length - 1];
  }

  // ─── Direct agent access ─────────────────────────────────────────────────────

  async generateTests(input: GenerateTestsInput): Promise<GenerateTestsOutput> {
    this.log.info('Generating tests', { filePath: input.filePath });
    const output = await this.testGenerator.generateTests(input);
    this.knowledgeBase.learnFromTests(output.tests, input.filePath);
    return output;
  }

  async runTests(input: RunTestsInput): Promise<RunTestsOutput> {
    this.log.info('Running tests', { command: input.command });
    return this.testRunner.runTests(input);
  }

  async analyzeBugs(input: AnalyzeBugsInput): Promise<AnalyzeBugsOutput> {
    this.log.info('Analyzing bugs', { filePath: input.filePath });
    const output = await this.bugAnalyzer.analyzeBugs(input);
    this.knowledgeBase.learnFromBugs(output.bugs, input.filePath);
    return output;
  }

  async analyzeCoverage(input: AnalyzeCoverageInput): Promise<AnalyzeCoverageOutput> {
    this.log.info('Analyzing coverage');
    const output = await this.coverageAgent.analyzeCoverage(input);
    this.knowledgeBase.learnFromCoverage(output.report);
    return output;
  }

  async reviewCode(input: ReviewCodeInput): Promise<ReviewCodeOutput> {
    this.log.info('Reviewing code', { filePath: input.filePath });
    const output = await this.reviewAgent.reviewCode(input);
    this.knowledgeBase.learnFromReview(output.review);
    return output;
  }

  async scanSecurity(code: string, filePath?: string): Promise<SecurityReport> {
    this.log.info('Scanning security', { filePath });
    return this.securityAgent.generateSecurityReport(code, filePath);
  }

  async analyzePerformance(code: string, language?: string): Promise<PerformanceAnalysis> {
    this.log.info('Analyzing performance');
    return this.performanceAgent.analyze(code, language);
  }

  // ─── Shutdown ─────────────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this.log.info('Orchestrator shutting down...');
    this.knowledgeBase.flush();
    this.log.info('Orchestrator shutdown complete');
  }

  // ─── Health ──────────────────────────────────────────────────────────────────

  health(): Record<string, unknown> {
    return {
      status: 'ok',
      model: this.config.model,
      knowledgeBase: this.knowledgeBase.stats(),
      pipelineRuns: this.pipelineHistory.length,
      agents: {
        testGenerator: this.testGenerator.getStatus(),
        testRunner: this.testRunner.getStatus(),
        bugAnalyzer: this.bugAnalyzer.getStatus(),
        coverageAgent: this.coverageAgent.getStatus(),
        reviewAgent: this.reviewAgent.getStatus(),
        securityAgent: this.securityAgent.getStatus(),
        performanceAgent: this.performanceAgent.getStatus(),
        healerAgent: this.healerAgent.getStatus(),
      },
    };
  }
}

export { PipelineRunner };
