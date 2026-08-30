# ADR-002: Eviction Policy

## Status: Accepted

## Context
As the semantic cache grows, checking cosine similarity across the entire vector space becomes computationally expensive and consumes excessive memory (or Redis capacity). We must decide how to evict old cache entries.

## Decision
We chose a **Time-To-Live (TTL) heuristic based on prompt semantics and access frequency**, falling back to standard **LRU (Least Recently Used)** at capacity limits.

## Alternatives Considered
| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| Never Evict | Maximum potential cache hits over time | Infinite growth, O(N) search latency degradation | Unscalable |
| Strict LIFO / FIFO | Simple to implement | Evicts highly accessed evergreen queries just because they are old | Poor hit-rate optimization |
| LRU + TTL | Keeps actively useful vectors in memory, drops stale topics | Requires Redis configured with `allkeys-lru` | **Selected** for robustness |

## Consequences
- Positive: Memory usage is strictly bounded. Frequently asked questions stay hot in the cache indefinitely.
- Negative: Cache entries that are requested right after their TTL expires will incur an LLM penalty.
- Trade-offs accepted: Memory bounds and search latency consistency are prioritized over an absolute 100% cache hit rate.
