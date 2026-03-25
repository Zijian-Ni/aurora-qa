import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agents: [
      'TestGenerator', 'TestRunner', 'BugAnalyzer', 'CoverageAgent', 'ReviewAgent',
      'HealerAgent', 'SecurityAgent', 'PerformanceAgent', 'AccessibilityAgent',
      'ChaosAgent', 'MutationAgent', 'ContractAgent', 'PlaywrightAgent',
    ],
    uptime: process.uptime(),
    version: '1.1.0',
  });
}
