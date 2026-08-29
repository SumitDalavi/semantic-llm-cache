# Semantic Caching Layer for LLM APIs

> **Maturity:** Full Prototype
> _Semantic caching proxy for LLMs that detects semantically similar requests and serves cached responses instantly._

> **Cut LLM API costs 30–60% and reduce P95 latency to near-zero** with a drop-in semantic caching proxy that detects semantically similar requests and serves cached responses instantly.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=nodedotjs)](https://nodejs.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red?logo=redis)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## 🎯 The Problem This Solves

"What is Python?" and "Explain Python to me" should return the same cached response. But every naive cache misses this because it matches strings, not meaning. This proxy embeds every prompt using `text-embedding-3-small` and uses cosine similarity to detect semantically equivalent requests — serving cached answers at **<10ms** instead of 1–2 seconds.

## 🏗️ Architecture

```
Your App (unchanged, just change base_url)
      │
      ▼ POST /v1/chat/completions
┌─────────────────────┐
│   Semantic Proxy    │
│                     │
│  1. Embed prompt    │──► OpenAI text-embedding-3-small
│  2. Vector lookup   │──► Redis (cosine similarity scan)
│                     │
│  HIT (sim ≥ 0.95)   │──► Return cached response in <10ms
│  MISS               │──► Forward to LLM provider
│                     │──► Store response + embedding in Redis
└─────────────────────┘
      │
      ▼ :9090/metrics
┌─────────────────────┐
│   Prometheus        │──► Grafana Dashboard
│   hit rate, cost,   │    (real-time cost savings)
│   latency P50/P95   │
└─────────────────────┘
```

## 🛠️ Tech Stack

| Component | Technology | Why |
|---|---|---|
| Language | TypeScript 5.3 + Node.js 20 | Type safety, async-native |
| Proxy API | Express (OpenAI-compatible) | Drop-in replacement — zero app changes |
| Embeddings | OpenAI `text-embedding-3-small` | $0.02/1M tokens, 1536 dims, L2-normalized |
| Vector Store | Redis + ioredis (cosine scan) | Sub-millisecond lookups, LRU eviction |
| Metrics | `prom-client` → Prometheus → Grafana | Real-time hit rate & cost savings |
| Containerization | Docker + docker-compose | Full stack: proxy + Redis + Prometheus + Grafana |

## 🚀 Quick Start

### 1. Clone and configure
```bash
git clone https://github.com/SumitDalavi/semantic-llm-cache.git
cd semantic-llm-cache
cp .env.example .env
# Add OPENAI_API_KEY and ANTHROPIC_API_KEY to .env
```

### 2. Start the full stack
```bash
docker-compose up -d
```
- **Cache Proxy**: http://localhost:4000
- **Grafana Dashboard**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9091

### 3. Point your app at the proxy — zero code changes needed
```python
# Before
from openai import OpenAI
client = OpenAI(api_key="...")

# After — ONE line change
client = OpenAI(api_key="...", base_url="http://localhost:4000/v1")
```

### 4. Watch the savings accumulate
```bash
curl http://localhost:4000/cache/stats
```
```json
{
  "totalRequests": 2000,
  "cacheHits": 1240,
  "hitRate": 62.0,
  "totalCostSaved": 4.82,
  "avgHitLatencyMs": 8,
  "avgMissLatencyMs": 1340
}
```

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/completions` | OpenAI-compatible proxy endpoint |
| `GET` | `/cache/stats` | Hit rate, cost savings, latency breakdown |
| `DELETE` | `/cache/invalidate/:keyHash` | Invalidate all entries for a system prompt |
| `GET` | `/metrics` | Prometheus metrics (port 9090) |
| `GET` | `/health` | Health check |

### Response Headers
Every response includes cache metadata:
```
X-Cache-Hit: true
X-Cache-Similarity: 0.9734
```

## ⚙️ Cache Tuning

The key trade-off is **similarity threshold vs. hit rate**:

| Threshold | Hit Rate | Risk |
|---|---|---|
| 0.90 | Very high | Some semantically similar but subtly different prompts may share answers |
| **0.95** | **High** | **Safe default — recommended** |
| 0.98 | Low | Near-exact match only — safe but fewer savings |

Adjust in `.env`:
```
SIMILARITY_THRESHOLD=0.95
```

## 🧪 Tests

```bash
npm test
```

Tests cover cosine similarity, cache key hashing, and TTL determination — pure functions that don't require Redis or API keys.

## Mock Boundaries (Honest Scope)

| What | Status | Details |
|---|---|---|
| OpenAI API | **Optional** | Uses real `text-embedding-3-small` when key is present, otherwise falls back to dummy local embeddings for tests. |
| Redis Vector Store | **Real** | Uses real Redis via Docker Compose. |
| Prometheus/Grafana | **Real** | Full metrics stack running locally. |

## 📚 Documentation

- [Architecture](docs/architecture.md) — System diagram and component details
- [Runbook](docs/runbook.md) — Setup, commands, and expected outputs
- [Decisions](docs/decisions.md) — ADRs for cache pattern choices
- [Changelog](docs/changelog.md) — Change history

## 👨‍💻 Author

**Sumit Dalavi** — Senior DevSecOps / Platform Engineer  
[GitHub](https://github.com/SumitDalavi) · [LinkedIn](https://in.linkedin.com/in/sumit-dalavi-762838129)


## CI & Reliability Updates (August 2026)

- **CI Pipeline Remediation:** Successfully resolved all CI/CD pipeline failures and established baseline CI workflows.
- **Specific Fix:** Added and configured robust GitHub Actions workflows for automated testing, linting, and formatting.
- **Status:** 🟩 Passing


## 📄 Architecture & Design Decisions

See [`docs/architecture.md`](docs/architecture.md) for deep-dives on:
- Why linear scan instead of Redis Stack VSS
- How system prompt hashing prevents cross-contamination
- TTL auto-assignment strategy
- Near-miss analysis for threshold tuning