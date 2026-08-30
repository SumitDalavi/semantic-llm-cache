# ADR-003: Vector Store Choice

## Status: Accepted

## Context
Semantic caching requires computing cosine similarities between vectors. We must choose a datastore or algorithm to hold and query these vectors.

## Decision
We chose a **Redis-backed linear scan approach** for datasets under 10,000 cached prompts, avoiding heavy specialized vector databases.

## Alternatives Considered
| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| Pinecone / Milvus / Qdrant | Massive scale, highly optimized HNSW indexes | Heavy dependencies, overkill for a simple caching layer | We want the cache to be lightweight |
| pgvector | Keeps data in Postgres | Requires specific Postgres extensions, slightly slower than in-memory | Redis is faster for pure caching workloads |
| Redis (Raw Linear Scan) | Zero new dependencies (we already use Redis), in-memory speed | O(N) scaling, breaks down above ~100k vectors | **Selected** as the optimal choice for a typical LLM gateway cache scope |

## Consequences
- Positive: Architecture remains extremely simple. Deployment only requires a standard Redis instance.
- Negative: As the cache grows past ~10,000 entries, the linear cosine similarity scan will begin to introduce latency that negates the caching benefits.
- Trade-offs accepted: We accept a hard cap on cache size in exchange for architectural simplicity.
