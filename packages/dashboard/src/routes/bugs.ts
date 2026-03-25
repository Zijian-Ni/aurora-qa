import { Router } from 'express';
import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import type { DashboardStore } from '../store.js';

const AnalyzeBugsSchema = z.object({
  code: z.string().min(1),
  filePath: z.string().min(1),
  language: z.string().optional(),
  context: z.string().optional(),
  errorMessage: z.string().optional(),
  testOutput: z.string().optional(),
});

const UpdateBugSchema = z.object({
  status: z.enum(['open', 'in-progress', 'resolved', 'wontfix', 'duplicate']).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  suggestedFix: z.string().optional(),
});

export function createBugsRouter(orchestrator: Orchestrator, store: DashboardStore): Router {
  const router = Router();

  // GET /bugs
  router.get('/', (req, res) => {
    const bugs = store.listBugs({
      filePath: req.query['filePath'] as string | undefined,
      severity: req.query['severity'] as string | undefined,
      status: req.query['status'] as string | undefined,
    });
    res.json(bugs);
  });

  // GET /bugs/:id
  router.get('/:id', (req, res) => {
    const bug = store.getBug(req.params['id'] ?? '');
    if (!bug) {
      res.status(404).json({ error: 'Bug not found' });
      return;
    }
    res.json(bug);
  });

  // PATCH /bugs/:id
  router.patch('/:id', (req, res) => {
    const result = UpdateBugSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation error', details: result.error.flatten() });
      return;
    }

    const updated = store.updateBug(req.params['id'] ?? '', result.data);
    if (!updated) {
      res.status(404).json({ error: 'Bug not found' });
      return;
    }
    res.json(updated);
  });

  // POST /bugs/analyze
  router.post('/analyze', async (req, res) => {
    const result = AnalyzeBugsSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation error', details: result.error.flatten() });
      return;
    }

    try {
      const output = await orchestrator.analyzeBugs(result.data);
      store.saveBugs(output.bugs);
      res.status(201).json({
        bugs: output.bugs,
        riskScore: output.riskScore,
        summary: output.summary,
        recommendations: output.recommendations,
        count: output.bugs.length,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /bugs/stats/summary
  router.get('/stats/summary', (req, res) => {
    const all = store.listBugs();
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const bug of all) {
      byStatus[bug.status] = (byStatus[bug.status] ?? 0) + 1;
      bySeverity[bug.severity] = (bySeverity[bug.severity] ?? 0) + 1;
    }

    res.json({
      total: all.length,
      byStatus,
      bySeverity,
      open: all.filter(b => b.status === 'open').length,
    });
  });

  return router;
}
