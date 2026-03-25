import { Router } from 'express';
import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import type { DashboardStore } from '../store.js';

const GenerateTestsSchema = z.object({
  sourceCode: z.string().min(1),
  filePath: z.string().min(1),
  framework: z.enum(['jest', 'vitest', 'mocha', 'jasmine', 'node:test']).optional(),
  maxTests: z.number().int().positive().optional(),
  focusAreas: z.array(z.string()).optional(),
  existingTests: z.string().optional(),
});

const RunTestsSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  timeout: z.number().int().positive().optional(),
});

export function createTestsRouter(orchestrator: Orchestrator, store: DashboardStore): Router {
  const router = Router();

  // GET /tests
  router.get('/', (req, res) => {
    const filePath = req.query['filePath'] as string | undefined;
    res.json(store.listTests(filePath));
  });

  // GET /tests/:id
  router.get('/:id', (req, res) => {
    const test = store.getTest(req.params['id'] ?? '');
    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }
    res.json(test);
  });

  // POST /tests/generate
  router.post('/generate', async (req, res) => {
    const result = GenerateTestsSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation error', details: result.error.flatten() });
      return;
    }

    try {
      const output = await orchestrator.generateTests(result.data);
      store.saveTests(output.tests);
      res.status(201).json({
        tests: output.tests,
        testCode: output.testCode,
        framework: output.framework,
        coverageTargets: output.coverage_targets,
        count: output.tests.length,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /tests/run
  router.post('/run', async (req, res) => {
    const result = RunTestsSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation error', details: result.error.flatten() });
      return;
    }

    try {
      const output = await orchestrator.runTests(result.data);
      store.saveTestResults(output.results);
      res.json({
        summary: output.summary,
        durationMs: output.durationMs,
        results: output.results,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /tests/results
  router.get('/results', (req, res) => {
    const runId = req.query['runId'] as string | undefined;
    const limit = Number(req.query['limit'] ?? 100);
    res.json(store.listTestResults(runId, limit));
  });

  return router;
}
