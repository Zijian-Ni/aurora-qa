import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChaosEngine } from '../index.js';

describe('ChaosEngine', () => {
  let engine: ChaosEngine;

  beforeEach(() => {
    engine = new ChaosEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  it('should start with no active injections', () => {
    expect(engine.activeCount).toBe(0);
    expect(engine.getActiveInjections()).toEqual([]);
  });

  it('should inject and track network latency', () => {
    engine.injectNetworkLatency(100, 0.5);
    expect(engine.activeCount).toBe(1);
    const active = engine.getActiveInjections();
    expect(active[0]!.type).toBe('network-latency');
    expect(active[0]!.config).toEqual({ ms: 100, probability: 0.5 });
  });

  it('should inject and track network failure', () => {
    engine.injectNetworkFailure(0.3);
    expect(engine.activeCount).toBe(1);
    const active = engine.getActiveInjections();
    expect(active[0]!.type).toBe('network-failure');
  });

  it('should inject time skew', () => {
    const realNow = Date.now();
    engine.injectTimeSkew(60000);
    const skewedNow = Date.now();
    expect(skewedNow - realNow).toBeGreaterThan(50000);
    engine.reset();
    // After reset, Date.now should be close to real time
    const afterReset = Date.now();
    expect(Math.abs(afterReset - realNow)).toBeLessThan(5000);
  });

  it('should inject memory pressure', () => {
    engine.injectMemoryPressure(1); // 1MB
    expect(engine.activeCount).toBe(1);
  });

  it('should support random error injection', () => {
    engine.injectRandomError(1.0); // 100% probability
    expect(engine.shouldThrowRandomError()).toBe(true);
    engine.reset();
    expect(engine.shouldThrowRandomError()).toBe(false);
  });

  it('should not double-inject same type', () => {
    engine.injectNetworkLatency(100, 0.5);
    engine.injectNetworkLatency(200, 0.8);
    expect(engine.activeCount).toBe(1);
  });

  it('should reset all injections', () => {
    engine.injectNetworkLatency(100, 0.5);
    engine.injectNetworkFailure(0.3);
    engine.injectTimeSkew(1000);
    expect(engine.activeCount).toBe(3);

    engine.reset();
    expect(engine.activeCount).toBe(0);
  });

  it('should track multiple concurrent injections', () => {
    engine.injectNetworkLatency(100, 0.5);
    engine.injectNetworkFailure(0.2);
    engine.injectRandomError(0.1);
    engine.injectTimeSkew(5000);

    expect(engine.activeCount).toBe(4);
    const types = engine.getActiveInjections().map(i => i.type);
    expect(types).toContain('network-latency');
    expect(types).toContain('network-failure');
    expect(types).toContain('random-error');
    expect(types).toContain('time-skew');
  });
});
