import Redis from 'ioredis';
import { CacheEntry, CacheLookupResult } from './types';
import { cosineSimilarity } from './embeddings';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

let redisClient: Redis;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      lazyConnect: false,
    });
    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('error', (err) => logger.error('Redis error', { error: err.message }));
  }
  return redisClient;
}

// Redis key prefixes
const CACHE_KEY_PREFIX = 'slc:entry:';
const INDEX_KEY = 'slc:index'; // Sorted set of all cache entry IDs

/**
 * Stores a cache entry. The embedding is stored as a JSON array in the entry hash.
 * Entry ID is also pushed to a sorted set for bulk operations.
 */
export async function storeEntry(
  promptText: string,
  embedding: number[],
  response: string,
  model: string,
  provider: string,
  inputTokens: number,
  outputTokens: number,
  cacheKeyHash: string,
  ttlSeconds: number,
  cacheKey: CacheEntry['cacheKey']
): Promise<string> {
  const redis = getRedis();
  const id = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  const entry: CacheEntry = {
    id,
    promptText: promptText.substring(0, 1000), // Store preview
    promptEmbedding: embedding,
    response,
    model,
    provider,
    inputTokens,
    outputTokens,
    cachedAt: now.toISOString(),
    expiresAt,
    hitCount: 0,
    cacheKey,
  };

  const key = `${CACHE_KEY_PREFIX}${cacheKeyHash}:${id}`;
  await redis.setex(key, ttlSeconds, JSON.stringify(entry));
  await redis.zadd(INDEX_KEY, Date.now(), key);

  logger.debug('Cache entry stored', { id, model, ttlSeconds });
  return id;
}

/**
 * Looks up the best matching cache entry for a given embedding.
 * Scans all entries with the same cacheKeyHash and finds the nearest neighbor by cosine similarity.
 *
 * Note: This is a linear scan — acceptable for < 10k entries.
 * For scale, replace with Redis Stack VSS (vector similarity search).
 */
export async function lookupSimilar(
  embedding: number[],
  cacheKeyHash: string
): Promise<CacheLookupResult> {
  const redis = getRedis();
  const threshold = parseFloat(process.env.SIMILARITY_THRESHOLD ?? '0.95');

  // Get all keys for this cacheKeyHash (same system prompt + model + params)
  const pattern = `${CACHE_KEY_PREFIX}${cacheKeyHash}:*`;
  const keys = await redis.keys(pattern);

  if (keys.length === 0) return { hit: false };

  let bestEntry: CacheEntry | null = null;
  let bestSimilarity = -1;

  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;

    const entry: CacheEntry = JSON.parse(raw);

    // Skip expired entries (Redis TTL should handle this but double-check)
    if (new Date(entry.expiresAt) < new Date()) continue;

    const similarity = cosineSimilarity(embedding, entry.promptEmbedding);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestEntry = entry;
    }
  }

  if (bestEntry && bestSimilarity >= threshold) {
    // Increment hit count
    const key = `${CACHE_KEY_PREFIX}${cacheKeyHash}:${bestEntry.id}`;
    const raw = await redis.get(key);
    if (raw) {
      const updated: CacheEntry = { ...JSON.parse(raw), hitCount: bestEntry.hitCount + 1 };
      const ttl = await redis.ttl(key);
      if (ttl > 0) await redis.setex(key, ttl, JSON.stringify(updated));
    }

    return { hit: true, entry: bestEntry, similarity: bestSimilarity };
  }

  return { hit: false, similarity: bestSimilarity };
}

/**
 * Invalidates all cache entries for a specific system prompt hash.
 */
export async function invalidateByKeyHash(cacheKeyHash: string): Promise<number> {
  const redis = getRedis();
  const pattern = `${CACHE_KEY_PREFIX}${cacheKeyHash}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length === 0) return 0;
  await redis.del(...keys);
  return keys.length;
}

export async function getTotalEntryCount(): Promise<number> {
  const redis = getRedis();
  const keys = await redis.keys(`${CACHE_KEY_PREFIX}*`);
  return keys.length;
}
