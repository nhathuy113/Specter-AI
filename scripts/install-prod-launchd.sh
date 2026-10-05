#!/bin/bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
label="com.specter.ai"
agents="${HOME}/Library/LaunchAgents"
logs="${HOME}/Library/Logs/specter-ai"
plist="${agents}/${label}.plist"
uid="$(id -u)"
domain="gui/${uid}"

mkdir -p "$agents" "$logs" "${HOME}/Library/Application Support/specter-ai"
chmod +x "${root}/scripts/prod-launch.sh"
launcher="${HOME}/Library/Application Support/specter-ai/Specter AI"
cat > "$launcher" <<EOF
#!/bin/bash
exec "${root}/scripts/prod-launch.sh"
EOF
chmod +x "$launcher"

cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>AssociatedBundleIdentifiers</key>
  <array>
    <string>com.specter.ai</string>
  </array>
  <key>ProgramArguments</key>
  <array>
    <string>${launcher}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${root}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${logs}/prod.log</string>
  <key>StandardErrorPath</key>
  <string>${logs}/prod.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SPECTER_DEEPSEEK_HEADLESS</key>
    <string>1</string>
  </dict>
</dict>
</plist>
EOF

plutil -lint "$plist"
launchctl bootout "${domain}/${label}" 2>/dev/null || true
sleep 1
launchctl bootstrap "$domain" "$plist"
launchctl enable "${domain}/${label}"
launchctl kickstart -k "${domain}/${label}"
echo "launchd ${label} running prod from ${root}"
