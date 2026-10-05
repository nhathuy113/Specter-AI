#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:${HOME}/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export SPECTER_DEEPSEEK_HEADLESS=1

electron_bin="$(node -p "require('electron')")"
source_app="$(cd "$(dirname "$electron_bin")/../.." && pwd)"
branded_app="${HOME}/Library/Application Support/specter-ai/Specter AI.app"
version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$source_app/Contents/Info.plist")"
stamp="$branded_app/Contents/Resources/specter-brand.txt"
if [[ ! -f "$stamp" || "$(cat "$stamp")" != "$version" ]]; then
  rm -rf "$branded_app"
  ditto "$source_app" "$branded_app"
  xattr -cr "$branded_app"
  plist="$branded_app/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c 'Set :CFBundleName Specter AI' "$plist"
  /usr/libexec/PlistBuddy -c 'Set :CFBundleDisplayName Specter AI' "$plist"
  /usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier com.specter.ai' "$plist"
  codesign --force --deep --sign - "$branded_app"
  printf '%s\n' "$version" > "$stamp"
fi

./node_modules/.bin/electron-vite build
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$branded_app"
exec "$branded_app/Contents/MacOS/Electron" .
