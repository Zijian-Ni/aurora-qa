import type Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './base-agent.js';
import type { AuroraConfig, ChaosConfig, ChaosExperiment, ChaosReport } from '../types/index.js';
import { ChaosEngine } from '../chaos/index.js';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'design_experiment',
    description: 'Design a chaos experiment',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['network-latency', 'network-failure', 'cpu-stress', 'memory-pressure', 'random-error', 'time-skew'] },
        description: { type: 'string' },
        config: { type: 'object', description: 'Experiment configuration' },
      },
      required: ['type', 'description', 'config'],
    },
  },
  {
    name: 'analyze_resilience',
    description: 'Analyze system resilience based on chaos results',
    input_schema: {
      type: 'object' as const,
      properties: {
        score: { type: 'number', description: 'Resilience score 0-10' },
        findings: { type: 'array', items: { type: 'string' } },
        recommendations: { type: 'array', items: { type: 'string' } },
      },
      required: ['score', 'findings', 'recommendations'],
    },
  },
];

const SYSTEM_PROMPT = `You are Aurora's Chaos Agent — a chaos engineering expert.

You design chaos experiments to test system resilience. Available chaos injections:
- network-latency: Add artificial delay to network calls
- network-failure: Randomly fail network calls
- cpu-stress: Block the event loop to simulate CPU pressure
- memory-pressure: Allocate memory to simulate pressure
- random-error: Inject random errors in function calls
- time-skew: Offset Date.now() and timers

Process:
1. Analyze the system description
2. Design appropriate chaos experiments with design_experiment
3. After experiments run, analyze results with analyze_resilience`;

export class ChaosAgent extends BaseAgent {
  readonly engine: ChaosEngine;
  private experiments: ChaosExperiment[] = [];
  private resilienceScore = 0;
  private recommendations: string[] = [];

  constructor(config: AuroraConfig) {
    super({
      role: 'chaos-agent',
      name: 'ChaosAgent',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      config,
    });
    this.engine = new ChaosEngine();
  }

  async designChaosExperiment(systemDescription: string): Promise<ChaosConfig> {
    this.experiments = [];
    this.clearHistory();

    const prompt = [
      `Design chaos experiments for this system:`,
      ``,
      systemDescription,
      ``,
      `Call design_experiment for each chaos scenario. Design 3-5 experiments.`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 10 });

    return {
      experiments: this.experiments,
      duration: 30000,
      targetResilience: 7,
    };
  }

  async analyzeResiliency(
    testResults: Record<string, unknown>,
    chaosReport: Record<string, unknown>,
  ): Promise<{ score: number; recommendations: string[] }> {
    this.resilienceScore = 0;
    this.recommendations = [];
    this.clearHistory();

    const prompt = [
      `Analyze system resilience from these chaos test results.`,
      ``,
      `**Test Results:**`,
      '```json',
      JSON.stringify(testResults, null, 2),
      '```',
      ``,
      `**Chaos Report:**`,
      '```json',
      JSON.stringify(chaosReport, null, 2),
      '```',
      ``,
      `Call analyze_resilience with your assessment.`,
    ].join('\n');

    await this.runLoop(prompt, { maxIterations: 6 });

    return { score: this.resilienceScore, recommendations: this.recommendations };
  }

  generateResiliencyReport(
    experiments: ChaosExperiment[],
    score: number,
    recommendations: string[],
  ): string {
    const lines = [
      `# Chaos Engineering — Resiliency Report`,
      ``,
      `**Resilience Score:** ${score}/10`,
      `**Experiments Run:** ${experiments.length}`,
      `**Generated:** ${new Date().toISOString()}`,
      ``,
      `## Experiments`,
      ``,
    ];

    for (const exp of experiments) {
      lines.push(`### ${exp.type}`);
      lines.push(exp.description);
      lines.push(`Config: ${JSON.stringify(exp.config)}`);
      lines.push('');
    }

    lines.push(`## Recommendations`, ``);
    for (const rec of recommendations) {
      lines.push(`- ${rec}`);
    }

    return lines.join('\n');
  }

  protected async handleToolCall(
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'design_experiment': {
        this.experiments.push({
          type: input['type'] as ChaosExperiment['type'],
          description: String(input['description'] ?? ''),
          config: (input['config'] as Record<string, unknown>) ?? {},
        });
        return { success: true, experimentCount: this.experiments.length };
      }
      case 'analyze_resilience': {
        this.resilienceScore = Number(input['score'] ?? 0);
        this.recommendations = (input['recommendations'] as string[]) ?? [];
        return { success: true };
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
