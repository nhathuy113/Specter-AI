import unittest
from deepseek_cloak_chat import clean_reply, latest_reply


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

    def test_removes_ui_chrome_without_discarding_the_answer(self):
        self.assertEqual(clean_reply('DeepThink\nFirst line\nLast line\nAI-generated, for reference only', 'question'), 'First line\nLast line')


if __name__ == '__main__':
    unittest.main()
