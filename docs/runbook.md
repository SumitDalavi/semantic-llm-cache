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

## Release Runbook

### Triggering a New Release
Releases are automated via GitHub Actions (`.github/workflows/release.yml`) and trigger whenever a semantic version tag is pushed:

```bash
# 1. Ensure master is clean and up-to-date
git checkout master
git pull origin master

# 2. Tag the release
git tag -a v0.1.0 -m "Release v0.1.0"

# 3. Push the tag to trigger the pipeline
git push origin v0.1.0
```

### Release Pipeline Stages
1. **Test Verification:** Runs project test suite gates prior to container build.
2. **Container Image Build:** Builds the production container image (`ghcr.io/sumitdalavi/semantic-llm-cache:<tag>`).
3. **Trivy Vulnerability Scan:** Scans the built container for CRITICAL and HIGH CVEs via Aqua Security Trivy.
4. **Anchore Syft SBOM Generation:** Creates an SPDX JSON Software Bill of Materials (`sbom.spdx.json`).
5. **GitHub Release Publishing:** Creates the release with auto-generated release notes and attaches `sbom.spdx.json`.

### Verifying the Release
```bash
# Check workflow run status
gh run list --workflow=release.yml --repo SumitDalavi/semantic-llm-cache

# Inspect the published release and attached assets
gh release view v0.1.0 --repo SumitDalavi/semantic-llm-cache

# Download and inspect the SBOM
gh release download v0.1.0 --repo SumitDalavi/semantic-llm-cache -p "sbom.spdx.json"
cat sbom.spdx.json | jq .spdxVersion
```

### Release Failure Modes
| Symptom | Cause | Resolution |
|---|---|---|
| `Unable to resolve action ... unable to find version` | Pinned action tag missing or upstream tag modified | Pin action to a verified release tag (`@v0.36.0`) or commit SHA |
| `invalid reference format: repository name must be lowercase` | Container repository owner contains uppercase characters | Lowercase the repository owner before tagging (`tr '[:upper:]' '[:lower:]'`) |
| `File not found: sbom.spdx.json` during release step | SBOM action configured with `artifact-name` instead of `output-file` | Ensure `output-file: sbom.spdx.json` is set in Anchore action |
