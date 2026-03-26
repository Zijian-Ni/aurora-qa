interface CounterMetric {
  type: 'counter';
  value: number;
  labels: Record<string, string>;
}

interface GaugeMetric {
  type: 'gauge';
  value: number;
  labels: Record<string, string>;
}

interface HistogramMetric {
  type: 'histogram';
  values: number[];
  labels: Record<string, string>;
}

type Metric = CounterMetric | GaugeMetric | HistogramMetric;

export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();

  private key(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return name;
    const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return `${name}{${sorted.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
  }

  counter(name: string, labels?: Record<string, string>, increment = 1): void {
    const k = this.key(name, labels);
    const existing = this.metrics.get(k);
    if (existing && existing.type === 'counter') {
      existing.value += increment;
    } else {
      this.metrics.set(k, { type: 'counter', value: increment, labels: labels ?? {} });
    }
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const k = this.key(name, labels);
    this.metrics.set(k, { type: 'gauge', value, labels: labels ?? {} });
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const k = this.key(name, labels);
    const existing = this.metrics.get(k);
    if (existing && existing.type === 'histogram') {
      existing.values.push(value);
    } else {
      this.metrics.set(k, { type: 'histogram', values: [value], labels: labels ?? {} });
    }
  }

  timer(name: string, labels?: Record<string, string>): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.histogram(name, duration, labels);
    };
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    const k = this.key(name, labels);
    const m = this.metrics.get(k);
    return m?.type === 'counter' ? m.value : 0;
  }

  getGauge(name: string, labels?: Record<string, string>): number {
    const k = this.key(name, labels);
    const m = this.metrics.get(k);
    return m?.type === 'gauge' ? m.value : 0;
  }

  getHistogram(name: string, labels?: Record<string, string>): { p50: number; p95: number; p99: number; count: number } {
    const k = this.key(name, labels);
    const m = this.metrics.get(k);
    if (!m || m.type !== 'histogram' || m.values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, count: 0 };
    }

    const sorted = [...m.values].sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.min(Math.ceil(sorted.length * p) - 1, sorted.length - 1)] ?? 0;
    return {
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      count: sorted.length,
    };
  }

  export(): string {
    const lines: string[] = [];

    for (const [key, metric] of this.metrics) {
      const name = key.split('{')[0];
      const labelsStr = key.includes('{') ? key.slice(key.indexOf('{')) : '';

      switch (metric.type) {
        case 'counter':
          lines.push(`# TYPE ${name} counter`);
          lines.push(`${name}${labelsStr} ${metric.value}`);
          break;
        case 'gauge':
          lines.push(`# TYPE ${name} gauge`);
          lines.push(`${name}${labelsStr} ${metric.value}`);
          break;
        case 'histogram': {
          const sorted = [...metric.values].sort((a, b) => a - b);
          const sum = sorted.reduce((a, b) => a + b, 0);
          lines.push(`# TYPE ${name} histogram`);
          lines.push(`${name}_count${labelsStr} ${sorted.length}`);
          lines.push(`${name}_sum${labelsStr} ${sum}`);
          for (const q of [0.5, 0.9, 0.95, 0.99]) {
            const idx = Math.min(Math.ceil(sorted.length * q) - 1, sorted.length - 1);
            const extraLabels = labelsStr.length > 2 ? ',' + labelsStr.slice(1, -1) : '';
            lines.push(`${name}{quantile="${q}"${extraLabels}} ${sorted[idx] ?? 0}`);
          }
          break;
        }
      }
    }

    return lines.join('\n') + '\n';
  }

  reset(): void {
    this.metrics.clear();
  }

  get size(): number {
    return this.metrics.size;
  }
}
