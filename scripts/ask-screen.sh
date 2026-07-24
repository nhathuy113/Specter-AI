#!/usr/bin/env bash
# Quick wrapper: capture pinned work screen + ask Gemini like Specter coach.
# Usage: ./scripts/ask-screen.sh [--coach] [--query "…"]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/test-work-screen-coach.mjs "$@"
