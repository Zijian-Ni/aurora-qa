import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import type { AuroraConfig, Orchestrator } from '@aurora-qa/core';
import { logger } from '@aurora-qa/core';
import { DashboardStore } from './store.js';
import { createRouter } from './routes/index.js';
import { createWebSocketServer } from './websocket/index.js';

const log = logger.child('dashboard');

export interface DashboardServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  store: DashboardStore;
}

export function createDashboardServer(
  orchestrator: Orchestrator,
  config: AuroraConfig,
): DashboardServer {
  const app = express();
  const store = new DashboardStore();

  // ─── Middleware ─────────────────────────────────────────────────────────────

  app.use(
    cors({
      origin: config.dashboard.corsOrigins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, _res, next) => {
    log.debug(`${req.method} ${req.path}`);
    next();
  });

  // ─── Routes ─────────────────────────────────────────────────────────────────

  app.use('/api/v1', createRouter(orchestrator, store));

  // Root info
  app.get('/', (_req, res) => {
    res.json({
      name: 'Aurora QA Dashboard',
      version: '1.0.0',
      endpoints: {
        api: '/api/v1',
        websocket: 'ws://<host>/ws',
        health: '/api/v1/health',
        stats: '/api/v1/stats',
        docs: 'See README for full API reference',
      },
    });
  });

  // 404
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      log.error('Unhandled error', err);
      res.status(500).json({
        error: process.env['NODE_ENV'] === 'production' ? 'Internal server error' : err.message,
      });
    },
  );

  // ─── HTTP + WebSocket server ─────────────────────────────────────────────────

  const httpServer = createServer(app);
  createWebSocketServer(httpServer, orchestrator, store);

  return {
    store,

    async start(): Promise<void> {
      return new Promise((resolve, reject) => {
        httpServer
          .listen(config.dashboard.port, config.dashboard.host, () => {
            log.info(
              `Dashboard running at http://${config.dashboard.host}:${config.dashboard.port}`,
            );
            log.info(
              `WebSocket at ws://${config.dashboard.host}:${config.dashboard.port}/ws`,
            );
            resolve();
          })
          .on('error', reject);
      });
    },

    async stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        httpServer.close(err => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
