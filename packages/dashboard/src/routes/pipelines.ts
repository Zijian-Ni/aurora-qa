import { Router } from 'express';
import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import type { DashboardStore } from '../store.js';

const CreatePipelineSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  steps: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(['generate-tests', 'run-tests', 'analyze-bugs', 'check-coverage', 'review-code']),
      name: z.string(),
      config: z.record(z.unknown()).default({}),
      dependsOn: z.array(z.string()).optional(),
      continueOnError: z.boolean().optional(),
      timeoutMs: z.number().positive().optional(),
    }),
  ),
  triggers: z
    .array(
      z.object({
        type: z.enum(['manual', 'schedule', 'git-push', 'pr-open', 'pr-update']),
        config: z.record(z.unknown()).optional(),
      }),
    )
    .default([{ type: 'manual' }]),
  environment: z.record(z.string()).default({}),
});

const RunPipelineSchema = z.object({
  trigger: z.enum(['manual', 'schedule', 'git-push', 'pr-open', 'pr-update']).default('manual'),
});

export function createPipelinesRouter(orchestrator: Orchestrator, store: DashboardStore): Router {
  const router = Router();

  // GET /pipelines
  router.get('/', (_req, res) => {
    res.json(store.listPipelines());
  });

  // POST /pipelines
  router.post('/', (req, res) => {
    const result = CreatePipelineSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation error', details: result.error.flatten() });
      return;
    }

    const config = {
      id: crypto.randomUUID(),
      ...result.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    store.savePipeline(config);
    res.status(201).json(config);
  });

  // GET /pipelines/:id
  router.get('/:id', (req, res) => {
    const pipeline = store.getPipeline(req.params['id'] ?? '');
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }
    res.json(pipeline);
  });

  // DELETE /pipelines/:id
  router.delete('/:id', (req, res) => {
    const deleted = store.deletePipeline(req.params['id'] ?? '');
    if (!deleted) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }
    res.status(204).end();
  });

  // POST /pipelines/:id/run
  router.post('/:id/run', async (req, res) => {
    const pipeline = store.getPipeline(req.params['id'] ?? '');
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }

    const result = RunPipelineSchema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({ error: 'Validation error', details: result.error.flatten() });
      return;
    }

    try {
      // Start async — return run ID immediately
      const runId = crypto.randomUUID();
      const pendingRun = {
        id: runId,
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        status: 'pending' as const,
        trigger: result.data.trigger,
        startedAt: new Date(),
        steps: pipeline.steps.map(s => ({
          stepId: s.id,
          stepType: s.type,
          stepName: s.name,
          status: 'pending' as const,
        })),
        results: {},
      };

      store.savePipelineRun(pendingRun);
      res.status(202).json({ runId, message: 'Pipeline run started' });

      // Execute in background
      orchestrator
        .runPipeline(pipeline, result.data.trigger)
        .then(run => store.savePipelineRun(run))
        .catch(err => {
          console.error('Pipeline run failed:', err);
        });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /pipelines/:id/runs
  router.get('/:id/runs', (req, res) => {
    const limit = Number(req.query['limit'] ?? 20);
    const runs = store.listPipelineRuns(req.params['id'], limit);
    res.json(runs);
  });

  // GET /pipelines/runs/:runId
  router.get('/runs/:runId', (req, res) => {
    const run = store.getPipelineRun(req.params['runId'] ?? '');
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(run);
  });

  return router;
}
