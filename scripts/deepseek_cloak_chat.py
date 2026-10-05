"""Send one chat turn through the logged-in CloakBrowser DeepSeek profile.

Stdin: plain prompt text, or JSON {"prompt": "...", "image_base64": "..."}.
Last stdout line is JSON: {"text": "..."} or {"error": "..."}.
"""
import base64
import json
import os
import sys
import tempfile
from pathlib import Path


PROFILE = Path.home() / ".cloakbrowser" / "profiles" / "cloak-nhathuy113"
SKIP = {
    "DeepThink",
    "Search",
    "AI-generated, for reference only",
    "One more step before you proceed...",
}


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


def latest_reply(page, prompt: str, previous_count: int = 0) -> str:
    blocks = reply_blocks(page)
    # Never accept an old reply while the new turn is still being generated.
    if len(blocks) <= previous_count:
        return ""
    return clean_reply(blocks[-1], prompt)


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


def main() -> int:
    prompt, image_b64 = parse_stdin(sys.stdin.read())
    if not prompt:
        emit({"error": "empty prompt"})
        return 1
    if not PROFILE.is_dir():
        emit({"error": f"missing profile {PROFILE}"})
        return 1

    headless = os.environ.get("SPECTER_DEEPSEEK_HEADLESS", "0").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    from cloakbrowser import launch_persistent_context

    ctx = launch_persistent_context(str(PROFILE), headless=headless)
    try:
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://chat.deepseek.com/", wait_until="domcontentloaded", timeout=60000)
        box = page.locator("textarea[placeholder='Message DeepSeek']")
        box.wait_for(timeout=20000)
        if image_b64:
            attach_screenshot(page, image_b64)
        previous_count = len(reply_blocks(page))
        box.fill(prompt[:8000])
        box.press("Enter")

        last = ""
        stable = 0
        for _ in range(45):
            page.wait_for_timeout(1000)
            reply = latest_reply(page, prompt[:8000], previous_count)
            if reply and reply == last:
                stable += 1
                if stable >= 2:
                    emit({"text": reply})
                    return 0
            else:
                stable = 0
                last = reply
        if last:
            emit({"text": last})
            return 0
        emit({"error": "DeepSeek reply timed out"})
        return 1
    finally:
        ctx.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        emit({"error": str(exc)})
        raise SystemExit(1)
