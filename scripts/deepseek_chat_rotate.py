"""Delete DeepSeek chats from previous days. Does not open the browser."""
import json
import sys
from datetime import date

from deepseek_cloak_chat import rotate_saved_chats

result = rotate_saved_chats(date.today().isoformat())
print(json.dumps(result), flush=True)
print(
    f"[Specter] chat rotate worker deleted={len(result['deleted'])} clearedActive={result['clearedActive']}",
    file=sys.stderr,
    flush=True,
)
