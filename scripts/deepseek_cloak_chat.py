"""Send one chat turn through the logged-in CloakBrowser DeepSeek profile.

Stdin: plain prompt text, or JSON {"prompt": "...", "image_base64": "..."}.
Last stdout line is JSON: {"text": "..."} or {"error": "..."}.
"""
import base64
import json
import os
import re
import signal
import sys
import tempfile
from pathlib import Path


PROFILE = Path.home() / ".cloakbrowser" / "profiles" / "cloak-nhathuy113"
CHAT_URL_FILE = Path.home() / ".specter" / "deepseek-chat-url"
CHAT_URL = re.compile(r"https://chat\.deepseek\.com/a/chat/s/([^/?#]+)")
HOME_URL = "https://chat.deepseek.com/"
SKIP = {
    "DeepThink",
    "Search",
    "AI-generated, for reference only",
    "One more step before you proceed...",
}


def chat_url_from(url: str) -> str | None:
    match = CHAT_URL.search(url.strip())
    if not match:
        return None
    return f"https://chat.deepseek.com/a/chat/s/{match.group(1)}"


def load_chat_url() -> str | None:
    if not CHAT_URL_FILE.is_file():
        return None
    return chat_url_from(CHAT_URL_FILE.read_text(encoding="utf-8"))


def save_chat_url(url: str) -> None:
    chat = chat_url_from(url)
    if not chat:
        return
    CHAT_URL_FILE.parent.mkdir(parents=True, exist_ok=True)
    CHAT_URL_FILE.write_text(chat + "\n", encoding="utf-8")


def emit(payload: dict) -> None:
    print(json.dumps(payload), flush=True)


def parse_stdin(raw: str) -> tuple[str, str | None]:
    text = raw.strip()
    if not text:
        return "", None
    if text.startswith("{"):
        data = json.loads(text)
        prompt = str(data.get("prompt", "")).strip()
        image = data.get("image_base64")
        return prompt, image if isinstance(image, str) and image.strip() else None
    return text, None


def clean_reply(block: str, prompt: str) -> str:
    if block.strip() == prompt.strip():
        return ""
    return "\n".join(
        line for line in block.splitlines()
        if line.strip() not in SKIP and not line.strip().startswith("Thought for")
    ).strip()


def reply_blocks(page) -> list[str]:
    return page.locator('[class*="markdown"]').evaluate_all(
        """nodes => nodes.filter(node => !node.parentElement?.closest('[class*="markdown"]'))
            .map(node => node.innerText)"""
    )


def latest_reply(page, prompt: str) -> str:
    blocks = reply_blocks(page)
    if not blocks:
        return ""
    return clean_reply(blocks[-1], prompt)


def still_generating(page) -> bool:
    return bool(page.evaluate(
        """() => {
          const btn = document.querySelector('.ds-button--primary.ds-button--circle')
          return !!btn && !btn.classList.contains('ds-button--disabled')
        }"""
    ))


def attach_screenshot(page, image_b64: str) -> None:
    data = base64.b64decode(image_b64, validate=False)
    tmp = Path(tempfile.gettempdir()) / f"specter-deepseek-{os.getpid()}.png"
    tmp.write_bytes(data)
    try:
        inputs = page.locator('input[type="file"]')
        if inputs.count() == 0:
            emit({"error": "DeepSeek file upload input not found"})
            raise RuntimeError("missing file input")
        inputs.first.set_input_files(str(tmp))
        page.wait_for_timeout(2500)
    finally:
        tmp.unlink(missing_ok=True)


def open_composer(page):
    saved = load_chat_url()
    page.goto(saved or HOME_URL, wait_until="domcontentloaded", timeout=60000)
    box = page.locator("textarea[placeholder='Message DeepSeek']")
    try:
        box.wait_for(timeout=20000)
    except Exception:
        if not saved:
            raise
        CHAT_URL_FILE.unlink(missing_ok=True)
        page.goto(HOME_URL, wait_until="domcontentloaded", timeout=60000)
        box.wait_for(timeout=20000)
    return box


def send_turn(page, prompt: str, image_b64: str | None) -> None:
    box = page.locator("textarea[placeholder='Message DeepSeek']")
    if box.count() == 0:
        box = open_composer(page)
    if image_b64:
        attach_screenshot(page, image_b64)
    sent = prompt[:8000]
    before = latest_reply(page, sent)
    box.fill(sent)
    box.press("Enter")
    last = ""
    for _ in range(90):
        page.wait_for_timeout(1000)
        if still_generating(page):
            continue
        reply = latest_reply(page, sent)
        if reply and reply != before:
            save_chat_url(page.url)
            emit({"text": reply})
            return
        last = reply
    if last and last != before:
        save_chat_url(page.url)
        emit({"text": last})
        return
    emit({"error": "DeepSeek reply timed out"})


def main() -> int:
    if not PROFILE.is_dir():
        emit({"error": f"missing profile {PROFILE}"})
        return 1

    headless = os.environ.get("SPECTER_DEEPSEEK_HEADLESS", "0").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    from cloakbrowser import launch_persistent_context

    def stop(_signum: int, _frame: object) -> None:
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, stop)
    ctx = launch_persistent_context(str(PROFILE), headless=headless)
    try:
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        open_composer(page)
        emit({"ready": True})
        for raw in sys.stdin:
            line = raw.strip()
            if not line:
                continue
            if line == '{"cmd":"quit"}':
                return 0
            try:
                prompt, image_b64 = parse_stdin(line)
                if not prompt:
                    emit({"error": "empty prompt"})
                    continue
                send_turn(page, prompt, image_b64)
            except Exception as exc:
                emit({"error": str(exc)})
        return 0
    finally:
        ctx.close()


def self_check() -> None:
    assert chat_url_from("https://chat.deepseek.com/a/chat/s/abc-1") == "https://chat.deepseek.com/a/chat/s/abc-1"
    assert chat_url_from("https://chat.deepseek.com/a/chat/s/abc-1?x=1") == "https://chat.deepseek.com/a/chat/s/abc-1"
    assert chat_url_from("https://chat.deepseek.com/") is None


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        self_check()
        raise SystemExit(0)
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        emit({"error": str(exc)})
        raise SystemExit(1)
