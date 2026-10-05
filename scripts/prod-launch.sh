#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:${HOME}/.local/bin:/usr/bin:/bin"
export SPECTER_DEEPSEEK_HEADLESS=1
exec ./node_modules/.bin/electron-vite preview
