#!/usr/bin/env node
import { Orchestrator, loadConfig } from '@aurora-qa/core';
import { AuroraQAMCPServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.anthropicApiKey) {
    process.stderr.write(
      'ERROR: ANTHROPIC_API_KEY environment variable is required\n',
    );
    process.exit(1);
  }

  const orchestrator = new Orchestrator({ config });
  const server = new AuroraQAMCPServer(orchestrator, config);

  await server.start();
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
