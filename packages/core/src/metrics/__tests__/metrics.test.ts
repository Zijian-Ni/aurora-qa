import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../index.js';

describe('MetricsCollector', () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  // ─── Counter ───────────────────────────────────────────────────────────────

  it('should increment counter', () => {
    metrics.counter('requests_total');
    metrics.counter('requests_total');
    metrics.counter('requests_total');
    expect(metrics.getCounter('requests_total')).toBe(3);
  });

  it('should increment counter by custom amount', () => {
    metrics.counter('bytes_sent', undefined, 1024);
    metrics.counter('bytes_sent', undefined, 2048);
    expect(metrics.getCounter('bytes_sent')).toBe(3072);
  });

  it('should track counters with different labels independently', () => {
    metrics.counter('http_requests', { method: 'GET' });
    metrics.counter('http_requests', { method: 'POST' });
    metrics.counter('http_requests', { method: 'GET' });
    expect(metrics.getCounter('http_requests', { method: 'GET' })).toBe(2);
    expect(metrics.getCounter('http_requests', { method: 'POST' })).toBe(1);
  });

  // ─── Gauge ─────────────────────────────────────────────────────────────────

  it('should set gauge value', () => {
    metrics.gauge('cpu_usage', 0.75);
    expect(metrics.getGauge('cpu_usage')).toBe(0.75);
    metrics.gauge('cpu_usage', 0.5);
    expect(metrics.getGauge('cpu_usage')).toBe(0.5);
  });

  // ─── Histogram ─────────────────────────────────────────────────────────────

  it('should compute histogram percentiles', () => {
    for (let i = 1; i <= 100; i++) {
      metrics.histogram('response_time', i);
    }
    const h = metrics.getHistogram('response_time');
    expect(h.count).toBe(100);
    expect(h.p50).toBe(50);
    expect(h.p95).toBe(95);
    expect(h.p99).toBe(99);
  });

  it('should return zeros for empty histogram', () => {
    const h = metrics.getHistogram('nonexistent');
    expect(h).toEqual({ p50: 0, p95: 0, p99: 0, count: 0 });
  });

  // ─── Timer ─────────────────────────────────────────────────────────────────

  it('should record timer duration', () => {
    const stop = metrics.timer('op_duration');
    // Simulate some work
    for (let i = 0; i < 10000; i++) void 0;
    stop();
    const h = metrics.getHistogram('op_duration');
    expect(h.count).toBe(1);
    expect(h.p50).toBeGreaterThanOrEqual(0);
  });

  // ─── Export ────────────────────────────────────────────────────────────────

  it('should export Prometheus format', () => {
    metrics.counter('test_counter');
    metrics.gauge('test_gauge', 42);
    const output = metrics.export();
    expect(output).toContain('# TYPE test_counter counter');
    expect(output).toContain('test_counter 1');
    expect(output).toContain('# TYPE test_gauge gauge');
    expect(output).toContain('test_gauge 42');
  });

  it('should export histogram with quantiles', () => {
    metrics.histogram('latency', 10);
    metrics.histogram('latency', 20);
    const output = metrics.export();
    expect(output).toContain('# TYPE latency histogram');
    expect(output).toContain('latency_count');
    expect(output).toContain('latency_sum');
    expect(output).toContain('quantile="0.5"');
  });

  // ─── Reset ─────────────────────────────────────────────────────────────────

  it('should reset all metrics', () => {
    metrics.counter('a');
    metrics.gauge('b', 1);
    expect(metrics.size).toBe(2);
    metrics.reset();
    expect(metrics.size).toBe(0);
  });
});
