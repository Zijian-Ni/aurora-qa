import { NextResponse } from 'next/server';

const MOCK_RUNS = Array.from({ length: 15 }, (_, i) => ({
  id: crypto.randomUUID(),
  intent: ['Full stack scan', 'Security audit', 'Quick check', 'API contract test', 'Chaos resilience'][i % 5],
  status: ['completed', 'completed', 'completed', 'failed', 'completed'][i % 5],
  duration: `${(Math.random() * 20 + 5).toFixed(1)}s`,
  timestamp: new Date(Date.now() - i * 3600000).toISOString(),
}));

export async function GET() {
  return NextResponse.json(MOCK_RUNS);
}

export async function POST(request: Request) {
  const body = await request.json();
  const run = {
    id: crypto.randomUUID(),
    intent: body.intent ?? 'Manual run',
    targetPath: body.targetPath ?? '.',
    status: 'running',
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(run, { status: 201 });
}
