import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();
register.setDefaultLabels({ app: 'semantic-llm-cache' });

export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['model'] as const,
  registers: [register],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['model'] as const,
  registers: [register],
});

export const requestLatency = new Histogram({
  name: 'request_latency_ms',
  help: 'Request latency in milliseconds',
  labelNames: ['cache_status', 'model'] as const,
  buckets: [10, 50, 100, 250, 500, 1000, 2000, 5000],
  registers: [register],
});

export const costSavedTotal = new Counter({
  name: 'cost_saved_usd_total',
  help: 'Estimated total cost saved in USD from cache hits',
  registers: [register],
});

export const cacheEntriesGauge = new Gauge({
  name: 'cache_entries_total',
  help: 'Current number of entries in the cache',
  registers: [register],
});

export const similarityScoreHistogram = new Histogram({
  name: 'cache_similarity_score',
  help: 'Distribution of cosine similarity scores for cache lookups',
  buckets: [0.7, 0.8, 0.85, 0.9, 0.92, 0.95, 0.97, 0.99, 1.0],
  registers: [register],
});

// Track in-memory stats for /stats endpoint
interface StatsAccumulator {
  totalRequests: number;
  hits: number;
  misses: number;
  totalCostSaved: number;
  hitLatencies: number[];
  missLatencies: number[];
}

const stats: StatsAccumulator = {
  totalRequests: 0,
  hits: 0,
  misses: 0,
  totalCostSaved: 0,
  hitLatencies: [],
  missLatencies: [],
};

export function recordHit(model: string, latencyMs: number, costSaved: number): void {
  cacheHitsTotal.inc({ model });
  requestLatency.observe({ cache_status: 'hit', model }, latencyMs);
  costSavedTotal.inc(costSaved);
  stats.totalRequests++;
  stats.hits++;
  stats.totalCostSaved += costSaved;
  stats.hitLatencies.push(latencyMs);
}

export function recordMiss(model: string, latencyMs: number): void {
  cacheMissesTotal.inc({ model });
  requestLatency.observe({ cache_status: 'miss', model }, latencyMs);
  stats.totalRequests++;
  stats.misses++;
  stats.missLatencies.push(latencyMs);
}

export function getStats(cachedEntries: number) {
  const avg = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    totalRequests: stats.totalRequests,
    cacheHits: stats.hits,
    cacheMisses: stats.misses,
    hitRate: stats.totalRequests === 0 ? 0 : (stats.hits / stats.totalRequests) * 100,
    totalCostSaved: stats.totalCostSaved,
    avgHitLatencyMs: avg(stats.hitLatencies),
    avgMissLatencyMs: avg(stats.missLatencies),
    totalCachedEntries: cachedEntries,
  };
}
