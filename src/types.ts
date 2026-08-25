export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CacheKey {
  systemPromptHash: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface CacheEntry {
  id: string;
  promptText: string;
  promptEmbedding: number[];
  response: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cachedAt: string;
  expiresAt: string;
  hitCount: number;
  cacheKey: CacheKey;
}

export interface CacheLookupResult {
  hit: boolean;
  entry?: CacheEntry;
  similarity?: number;
}

export interface ProxiedRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ProxiedResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  // Custom fields
  cache_hit: boolean;
  similarity_score?: number;
  latency_ms: number;
  estimated_cost_saved?: number;
}

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  totalCostSaved: number;
  avgHitLatencyMs: number;
  avgMissLatencyMs: number;
  totalCachedEntries: number;
}
