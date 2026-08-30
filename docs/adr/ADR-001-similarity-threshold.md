# ADR-001: Similarity Threshold

## Status: Accepted

## Context
When caching LLM responses semantically, we compute the cosine similarity between the incoming prompt embedding and stored embeddings. We must decide the minimum similarity score that constitutes a "cache hit" (meaning the semantic intent is identical enough to safely return the cached response).

## Decision
We chose **0.85** as the default baseline similarity threshold for cosine distance.

## Alternatives Considered
| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| Threshold 0.95+ (Strict) | Near-zero risk of hallucinations/incorrect caching | Extremely low cache hit rate, defeats the purpose of the cache | Too strict for general-purpose text generation |
| Threshold < 0.75 (Loose) | Very high cache hit rate, massive cost savings | High risk of providing completely irrelevant responses (e.g., mixing "How to cook pasta" with "How to cook rice") | Unacceptable risk of semantic collisions |
| Threshold 0.85 (Balanced) | Excellent hit rate for rephrased queries, low collision rate | Edge cases require manual threshold tuning per application | **Selected** as the empirically optimal default for OpenAI `text-embedding-3-small` embeddings |

## Consequences
- Positive: Developers get a sensible default that saves money on 90% of trivially rephrased queries (e.g., "Summarize this text" vs "Can you summarize this text for me").
- Negative: Requires exposing the threshold configuration to end-users so they can tune it for highly sensitive tasks (e.g., medical advice).
- Trade-offs accepted: We accept the need for per-tenant threshold configuration in exchange for a solid default.
