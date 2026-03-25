import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { Orchestrator } from '@aurora-qa/core';
import { logger } from '@aurora-qa/core';
import type { DashboardStore } from '../store.js';

export type WSEventType =
  | 'ping'
  | 'pipeline:started'
  | 'pipeline:completed'
  | 'pipeline:step-started'
  | 'pipeline:step-completed'
  | 'pipeline:step-skipped'
  | 'agent:status-change'
  | 'agent:tool-call'
  | 'store:updated'
  | 'stats:updated';

export interface WSMessage {
  type: WSEventType;
  payload: unknown;
  timestamp: string;
}

const log = logger.child('websocket');

export function createWebSocketServer(
  httpServer: Server,
  orchestrator: Orchestrator,
  store: DashboardStore,
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const broadcast = (type: WSEventType, payload: unknown): void => {
    const msg: WSMessage = { type, payload, timestamp: new Date().toISOString() };
    const data = JSON.stringify(msg);
    let sent = 0;
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
        sent++;
      }
    }
    if (sent > 0) log.debug(`Broadcast ${type} to ${sent} clients`);
  };

  // ─── Orchestrator events ────────────────────────────────────────────────────

  orchestrator.on('pipeline:started', run => {
    store.savePipelineRun(run);
    broadcast('pipeline:started', run);
  });

  orchestrator.on('pipeline:completed', run => {
    store.savePipelineRun(run);
    broadcast('pipeline:completed', run);
    broadcast('stats:updated', store.getStats());
  });

  orchestrator.on('pipeline:step-started', e => {
    broadcast('pipeline:step-started', e);
  });

  orchestrator.on('pipeline:step-completed', e => {
    broadcast('pipeline:step-completed', e);
  });

  orchestrator.on('pipeline:step-skipped', e => {
    broadcast('pipeline:step-skipped', e);
  });

  // Forward agent events
  const agents = [
    orchestrator.testGenerator,
    orchestrator.testRunner,
    orchestrator.bugAnalyzer,
    orchestrator.coverageAgent,
    orchestrator.reviewAgent,
  ];

  for (const agent of agents) {
    agent.on('status-change', (e: unknown) => broadcast('agent:status-change', e));
    agent.on('tool-call', (e: unknown) => broadcast('agent:tool-call', e));
  }

  // ─── Client connection handling ─────────────────────────────────────────────

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress ?? 'unknown';
    log.info(`Client connected`, { ip: clientIp, total: wss.clients.size });

    // Send initial state
    ws.send(
      JSON.stringify({
        type: 'stats:updated',
        payload: store.getStats(),
        timestamp: new Date().toISOString(),
      }),
    );

    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string };
        if (msg.type === 'ping') {
          ws.send(
            JSON.stringify({ type: 'ping', payload: { pong: true }, timestamp: new Date().toISOString() }),
          );
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      log.debug(`Client disconnected`, { ip: clientIp, total: wss.clients.size });
    });

    ws.on('error', err => {
      log.error('WebSocket client error', err);
    });
  });

  // Heartbeat — ping all clients every 30s to detect stale connections
  const heartbeat = setInterval(() => {
    broadcast('ping', { clients: wss.clients.size });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  log.info('WebSocket server attached at /ws');
  return wss;
}
