# Decisions

## ADR-001: Linear Scan vs Redis Stack VSS
**Date:** 2026-08-29  
**Status:** Accepted

**Context:**  
To find the closest embedding, we can either use Redis Stack's Vector Similarity Search (VSS) module or perform a linear cosine similarity scan across keys in a standard Redis string/hash data structure.

**Decision:**  
We chose to perform the cosine similarity in the Node.js application layer using standard Redis data structures, chunked into smaller namespaces by system prompt.

**Consequences:**  
- ✅ Works with any standard Redis instance (ElastiCache, Memorystore) without requiring Redis Stack.
- ⚠️ Slower for very large datasets (>100k cached prompts). However, by namespacing the cache keys by the SHA-256 hash of the system prompt + user context, the search space is small enough that a linear scan in V8 takes <1ms.
