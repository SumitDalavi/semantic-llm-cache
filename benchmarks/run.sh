#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    npm install
fi

echo "Running Cache Hit/Miss Latency Benchmark..."
npx ts-node benchmarks/run.ts
