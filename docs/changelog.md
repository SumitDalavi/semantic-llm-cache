# Changelog

## [v0.1.0] — 2026-10-18
### Added
- Automated DevSecOps release pipeline triggering on `v*.*.*` git tags.
- Container image build targeting GitHub Container Registry (`ghcr.io`).
- Trivy vulnerability scanning step with vulnerability reporting.
- Anchore Syft SPDX-JSON SBOM artifact generation.
- Automated GitHub Release publication with attached `sbom.spdx.json`.


## [2026-08-29] — Phase 2 Evidence
### Added
- Added reproducible benchmark evidence `benchmarks/results/semantic-cache-results.json` demonstrating hit rate, false-hit rate, and latency reduction.
- Standardized documentation (`runbook.md`, `decisions.md`, `architecture.md`).
- Added maturity badge and mock boundaries to `README.md`.
