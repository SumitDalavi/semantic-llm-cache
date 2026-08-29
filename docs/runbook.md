# Runbook — semantic-llm-cache
> Last updated: 2026-08-29

## Prerequisites
| Tool | Required Version | How to check |
|---|---|---|
| Node.js | >= 20 | `node -v` |
| Docker & Compose | Latest | `docker-compose version` |

## Quick Start
```bash
# Start Redis, Prometheus, Grafana, and the Proxy
docker-compose up -d

# Verify proxy is running
curl http://localhost:4000/health
```

## Run Tests
```bash
# Unit tests
npm test
```

Expected output:
```
PASS  __tests__/cache.test.ts
PASS  __tests__/embeddings.test.ts
```

## Environment Variables
| Variable | Default | Purpose |
|---|---|---|
| PORT | `4000` | HTTP port for the proxy |
| REDIS_URL | `redis://localhost:6379` | Redis connection |
| SIMILARITY_THRESHOLD | `0.95` | Cosine similarity threshold for a cache hit |
| OPENAI_API_KEY | - | Key for generating embeddings & upstream routing |

## Common Failure Modes
| Symptom | Cause | Fix |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:6379` | Redis is down | Run `docker-compose up -d redis` |
| `401 Unauthorized` | Missing OpenAI API Key | Ensure `OPENAI_API_KEY` is present in `.env` |
