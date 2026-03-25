#!/usr/bin/env tsx
/**
 * Aurora QA — Chaos Resilience Example
 *
 * Demonstrates running chaos experiments against a target service.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... npx tsx examples/chaos-resilience/index.ts
 */
import { ChaosEngine, ChaosAgent, loadConfig } from '@aurora-qa/core';
import { TargetService } from './target-service.js';

async function main() {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🔥 Aurora QA — Chaos Resilience Example\n');

  const engine = new ChaosEngine();
  const service = new TargetService();

  // Test 1: Baseline
  console.log('--- Baseline (no chaos) ---');
  let results = await runRequests(service, 10);
  console.log(`Success rate: ${results.successRate}%, Avg latency: ${results.avgLatency.toFixed(1)}ms\n`);

  // Test 2: Network latency
  console.log('--- With Network Latency (100ms, 50% probability) ---');
  engine.injectNetworkLatency(100, 0.5);
  results = await runRequests(service, 10);
  console.log(`Success rate: ${results.successRate}%, Avg latency: ${results.avgLatency.toFixed(1)}ms`);
  engine.reset();
  console.log(`Active injections after reset: ${engine.activeCount}\n`);

  // Test 3: Time skew
  console.log('--- With Time Skew (+1 hour) ---');
  engine.injectTimeSkew(3600000);
  const now = Date.now();
  console.log(`Date.now() offset: ~${Math.round((now - (Date.now() - 3600000)) / 1000)}s`);
  engine.reset();

  // AI-designed experiments
  console.log('\n--- AI-Designed Chaos Experiments ---');
  const config = loadConfig({ anthropicApiKey: apiKey });
  const agent = new ChaosAgent(config);
  const chaosConfig = await agent.designChaosExperiment(
    'A REST API service with /health, /data (CRUD), /slow (500ms), and /unreliable (30% failure) endpoints',
  );

  console.log(`Designed ${chaosConfig.experiments.length} experiments:`);
  for (const exp of chaosConfig.experiments) {
    console.log(`  - ${exp.type}: ${exp.description}`);
  }

  console.log('\n✅ Chaos resilience testing complete');
}

async function runRequests(service: TargetService, count: number) {
  let successes = 0;
  let totalLatency = 0;

  for (let i = 0; i < count; i++) {
    const start = performance.now();
    const result = await service.handleRequest('GET', '/health');
    totalLatency += performance.now() - start;
    if (result.status === 200) successes++;
  }

  return {
    successRate: Math.round((successes / count) * 100),
    avgLatency: totalLatency / count,
  };
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
