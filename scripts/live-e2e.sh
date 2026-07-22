#!/usr/bin/env bash
# Live E2E probe — runs on macOS with Screen Recording permission.
# Usage: cd tools/Specter-AI && pnpm test:e2e:live
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "==> Unit + mocked e2e tests"
pnpm test

echo ""
echo "==> Display probe (system_profiler)"
system_profiler SPDisplaysDataType 2>/dev/null | rg -i "resolution|main display|mirror|display type" | head -20 || true

TMPDIR="${TMPDIR:-/tmp}"
PRIMARY_PNG="$TMPDIR/specter-e2e-primary.png"
SECONDARY_PNG="$TMPDIR/specter-e2e-secondary.png"

echo ""
echo "==> Live screencapture probe (needs Screen Recording permission)"
PRIMARY_OK=0
SECONDARY_OK=0

if screencapture -x "$PRIMARY_PNG" 2>/dev/null; then
  PRIMARY_OK=1
  echo "  primary capture: OK ($(wc -c < "$PRIMARY_PNG") bytes)"
else
  echo "  primary capture: FAILED (grant Screen Recording to Terminal/Cursor)"
fi

if screencapture -x -D 2 "$SECONDARY_PNG" 2>/dev/null; then
  SECONDARY_OK=1
  echo "  secondary capture (-D 2): OK ($(wc -c < "$SECONDARY_PNG") bytes)"
else
  echo "  secondary capture (-D 2): FAILED or single-monitor setup"
fi

if [[ "${GEMINI_API_KEY:-}" != "" ]]; then
  echo ""
  echo "==> Gemini API key validation (live)"
  node --input-type=module -e "
    const key = process.env.GEMINI_API_KEY;
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key));
    const data = await res.json();
    if (!res.ok) { console.error('  Gemini validate: FAIL', data.error?.message || res.status); process.exit(1); }
    console.log('  Gemini validate: OK (' + (data.models?.length || 0) + ' models)');
  "
else
  echo ""
  echo "==> Gemini API key validation: SKIPPED (set GEMINI_API_KEY to test live)"
fi

echo ""
echo "==> Coach usefulness (HOI4 fixture + Gemini)"
if [[ "${GEMINI_API_KEY:-}" != "" ]]; then
  pnpm test:coach:live
  pnpm test:gemini:live
else
  echo "  SKIPPED (set GEMINI_API_KEY for live coach test)"
fi

echo ""
echo "==> Gemini vision E2E (secondary monitor screenshot)"
if [[ "${GEMINI_API_KEY:-}" != "" ]]; then
  pnpm test:vision:live
else
  echo "  SKIPPED (set GEMINI_API_KEY)"
fi

echo ""
echo "==> Secondary monitor E2E (Cursor screen + OCR)"
pnpm test:screen:live

echo ""
if [[ "$PRIMARY_OK" -eq 1 ]]; then
  echo "Live probe: PASS (primary capture works)"
  exit 0
fi

echo "Live probe: PARTIAL (automated tests passed; live capture needs Screen Recording permission)"
exit 0
