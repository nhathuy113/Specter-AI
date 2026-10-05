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
from html.parser import HTMLParser
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


def forget_saved_chat(path: Path = CHAT_URL_FILE) -> None:
    path.unlink(missing_ok=True)


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


class _MarkdownHTML(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.stack: list[tuple[str, str]] = []
        self.skip_depth = 0
        self.in_pre = False
        self.fence_open = False
        self.lang = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        cls = " ".join(value or "" for key, value in attrs if key == "class")
        self.stack.append((tag, cls))
        if self.skip_depth:
            self.skip_depth += 1
            return
        if tag == "button" or any(part in cls for part in ("banner", "action", "toolbar")):
            self.skip_depth = 1
            return
        found = re.search(r"language-([\w+-]+)", cls)
        if found:
            self.lang = found.group(1)
        if tag == "br":
            self.out.append("\n")
        elif tag == "li":
            self.out.append("\n- ")
        elif tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.out.append("\n" + ("#" * int(tag[1])) + " ")
        elif tag == "pre":
            self.in_pre = True
            self.fence_open = False
        elif tag == "code" and self.in_pre:
            self._open_fence()
        elif tag in {"strong", "b"}:
            self.out.append("**")
        elif tag in {"em", "i"}:
            self.out.append("*")
        elif self._inline_code(tag, cls):
            self.out.append("`")

    def handle_endtag(self, tag: str) -> None:
        cls = ""
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                _, cls = self.stack.pop(index)
                break
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if tag == "pre":
            self._open_fence()
            if self.out and not self.out[-1].endswith("\n"):
                self.out.append("\n")
            self.out.append("```\n")
            self.in_pre = False
            self.fence_open = False
        elif self.in_pre and (tag in {"div", "p"} or "line" in cls):
            if self.out and not self.out[-1].endswith("\n"):
                self.out.append("\n")
        elif tag in {"strong", "b"}:
            self.out.append("**")
        elif tag in {"em", "i"}:
            self.out.append("*")
        elif self._inline_code(tag, cls):
            self.out.append("`")
        elif tag in {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote"}:
            self.out.append("\n")

    def handle_data(self, data: str) -> None:
        if self.skip_depth:
            return
        if self.in_pre:
            self._open_fence()
        elif data.strip() in {"Copy", "Download"}:
            return
        self.out.append(data)

    def _open_fence(self) -> None:
        if self.fence_open or not self.in_pre:
            return
        self.out.append(f"\n```{self.lang}\n")
        self.fence_open = True
        self.lang = ""

    def _inline_code(self, tag: str, cls: str) -> bool:
        if self.in_pre or any(name == "pre" for name, _ in self.stack):
            return False
        return tag == "code" or "inline-code" in cls


def html_to_markdown(raw: str) -> str:
    if "<" not in raw:
        return raw
    parser = _MarkdownHTML()
    parser.feed(raw)
    text = re.sub(r"[ \t]+\n", "\n", "".join(parser.out))
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def clean_reply(block: str, prompt: str) -> str:
    if block.strip() == prompt.strip():
        return ""
    return "\n".join(
        line for line in block.splitlines()
        if line.strip() not in SKIP and not line.strip().startswith("Thought for")
    ).strip()


def reply_blocks(page) -> list[str]:
    html_blocks = page.locator('[class*="markdown"]').evaluate_all(
        """nodes => nodes.filter(node => !node.parentElement?.closest('[class*="markdown"]'))
            .map(node => node.innerHTML)"""
    )
    return [html_to_markdown(block) for block in html_blocks]


def latest_reply(page, prompt: str, before_count: int = 0) -> str:
    blocks = reply_blocks(page)
    if len(blocks) <= before_count:
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


def composer(page):
    box = page.locator("textarea[placeholder='Message DeepSeek']")
    if box.count() == 0:
        return open_composer(page)
    return box


def send_turn(page, prompt: str, image_b64: str | None) -> None:
    box = composer(page)
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
    forget_saved_chat()
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
    path = Path(tempfile.gettempdir()) / "specter-chat-url-self-check"
    path.write_text("https://chat.deepseek.com/a/chat/s/old\n", encoding="utf-8")
    forget_saved_chat(path)
    assert not path.exists()


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
