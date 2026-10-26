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

## ADR-002: Progressive Credential Loading (PCL) Architecture
- **Context:** Production hardening required live backends (PostgreSQL, Redis, OpenAI, Anthropic), but removing mocks would break CI pipelines and create high developer onboarding friction.
- **Decision:** Implement Progressive Credential Loading. Keep in-memory and local mock heuristics as the default safe baseline, while wrapping external integrations in auto-promoting factory adapters triggered by environment variables.
- **Consequences:** 
  - *Pros:* 100% CI pass rate without requiring external secrets; zero setup friction for new contributors; progressive upgrade to production clusters.
  - *Cons:* Adds lightweight factory abstraction layers and runtime credential detection logic.

## ADR-003: Declarative Multi-Cluster GitOps Packaging with ArgoCD and Kustomize
- **Date:** 2026-10-27
- **Status:** Accepted
- **Context:** Deploying this service across multi-cluster environments (`dev`, `staging`, `prod`) requires a standardized cloud-native packaging format that separates environment-agnostic base specifications from environment-specific resource allocations, replica counts, and security policies without modifying source code or inducing configuration drift.
- **Decision:** Adopt Kustomize overlays under `deploy/k8s/` and declarative ArgoCD `Application` definitions under `deploy/argocd/`.
  1. `deploy/k8s/base`: Declares non-root PodSecurity standards (`runAsUser: 10001`, `drop: [ALL]`, `readOnlyRootFilesystem: true`), probes, and resource constraints without hardcoding namespace.
  2. `deploy/k8s/overlays/{dev,staging,prod}`: Overrides namespace, replica counts, and resources per environment tier.
  3. `deploy/argocd/`: Standalone `Application` CRDs with automated self-healing in `dev`/`staging` and gated PR synchronization in `prod`.
- **Consequences:**
  - *Pros:* Fully declarative, CNCF-compliant, drift-resistant, and natively integrates with the `multi-cluster-gitops-promotion` catalog.
  - *Cons:* Requires maintaining separate overlay directories for each target cluster tier.
