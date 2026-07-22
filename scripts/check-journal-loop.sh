#!/usr/bin/env bash
# Checkpoint journal stats for Specter activity log monitoring.
SETTINGS="$HOME/Library/Application Support/specter-ai/specter-settings.json"

check_journal() {
  local label="$1"
  python3 - "$SETTINGS" "$label" <<'PY'
import json, sys
from pathlib import Path
from datetime import datetime

path = Path(sys.argv[1])
label = sys.argv[2]
if not path.exists():
    print(f"AGENT_LOOP_WAKE_journal {{\"label\":\"{label}\",\"error\":\"settings file missing\",\"entries\":0}}")
    sys.exit(0)

data = json.loads(path.read_text())
log = data.get("activityJournalLog") or []
full = data.get("fullAutoMode")
watch = data.get("continuousCoach")
journal = data.get("activityJournal")
last = log[-3:] if log else []
summary = []
for e in last:
    summary.append({
        "time": e.get("minuteKey"),
        "app": e.get("appName"),
        "window": (e.get("windowTitle") or "")[:40],
        "ocr": e.get("ocrChars", 0),
        "kind": e.get("screenKind"),
    })
payload = {
    "label": label,
    "now": datetime.now().strftime("%H:%M"),
    "entries": len(log),
    "fullAutoMode": full,
    "watch": watch,
    "journal": journal,
    "recent": summary,
}
import json as j
print("AGENT_LOOP_WAKE_journal " + j.dumps(payload, ensure_ascii=False))
PY
}

# Baseline ~2 min after start (give Watch time to tick)
sleep 120
check_journal "2m-baseline"

sleep 1680   # +28m => 30m total
check_journal "30m"

sleep 1800   # +30m => 1h total from 30m checkpoint... wait

# Actually from start:
# 2m baseline at 120s
# 30m at 120 + 1680 = 1800s ✓
# 1h at 1800 + 1800 = 3600s from baseline start... 

# After 30m check, sleep 1800 for 1h from start? 
# Timeline from script start:
# t=120: 2m
# t=1800: 30m (sleep 1680 after 2m check)
# t=3600: 1h (sleep 1800 after 30m)
# t=5400: 1h30 (sleep 1800 after 1h)

sleep 1800
check_journal "1h"

sleep 1800
check_journal "1h30"
