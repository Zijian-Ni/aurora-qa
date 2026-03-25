const AGENTS = [
  'TestGenerator', 'TestRunner', 'BugAnalyzer', 'CoverageAgent', 'ReviewAgent',
  'HealerAgent', 'SecurityAgent', 'PerformanceAgent', 'AccessibilityAgent',
  'ChaosAgent', 'MutationAgent', 'ContractAgent', 'PlaywrightAgent',
];

const STATUSES = ['idle', 'running', 'completed', 'idle'] as const;

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      intervalId = setInterval(() => {
        const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
        const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];

        const event = {
          id: crypto.randomUUID(),
          type: 'agent-status',
          payload: { name: agent, status },
          timestamp: new Date().toISOString(),
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }, 2000);
    },
    cancel() {
      clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
