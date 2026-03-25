#!/usr/bin/env tsx
/**
 * Aurora QA — Security Scan Example
 *
 * Demonstrates running the SecurityAgent on intentionally vulnerable code.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... npx tsx examples/security-scan/index.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SecurityAgent, loadConfig } from '@aurora-qa/core';

async function main() {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const config = loadConfig({ anthropicApiKey: apiKey });
  const agent = new SecurityAgent(config);

  console.log('🔒 Aurora QA — Security Scan Example\n');

  const codePath = resolve(import.meta.dirname, 'vulnerable-code.ts');
  const code = readFileSync(codePath, 'utf8');

  console.log(`📄 Scanning: ${codePath}\n`);

  // Run individual scans
  console.log('--- SQL Injection Scan ---');
  const sqlFindings = agent.scanForSQLInjection(code);
  console.log(`Found ${sqlFindings.length} issues`);
  sqlFindings.forEach(f => console.log(`  [${f.severity}] Line ${f.location.line}: ${f.description}`));

  console.log('\n--- XSS Scan ---');
  const xssFindings = agent.scanForXSS(code);
  console.log(`Found ${xssFindings.length} issues`);
  xssFindings.forEach(f => console.log(`  [${f.severity}] Line ${f.location.line}: ${f.description}`));

  console.log('\n--- Secrets Scan ---');
  const secretFindings = agent.scanForSecretsInCode(code);
  console.log(`Found ${secretFindings.length} issues`);
  secretFindings.forEach(f => console.log(`  [${f.severity}] Line ${f.location.line}: ${f.description}`));

  console.log('\n--- Full AI-Powered Report ---');
  const report = await agent.generateSecurityReport(code, codePath);
  console.log(`Risk Score: ${report.riskScore}/100`);
  console.log(`Total Findings: ${report.findings.length}`);
  console.log(`Summary: ${report.summary}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
