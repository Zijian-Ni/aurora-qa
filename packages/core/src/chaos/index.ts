import type { ChaosIntensity } from '../types/index.js';

interface InjectionRecord {
  type: string;
  config: Record<string, unknown>;
  originalFn?: (...args: unknown[]) => unknown;
  cleanup?: () => void;
  createdAt: Date;
}

/**
 * ChaosEngine — fault injection for resilience testing.
 *
 * Each instance maintains isolated state. Global-scope injections (fetch, Date.now)
 * are scoped via an instance-level proxy so multiple engines do not collide.
 */
export class ChaosEngine {
  private activeInjections: Map<string, InjectionRecord> = new Map();

  /** Per-instance fetch wrapper — does NOT touch globalThis.fetch directly. */
  private fetchInterceptors: Array<(input: string | URL | Request, init?: RequestInit) => Promise<Response | null>> = [];
  private installedFetchProxy = false;
  private static originalFetch: typeof globalThis.fetch | null = null;
  private static fetchInstances = new Set<ChaosEngine>();

  /** Per-instance Date.now offset — isolated, stacks are per-instance only. */
  private timeOffset = 0;
  private static originalDateNow: (() => number) | null = null;
  private static timeInstances = new Set<ChaosEngine>();

  // ─── Network Latency ───────────────────────────────────────────────────────

  injectNetworkLatency(ms: number, probability = 0.5): void {
    if (this.activeInjections.has('network-latency')) return;

    const interceptor = async (_input: string | URL | Request, _init?: RequestInit): Promise<Response | null> => {
      if (Math.random() < probability) {
        await new Promise(resolve => setTimeout(resolve, ms));
      }
      return null; // null = pass through to real fetch
    };

    this.fetchInterceptors.push(interceptor);
    this.installFetchProxy();

    this.activeInjections.set('network-latency', {
      type: 'network-latency',
      config: { ms, probability },
      cleanup: () => {
        const idx = this.fetchInterceptors.indexOf(interceptor);
        if (idx >= 0) this.fetchInterceptors.splice(idx, 1);
        this.maybeUninstallFetchProxy();
      },
      createdAt: new Date(),
    });
  }

  // ─── Network Failure ───────────────────────────────────────────────────────

  injectNetworkFailure(probability = 0.3): void {
    if (this.activeInjections.has('network-failure')) return;

    const interceptor = async (_input: string | URL | Request, _init?: RequestInit): Promise<Response | null> => {
      if (Math.random() < probability) {
        throw new Error('ChaosEngine: Network failure injected');
      }
      return null;
    };

    this.fetchInterceptors.push(interceptor);
    this.installFetchProxy();

    this.activeInjections.set('network-failure', {
      type: 'network-failure',
      config: { probability },
      cleanup: () => {
        const idx = this.fetchInterceptors.indexOf(interceptor);
        if (idx >= 0) this.fetchInterceptors.splice(idx, 1);
        this.maybeUninstallFetchProxy();
      },
      createdAt: new Date(),
    });
  }

  // ─── CPU Stress ────────────────────────────────────────────────────────────

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

    setTimeout(stress, 0);

    this.activeInjections.set('cpu-stress', {
      type: 'cpu-stress',
      config: { intensity, durationMs },
      cleanup: () => { cancelled = true; },
      createdAt: new Date(),
    });
  }

  // ─── Memory Pressure ──────────────────────────────────────────────────────

  injectMemoryPressure(mb: number): void {
    if (this.activeInjections.has('memory-pressure')) return;

    const buffers: Buffer[] = [];
    const chunkSize = 1024 * 1024;
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

  // ─── Random Error ──────────────────────────────────────────────────────────

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

  // ─── Time Skew ─────────────────────────────────────────────────────────────

  injectTimeSkew(offsetMs: number): void {
    if (this.activeInjections.has('time-skew')) return;

    this.timeOffset = offsetMs;
    this.installTimeProxy();

    this.activeInjections.set('time-skew', {
      type: 'time-skew',
      config: { offsetMs },
      cleanup: () => {
        this.timeOffset = 0;
        this.maybeUninstallTimeProxy();
      },
      createdAt: new Date(),
    });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  reset(): void {
    for (const injection of this.activeInjections.values()) {
      injection.cleanup?.();
    }
    this.activeInjections.clear();
    this.fetchInterceptors.length = 0;
    this.timeOffset = 0;
    this.maybeUninstallFetchProxy();
    this.maybeUninstallTimeProxy();
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

  // ─── Global proxy management (shared across instances) ─────────────────────

  private installFetchProxy(): void {
    if (this.installedFetchProxy) return;
    this.installedFetchProxy = true;
    ChaosEngine.fetchInstances.add(this);

    if (!ChaosEngine.originalFetch) {
      ChaosEngine.originalFetch = globalThis.fetch;
    }

    const origFetch = ChaosEngine.originalFetch;

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      // Run all registered instance interceptors
      for (const instance of ChaosEngine.fetchInstances) {
        for (const interceptor of instance.fetchInterceptors) {
          const result = await interceptor(input, init);
          if (result) return result;
        }
      }
      return origFetch(input, init);
    }) as typeof globalThis.fetch;
  }

  private maybeUninstallFetchProxy(): void {
    if (!this.installedFetchProxy) return;
    if (this.fetchInterceptors.length > 0) return;

    this.installedFetchProxy = false;
    ChaosEngine.fetchInstances.delete(this);

    if (ChaosEngine.fetchInstances.size === 0 && ChaosEngine.originalFetch) {
      globalThis.fetch = ChaosEngine.originalFetch;
      ChaosEngine.originalFetch = null;
    }
  }

  private installTimeProxy(): void {
    ChaosEngine.timeInstances.add(this);

    if (!ChaosEngine.originalDateNow) {
      ChaosEngine.originalDateNow = Date.now;
    }

    const origNow = ChaosEngine.originalDateNow;

    Date.now = () => {
      let totalOffset = 0;
      for (const instance of ChaosEngine.timeInstances) {
        totalOffset += instance.timeOffset;
      }
      return origNow() + totalOffset;
    };
  }

  private maybeUninstallTimeProxy(): void {
    ChaosEngine.timeInstances.delete(this);

    if (ChaosEngine.timeInstances.size === 0 && ChaosEngine.originalDateNow) {
      Date.now = ChaosEngine.originalDateNow;
      ChaosEngine.originalDateNow = null;
    }
  }
}
