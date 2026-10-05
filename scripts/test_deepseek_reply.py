import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from deepseek_cloak_chat import clean_reply, forget_saved_chat, html_to_markdown, latest_reply, park_active_chat, rotate_saved_chats, save_chat_url


class Locator:
    def __init__(self, blocks):
        self.blocks = blocks

    def evaluate_all(self, _script):
        return self.blocks


class Page:
    def __init__(self, blocks):
        self.blocks = blocks

    def locator(self, _selector):
        return Locator(self.blocks)


class ReplyTests(unittest.TestCase):
    def test_preserves_complete_multiline_reply_and_code(self):
        reply = "Explanation\n\n```python\n  print('hello')\n```\nConclusion"
        self.assertEqual(latest_reply(Page(['old answer', reply]), 'question', 1), reply)

    def test_never_returns_previous_turn_or_prompt(self):
        self.assertEqual(latest_reply(Page(['old answer']), 'question', 1), '')
        self.assertEqual(clean_reply('multi\nline prompt', 'multi\nline prompt'), '')

    def test_keeps_bold_and_code_from_rendered_html(self):
        html = '<ul><li><p>Bài <strong>Score of Parentheses</strong> trong <code>class Solution</code>.</p></li></ul>'
        self.assertEqual(html_to_markdown(html), '- Bài **Score of Parentheses** trong `class Solution`.')

    def test_keeps_a_fenced_code_block(self):
        self.assertEqual(html_to_markdown('<pre><code>int depth;</code></pre>'), '```\nint depth;\n```')

    def test_keeps_a_language_code_block_without_copy_chrome(self):
        html = (
            '<div class="md-code-block"><div class="md-code-block-banner"><span>go</span>'
            '<button>Copy</button><button>Download</button></div>'
            '<pre><code class="language-go"><span class="line">ans := 0</span>'
            '<span class="line">depth := 0</span></code></pre></div>'
        )
        self.assertEqual(html_to_markdown(html), '```go\nans := 0\ndepth := 0\n```')

    def test_image_is_sent_before_the_prompt(self):
        import deepseek_cloak_chat as chat
        actions = []

        class Page:
            def __init__(self):
                self.generating = False
                self.waits = 0

            def locator(self, _selector):
                return self

            def count(self):
                return 1

            def evaluate_all(self, _script):
                return []

            def press(self, key):
                actions.append(key)
                self.generating = True

            def fill(self, text):
                actions.append(text)

            def wait_for_timeout(self, _ms):
                self.waits += 1
                if self.waits >= 2:
                    self.generating = False

            def evaluate(self, _script):
                return self.generating

        original = chat.attach_screenshot
        chat.attach_screenshot = lambda _page, _image: actions.append("image")
        try:
            chat.send_turn(Page(), "Giúp", "abc")
        finally:
            chat.attach_screenshot = original
        self.assertEqual(actions, ["image", "Giúp", "Enter"])

    def test_restart_parks_the_chat_and_daily_rotate_deletes_it(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            url_path = root / "deepseek-chat-url"
            day_path = root / "deepseek-chat-day"
            log_path = root / "deepseek-chat-log.json"
            save_chat_url("https://chat.deepseek.com/a/chat/s/old", "2026-10-05", url_path, day_path)
            park_active_chat("2026-10-05", url_path, day_path, log_path)
            self.assertFalse(url_path.exists())
            kept = rotate_saved_chats("2026-10-05", url_path, day_path, log_path)
            self.assertEqual(kept["deleted"], [])
            self.assertFalse(kept["clearedActive"])
            dropped = rotate_saved_chats("2026-10-06", url_path, day_path, log_path)
            self.assertEqual(dropped["deleted"], ["https://chat.deepseek.com/a/chat/s/old"])
            self.assertEqual(json.loads(log_path.read_text(encoding="utf-8")), [])

    def test_a_new_process_forgets_the_saved_chat(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "deepseek-chat-url"
            path.write_text("https://chat.deepseek.com/a/chat/s/old\n", encoding="utf-8")
            forget_saved_chat(path)
            self.assertFalse(path.exists())

    def test_removes_ui_chrome_without_discarding_the_answer(self):
        self.assertEqual(clean_reply('DeepThink\nFirst line\nLast line\nAI-generated, for reference only', 'question'), 'First line\nLast line')


if __name__ == '__main__':
    unittest.main()
