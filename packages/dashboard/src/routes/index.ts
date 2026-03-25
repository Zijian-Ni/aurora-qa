import { Router } from 'express';
import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import type { DashboardStore } from '../store.js';
import { createPipelinesRouter } from './pipelines.js';
import { createTestsRouter } from './tests.js';
import { createBugsRouter } from './bugs.js';
import { createCoverageRouter } from './coverage.js';

const ReviewCodeSchema = z.object({
  code: z.string().min(1),
  filePath: z.string().min(1),
  language: z.string().optional(),
  context: z.string().optional(),
  strictness: z.enum(['lenient', 'standard', 'strict']).optional(),
  focusAreas: z
    .array(
      z.enum([
        'correctness',
        'security',
        'performance',
        'maintainability',
        'style',
        'testability',
        'documentation',
      ]),
    )
    .optional(),
});

const QueryKnowledgeSchema = z.object({
  query: z.string().min(1),
  type: z
    .enum(['test-pattern', 'bug-pattern', 'code-insight', 'fix-recipe', 'coverage-gap', 'review-pattern'])
    .optional(),
  limit: z.number().int().positive().max(20).optional(),
});

export function createRouter(orchestrator: Orchestrator, store: DashboardStore): Router {
  const router = Router();

  // Sub-routers
  router.use('/pipelines', createPipelinesRouter(orchestrator, store));
  router.use('/tests', createTestsRouter(orchestrator, store));
  router.use('/bugs', createBugsRouter(orchestrator, store));
  router.use('/coverage', createCoverageRouter(orchestrator, store));

  // ─── Reviews ────────────────────────────────────────────────────────────────

  router.get('/reviews', (req, res) => {
    const filePath = req.query['filePath'] as string | undefined;
    const limit = Number(req.query['limit'] ?? 50);
    res.json(store.listCodeReviews(filePath, limit));
  });

  router.get('/reviews/:id', (req, res) => {
    const review = store.getCodeReview(req.params['id'] ?? '');
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    res.json(review);
  });

  router.post('/reviews', async (req, res) => {
    const result = ReviewCodeSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation error', details: result.error.flatten() });
      return;
    }

    try {
      const output = await orchestrator.reviewCode(result.data);
      store.saveCodeReview(output.review);
      res.status(201).json(output);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ─── Knowledge ────────────────────────────────────────────────────────────────

  router.post('/knowledge/query', (req, res) => {
    const result = QueryKnowledgeSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation error', details: result.error.flatten() });
      return;
    }

    const results = orchestrator.knowledgeBase.query({
      query: result.data.query,
      type: result.data.type,
      limit: result.data.limit ?? 5,
    });

    res.json({
      count: results.length,
      results: results.map(r => ({
        id: r.entry.id,
        type: r.entry.type,
        similarity: Math.round(r.similarity * 100) / 100,
        content: r.entry.content.slice(0, 500),
        tags: r.entry.tags,
        metadata: r.entry.metadata,
      })),
    });
  });

  router.get('/knowledge/stats', (_req, res) => {
    res.json(orchestrator.knowledgeBase.stats());
  });

  // ─── Health ──────────────────────────────────────────────────────────────────

  router.get('/health', (_req, res) => {
    res.json(orchestrator.health());
  });

  // ─── Stats ───────────────────────────────────────────────────────────────────

  router.get('/stats', (_req, res) => {
    res.json(store.getStats());
  });

  return router;
}
