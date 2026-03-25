import type { ChaosIntensity } from '../types/index.js';

interface InjectionRecord {
  type: string;
  config: Record<string, unknown>;
  originalFn?: (...args: unknown[]) => unknown;
  cleanup?: () => void;
  createdAt: Date;
}

export class ChaosEngine {
  private activeInjections: Map<string, InjectionRecord> = new Map();
  private originalFetch: typeof globalThis.fetch | null = null;
  private originalDateNow: (() => number) | null = null;
  private originalSetTimeout: typeof globalThis.setTimeout | null = null;

  injectNetworkLatency(ms: number, probability = 0.5): void {
    if (this.activeInjections.has('network-latency')) return;

    this.originalFetch ??= globalThis.fetch;
    const origFetch = this.originalFetch;

    const latencyFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      if (Math.random() < probability) {
        await new Promise(resolve => setTimeout(resolve, ms));
      }
      return origFetch(input, init);
    };

    globalThis.fetch = latencyFetch as typeof globalThis.fetch;

    this.activeInjections.set('network-latency', {
      type: 'network-latency',
      config: { ms, probability },
      cleanup: () => {
        if (this.originalFetch) globalThis.fetch = this.originalFetch;
      },
      createdAt: new Date(),
    });
  }

  injectNetworkFailure(probability = 0.3): void {
    if (this.activeInjections.has('network-failure')) return;

    this.originalFetch ??= globalThis.fetch;
    const origFetch = this.originalFetch;

    const failingFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      if (Math.random() < probability) {
        throw new Error('ChaosEngine: Network failure injected');
      }
      return origFetch(input, init);
    };

    globalThis.fetch = failingFetch as typeof globalThis.fetch;

    this.activeInjections.set('network-failure', {
      type: 'network-failure',
      config: { probability },
      cleanup: () => {
        if (this.originalFetch) globalThis.fetch = this.originalFetch;
      },
      createdAt: new Date(),
    });
  }

  injectCPUStress(intensity: ChaosIntensity = 'mild', durationMs = 1000): void {
    if (this.activeInjections.has('cpu-stress')) return;

    const iterations: Record<ChaosIntensity, number> = {
      mild: 1_000_000,
      moderate: 10_000_000,
      severe: 100_000_000,
    };

    const iters = iterations[intensity];
    let cancelled = false;

    const stress = () => {
      if (cancelled) return;
      const start = Date.now();
      while (Date.now() - start < durationMs) {
        let sum = 0;
        for (let i = 0; i < iters / 100; i++) sum += Math.sqrt(i);
        void sum;
        if (cancelled) break;
      }
    };

    // Run asynchronously to not block the current execution
    setTimeout(stress, 0);

    this.activeInjections.set('cpu-stress', {
      type: 'cpu-stress',
      config: { intensity, durationMs },
      cleanup: () => { cancelled = true; },
      createdAt: new Date(),
    });
  }

  injectMemoryPressure(mb: number): void {
    if (this.activeInjections.has('memory-pressure')) return;

    // Allocate buffers to simulate memory pressure
    const buffers: Buffer[] = [];
    const chunkSize = 1024 * 1024; // 1MB
    for (let i = 0; i < mb; i++) {
      buffers.push(Buffer.alloc(chunkSize, 0));
    }

    this.activeInjections.set('memory-pressure', {
      type: 'memory-pressure',
      config: { mb },
      cleanup: () => { buffers.length = 0; },
      createdAt: new Date(),
    });
  }

  injectRandomError(probability = 0.1, errorType = 'Error'): void {
    if (this.activeInjections.has('random-error')) return;

    this.activeInjections.set('random-error', {
      type: 'random-error',
      config: { probability, errorType },
      createdAt: new Date(),
    });
  }

  shouldThrowRandomError(): boolean {
    const injection = this.activeInjections.get('random-error');
    if (!injection) return false;
    return Math.random() < (injection.config['probability'] as number);
  }

  injectTimeSkew(offsetMs: number): void {
    if (this.activeInjections.has('time-skew')) return;

    this.originalDateNow ??= Date.now;
    const origNow = this.originalDateNow;

    Date.now = () => origNow() + offsetMs;

    this.activeInjections.set('time-skew', {
      type: 'time-skew',
      config: { offsetMs },
      cleanup: () => {
        if (this.originalDateNow) Date.now = this.originalDateNow;
      },
      createdAt: new Date(),
    });
  }

  reset(): void {
    for (const injection of this.activeInjections.values()) {
      injection.cleanup?.();
    }
    this.activeInjections.clear();
    this.originalFetch = null;
    this.originalDateNow = null;
    this.originalSetTimeout = null;
  }

  getActiveInjections(): Array<{ type: string; config: Record<string, unknown>; createdAt: Date }> {
    return Array.from(this.activeInjections.values()).map(i => ({
      type: i.type,
      config: i.config,
      createdAt: i.createdAt,
    }));
  }

  get activeCount(): number {
    return this.activeInjections.size;
  }
}
