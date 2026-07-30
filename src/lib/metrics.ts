/**
 * M7.6F — In-Memory Metrics Collector
 *
 * Simple counters, gauges, and histograms for application monitoring.
 * Designed for Prometheus-compatible export.
 *
 * Usage:
 *   import { metrics } from '@/lib/metrics';
 *   metrics.increment('api.requests', { method: 'GET', path: '/api/health' });
 *   metrics.timing('api.latency', durationMs, { path: '/api/health' });
 *   metrics.gauge('queue.depth', 42, { queue: 'report-delivery' });
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetricPoint {
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

interface Counter {
  type: 'counter';
  values: Map<string, number>;
}

interface Gauge {
  type: 'gauge';
  values: Map<string, MetricPoint>;
}

interface Histogram {
  type: 'histogram';
  values: Map<string, number[]>;
}

type Metric = Counter | Gauge | Histogram;

// ─── Metrics Collector ───────────────────────────────────────────────────────

class MetricsCollector {
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();
  private histograms = new Map<string, Histogram>();
  private startTime = Date.now();

  /**
   * Increment a counter metric.
   */
  increment(name: string, labels: Record<string, string> = {}, amount = 1): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, { type: 'counter', values: new Map() });
    }
    const counter = this.counters.get(name)!;
    const key = this.labelsKey(labels);
    counter.values.set(key, (counter.values.get(key) ?? 0) + amount);
  }

  /**
   * Set a gauge metric (current value).
   */
  gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, { type: 'gauge', values: new Map() });
    }
    const gauge = this.gauges.get(name)!;
    gauge.values.set(this.labelsKey(labels), { value, labels, timestamp: Date.now() });
  }

  /**
   * Record a timing observation (histogram).
   */
  timing(name: string, durationMs: number, labels: Record<string, string> = {}): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, { type: 'histogram', values: new Map() });
    }
    const hist = this.histograms.get(name)!;
    const key = this.labelsKey(labels);
    if (!hist.values.has(key)) hist.values.set(key, []);
    const arr = hist.values.get(key)!;
    arr.push(durationMs);
    // Keep last 1000 observations to bound memory
    if (arr.length > 1000) arr.splice(0, arr.length - 1000);
  }

  /**
   * Export all metrics as a JSON object.
   */
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      counters: {} as Record<string, any>,
      gauges: {} as Record<string, any>,
      histograms: {} as Record<string, any>,
    };

    for (const [name, counter] of this.counters) {
      result.counters[name] = Object.fromEntries(counter.values);
    }

    for (const [name, gauge] of this.gauges) {
      result.gauges[name] = {};
      for (const [key, point] of gauge.values) {
        result.gauges[name][key] = point.value;
      }
    }

    for (const [name, hist] of this.histograms) {
      result.histograms[name] = {};
      for (const [key, values] of hist.values) {
        const sorted = [...values].sort((a, b) => a - b);
        result.histograms[name][key] = {
          count: values.length,
          min: sorted[0] ?? 0,
          max: sorted[sorted.length - 1] ?? 0,
          avg: values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
          p50: this.percentile(sorted, 50),
          p95: this.percentile(sorted, 95),
          p99: this.percentile(sorted, 99),
        };
      }
    }

    return result;
  }

  /**
   * Export as Prometheus text format.
   */
  toPrometheus(): string {
    const lines: string[] = [];

    for (const [name, counter] of this.counters) {
      const metricName = name.replace(/\./g, '_');
      lines.push(`# TYPE ${metricName}_total counter`);
      for (const [key, value] of counter.values) {
        lines.push(`${metricName}_total{${key}} ${value}`);
      }
    }

    for (const [name, gauge] of this.gauges) {
      const metricName = name.replace(/\./g, '_');
      lines.push(`# TYPE ${metricName} gauge`);
      for (const [key, point] of gauge.values) {
        lines.push(`${metricName}{${key}} ${point.value}`);
      }
    }

    for (const [name, hist] of this.histograms) {
      const metricName = name.replace(/\./g, '_');
      for (const [key, values] of hist.values) {
        const sorted = [...values].sort((a, b) => a - b);
        lines.push(`# TYPE ${metricName} summary`);
        lines.push(`${metricName}_count{${key}} ${values.length}`);
        lines.push(`${metricName}{${key},quantile="0.5"} ${this.percentile(sorted, 50)}`);
        lines.push(`${metricName}{${key},quantile="0.95"} ${this.percentile(sorted, 95)}`);
        lines.push(`${metricName}{${key},quantile="0.99"} ${this.percentile(sorted, 99)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private labelsKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const metrics = new MetricsCollector();
export { MetricsCollector };
