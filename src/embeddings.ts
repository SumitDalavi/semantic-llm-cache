import OpenAI from 'openai';

// Lazy client — only instantiated when embedText() is called (not at import time)
// This allows pure utility functions below to be unit-tested without an API key.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const EMBEDDING_MODEL = (process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small') as 'text-embedding-3-small' | 'text-embedding-3-large';

/**
 * Generates a dense vector embedding for a given text.
 * Uses OpenAI text-embedding-3-small: cheap ($0.02/1M tokens), fast, 1536 dimensions.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.substring(0, 8000), // cap at 8k chars to avoid token limit errors
  });
  return response.data[0].embedding;
}

/**
 * Cosine similarity between two vectors.
 * Returns a value between -1 (opposite) and 1 (identical).
 * For normalized embeddings (OpenAI embeddings are L2-normalized), this is equivalent to dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Builds a normalized cache key string from request parameters.
 * Two requests with the same prompt but different system prompts must NOT share cache entries.
 */
export function buildCacheKeyHash(
  systemPrompt: string,
  model: string,
  temperature: number,
  maxTokens: number
): string {
  const crypto = require('crypto');
  const data = `${systemPrompt}|${model}|${temperature}|${maxTokens}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Determines the appropriate TTL for a cache entry based on prompt content.
 * Prompts referencing time-sensitive information should have shorter TTLs.
 */
export function determineTtl(prompt: string): number {
  const defaultTtl = parseInt(process.env.DEFAULT_TTL_SECONDS ?? '86400', 10);

  const timePatterns = /\b(today|yesterday|now|current|latest|recent|this week|this month|this year|\d{4})\b/i;
  if (timePatterns.test(prompt)) {
    return 3600; // 1 hour for time-sensitive queries
  }

  const stablePatterns = /\b(always|never|definition|what is|explain|how does)\b/i;
  if (stablePatterns.test(prompt)) {
    return 604800; // 7 days for stable factual queries
  }

  return defaultTtl;
}
