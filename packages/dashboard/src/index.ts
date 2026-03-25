import { Orchestrator, loadConfig, logger } from '@aurora-qa/core';
import { createDashboardServer } from './server.js';

const log = logger.child('main');

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.anthropicApiKey) {
    log.warn('ANTHROPIC_API_KEY not set — AI features will be unavailable');
  }

  const orchestrator = new Orchestrator({ config });
  const server = createDashboardServer(orchestrator, config);

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await server.stop();
      await orchestrator.shutdown();
      log.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      log.error('Error during shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('uncaughtException', err => {
    log.error('Uncaught exception', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
    process.exit(1);
  });

  await server.start();
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
