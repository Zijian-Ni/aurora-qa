import { Router } from 'express';
import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import type { DashboardStore } from '../store.js';

const AnalyzeCoverageSchema = z.object({
  coverageJson: z.string().optional(),
  coverageSummary: z.string().optional(),
  thresholds: z
    .object({
      statements: z.number().min(0).max(100).optional(),
      branches: z.number().min(0).max(100).optional(),
      functions: z.number().min(0).max(100).optional(),
      lines: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

export function createCoverageRouter(orchestrator: Orchestrator, store: DashboardStore): Router {
  const router = Router();

  // GET /coverage
  router.get('/', (req, res) => {
    const limit = Number(req.query['limit'] ?? 20);
    res.json(store.listCoverageReports(limit));
  });

  // GET /coverage/latest
  router.get('/latest', (_req, res) => {
    const report = store.getLatestCoverageReport();
    if (!report) {
      res.status(404).json({ error: 'No coverage reports found' });
      return;
    }
    res.json(report);
  });

  // POST /coverage/analyze
  router.post('/analyze', async (req, res) => {
    const result = AnalyzeCoverageSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation error', details: result.error.flatten() });
      return;
    }

    try {
      const output = await orchestrator.analyzeCoverage(result.data);
      store.saveCoverageReport(output.report);
      res.status(201).json({
        report: output.report,
        gaps: output.gaps,
        suggestions: output.suggestions,
        prioritizedFiles: output.prioritizedFiles,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
