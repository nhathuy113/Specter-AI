import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { resolveAssistantRequest } from '../context/context-router'
import { appendWorkCoachContext, evaluateWorkCoachCodeReview } from '../work/work-coach-session'
import { extractEditorCodeText } from '../work/work-coach-snippet'
import { scoreCoachReply } from './coach-reply-score'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const NOISY_OCR = readFileSync(resolve(root, '../context/fixtures/leetcode-median-noisy-ocr.txt'), 'utf8')
const META = { appName: 'Work: Built-in Retina Display', windowTitle: 'pinned-work-display' }

describe('coach prompt integration — real noisy OCR', () => {
  it('detects code-review mode for user partition attempt', () => {
    const review = evaluateWorkCoachCodeReview(NOISY_OCR, META)
    expect(review.replyMode).toBe('code-review')
  })

  it('cleans OCR to while-loop partition code', () => {
    const editor = extractEditorCodeText(NOISY_OCR)
    expect(editor).toContain('while left <= right')
    expect(editor).toContain('maxLeftA')
    expect(editor.length).toBeLessThan(1800)
  })

  it('prompt has single clean editor block and code-review (not 6-section reset)', () => {
    const req = resolveAssistantRequest(NOISY_OCR, 'work', META)
    const review = evaluateWorkCoachCodeReview(NOISY_OCR, META)
    const prompt = appendWorkCoachContext(req.userMessage, 'thread', {
      replyMode: review.replyMode,
      codeReviewStatus: review.status,
      screenText: NOISY_OCR
    })

    const editorBlocks = prompt.match(/\[EDITOR CODE ON SCREEN/g) ?? []
    expect(editorBlocks.length).toBe(1)
    expect(prompt).toContain('REVIEW TRÊN CODE ĐÓ')
    expect(prompt).toContain('while left <= right')
    expect(prompt).not.toContain('**Trạng thái:**')
    expect(prompt.length).toBeLessThan(6000)
  })

  it('scores the helpful production reply as pass', () => {
    const reply = `**Kẹt ở đâu:** TypeError vì maxLeftA chưa khởi tạo.
**Giải thích lại:** ...
**Snippet thay thế:**
\`\`\`python
maxLeftA = A[i - 1] if i > 0 else float('-inf')
\`\`\`
**Tại sao:** ...`
    expect(scoreCoachReply(reply).pass).toBe(true)
  })
})
