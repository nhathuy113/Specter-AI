#!/usr/bin/env bash
# Full live E2E — run all automated live probes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm test:unit
pnpm test:coach:live
pnpm test:gemini:live
pnpm test:screen:live
pnpm test:vision:live
echo ""
echo "FULL LIVE E2E: PASS"
