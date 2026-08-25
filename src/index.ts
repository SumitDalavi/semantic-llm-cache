import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { embedText, buildCacheKeyHash, determineTtl } from './embeddings';
import { lookupSimilar, storeEntry, invalidateByKeyHash, getTotalEntryCount } from './cacheStore';
import { getRedis } from './cacheStore';
import { register, recordHit, recordMiss, getStats, cacheEntriesGauge } from './metrics';
import { ProxiedRequest, ProxiedResponse } from './types';
import logger from './logger';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = parseInt(process.env.PORT ?? '4000', 10);
const METRICS_PORT = parseInt(process.env.METRICS_PORT ?? '9090', 10);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Rough per-token costs for estimating savings
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0000025, output: 0.000010 },
  'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
  'claude-3-5-sonnet-20241022': { input: 0.000003, output: 0.000015 },
  'claude-haiku-20240307': { input: 0.00000025, output: 0.00000125 },
};

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '4mb' }));

// ───── Metrics endpoint (separate port) ─────
const metricsApp = express();
metricsApp.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});
metricsApp.listen(METRICS_PORT, () => {
  logger.info(`Prometheus metrics at :${METRICS_PORT}/metrics`);
});

// ───── Health ─────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ───── Main proxy — mirrors OpenAI chat completions API ─────
app.post('/v1/chat/completions', async (req, res): Promise<void> => {
  const startTime = Date.now();
  const body: ProxiedRequest = req.body;
  const model = body.model ?? 'gpt-4o-mini';
  const temperature = body.temperature ?? 0.7;
  const maxTokens = body.max_tokens ?? 1024;

  const systemMsg = body.messages.find(m => m.role === 'system')?.content ?? '';
  const userMsgs = body.messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
  const cacheKeyHash = buildCacheKeyHash(systemMsg, model, temperature, maxTokens);

  try {
    // 1. Embed the user prompt
    const embedding = await embedText(userMsgs);

    // 2. Check cache
    const lookup = await lookupSimilar(embedding, cacheKeyHash);

    if (lookup.hit && lookup.entry) {
      const latencyMs = Date.now() - startTime;
      const costs = MODEL_COSTS[model] ?? { input: 0, output: 0 };
      const costSaved = (costs.input * lookup.entry.inputTokens) + (costs.output * lookup.entry.outputTokens);

      recordHit(model, latencyMs, costSaved);

      const response: ProxiedResponse = {
        id: `chatcmpl-cache-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: lookup.entry.response },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: lookup.entry.inputTokens,
          completion_tokens: lookup.entry.outputTokens,
          total_tokens: lookup.entry.inputTokens + lookup.entry.outputTokens,
        },
        cache_hit: true,
        similarity_score: lookup.similarity,
        latency_ms: latencyMs,
        estimated_cost_saved: costSaved,
      };

      res.setHeader('X-Cache-Hit', 'true');
      res.setHeader('X-Cache-Similarity', (lookup.similarity ?? 0).toFixed(4));
      res.json(response);
      return;
    }

    // 3. Cache miss — forward to actual LLM
    let content: string;
    let promptTokens: number;
    let completionTokens: number;

    if (model.startsWith('claude-')) {
      const anthropicRes = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemMsg || undefined,
        messages: body.messages.filter(m => m.role !== 'system') as Anthropic.MessageParam[],
      });
      const block = anthropicRes.content[0];
      content = block.type === 'text' ? block.text : '';
      promptTokens = anthropicRes.usage.input_tokens;
      completionTokens = anthropicRes.usage.output_tokens;
    } else {
      const openaiRes = await openai.chat.completions.create({
        model,
        messages: body.messages,
        max_tokens: maxTokens,
        temperature,
      });
      content = openaiRes.choices[0]?.message?.content ?? '';
      promptTokens = openaiRes.usage?.prompt_tokens ?? 0;
      completionTokens = openaiRes.usage?.completion_tokens ?? 0;
    }

    const latencyMs = Date.now() - startTime;
    recordMiss(model, latencyMs);

    // 4. Store in cache (non-blocking)
    const ttl = determineTtl(userMsgs);
    const provider = model.startsWith('claude-') ? 'anthropic' : 'openai';
    storeEntry(userMsgs, embedding, content, model, provider, promptTokens, completionTokens, cacheKeyHash, ttl, {
      systemPromptHash: cacheKeyHash,
      model,
      temperature,
      maxTokens,
    }).then(async () => {
      cacheEntriesGauge.set(await getTotalEntryCount());
    }).catch(err => logger.error('Cache store failed', { error: err.message }));

    const response: ProxiedResponse = {
      id: `chatcmpl-${uuidv4()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
      cache_hit: false,
      latency_ms: latencyMs,
    };

    res.setHeader('X-Cache-Hit', 'false');
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Proxy request failed', { error: message });
    res.status(500).json({ error: message });
  }
});

// ───── Cache management endpoints ─────
app.get('/cache/stats', async (_req, res) => {
  const count = await getTotalEntryCount();
  res.json(getStats(count));
});

app.delete('/cache/invalidate/:keyHash', async (req, res) => {
  const count = await invalidateByKeyHash(req.params.keyHash);
  res.json({ invalidated: count });
});

app.listen(PORT, () => {
  logger.info(`Semantic LLM Cache proxy running on :${PORT}`);
  logger.info(`Drop-in replacement for OpenAI: point your base_url to http://localhost:${PORT}`);
});
