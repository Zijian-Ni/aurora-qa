/**
 * Simple HTTP service to stress-test with chaos engineering.
 */
export class TargetService {
  private data = new Map<string, unknown>();

  async handleRequest(method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
    try {
      switch (`${method} ${path}`) {
        case 'GET /health':
          return { status: 200, body: { status: 'ok', uptime: process.uptime() } };

        case 'GET /data':
          return { status: 200, body: Object.fromEntries(this.data) };

        case 'POST /data': {
          const id = crypto.randomUUID();
          this.data.set(id, body);
          return { status: 201, body: { id } };
        }

        case 'GET /slow':
          // Simulate slow endpoint
          await new Promise(r => setTimeout(r, 500));
          return { status: 200, body: { message: 'slow response' } };

        case 'GET /unreliable':
          // 30% failure rate
          if (Math.random() < 0.3) {
            throw new Error('Random failure');
          }
          return { status: 200, body: { message: 'success' } };

        default:
          return { status: 404, body: { error: 'Not found' } };
      }
    } catch (err) {
      return { status: 500, body: { error: err instanceof Error ? err.message : 'Unknown error' } };
    }
  }
}
