# Service Level Objectives

## Latency SLO
- Target: P50 < 25ms for Cache Hits
- Context: A standard LLM request to OpenAI takes 500ms - 2000ms. If our semantic cache lookup takes 200ms, it eats significantly into the UX budget. The cache must resolve similarity in under 25ms.
- Measurement: Intercepted via OpenTelemetry spans wrapping the `cacheStore.get` execution.

## Availability SLO
- Target: 99.95% uptime
- Note: The semantic cache operates in a "fail-open" mode. If Redis goes down, the system bypasses the cache and hits the LLM directly. Therefore, caching availability does not impact system availability, but it *does* impact the financial budget SLO.

## Correctness SLO
- Zero instances of semantic cross-contamination (e.g. serving User A's private cached prompt to User B).
- Measurement: Enforced via mandatory Tenant ID namespacing in all Redis keys.
