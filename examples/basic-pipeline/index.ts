#!/usr/bin/env tsx
/**
 * Aurora QA — Basic Pipeline Example
 *
 * Demonstrates running a full QA pipeline on sample utility functions.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... npx tsx examples/basic-pipeline/index.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Orchestrator, loadConfig, createFullStackWebPipeline } from '@aurora-qa/core';

async function main() {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const config = loadConfig({ anthropicApiKey: apiKey });
  const orchestrator = new Orchestrator({ config });

  console.log('🚀 Aurora QA — Basic Pipeline Example\n');

  // Read sample code
  const samplePath = resolve(import.meta.dirname, 'sample-code.ts');
  const sourceCode = readFileSync(samplePath, 'utf8');

  console.log(`📄 Source: ${samplePath}`);
  console.log(`📏 Lines: ${sourceCode.split('\n').length}\n`);

  // Create and run pipeline
  const pipeline = createFullStackWebPipeline({
    sourceCode,
    filePath: samplePath,
    language: 'typescript',
  });

  console.log('▶ Running pipeline:', pipeline.name);
  console.log('  Steps:', pipeline.steps.map(s => s.name).join(' → '));
  console.log('');

  const run = await orchestrator.runPipeline(pipeline);

  console.log(`\n✅ Pipeline ${run.status}`);
  console.log(`⏱  Duration: ${run.durationMs}ms`);
  console.log(`📊 Results:`, JSON.stringify(run.results, null, 2));

  await orchestrator.shutdown();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
