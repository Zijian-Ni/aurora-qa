import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import { ChaosAgent, loadConfig } from '@aurora-qa/core';

export const DesignChaosSchema = z.object({
  systemDescription: z.string().describe('Description of the system to test'),
  targetResilience: z.number().min(0).max(10).optional().describe('Target resilience score (0-10)'),
});

export const GetChaosReportSchema = z.object({
  runId: z.string().describe('ID of the chaos run to get report for'),
});

export function createChaosTools(_orchestrator: Orchestrator) {
  return {
    design_chaos_experiment: {
      description: 'Design chaos engineering experiments to test system resilience.',
      inputSchema: DesignChaosSchema,
      async handler(input: z.infer<typeof DesignChaosSchema>) {
        const agent = new ChaosAgent(loadConfig());
        const config = await agent.designChaosExperiment(input.systemDescription);
        return {
          experiments: config.experiments.map(e => ({
            type: e.type,
            description: e.description,
            config: e.config,
          })),
          duration: config.duration,
          targetResilience: input.targetResilience ?? config.targetResilience,
        };
      },
    },

    get_chaos_report: {
      description: 'Generate a chaos engineering resilience report.',
      inputSchema: GetChaosReportSchema,
      async handler(input: z.infer<typeof GetChaosReportSchema>) {
        const agent = new ChaosAgent(loadConfig());
        const report = agent.generateResiliencyReport([], 0, ['Run chaos experiments first']);
        return { runId: input.runId, report };
      },
    },
  };
}
