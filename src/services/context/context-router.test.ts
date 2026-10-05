import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { extractScreenContext, resolveAssistantRequest } from './context-router'
import { extractEditorCodeText, cleanLeetCodeEditorOcr } from '../work/work-coach-snippet'

const root = resolve(dirname(fileURLToPath(import.meta.url)))
const NOISY_OCR = readFileSync(resolve(root, 'fixtures/leetcode-median-noisy-ocr.txt'), 'utf8')

describe('context-router work coach OCR', () => {
  it('cleans real LeetCode OCR to python editor lines', () => {
    const clean = cleanLeetCodeEditorOcr(NOISY_OCR)
    expect(clean).toContain('def findMedianSortedArrays')
    expect(clean).toContain('while left <= right')
    expect(clean).toContain('maxLeftA')
    expect(clean).not.toMatch(/problemlist/i)
    expect(clean).not.toMatch(/example 1/i)
  })

  it('work mode + runtime error uses short error summary (editor in separate block)', () => {
    const ctx = extractScreenContext(NOISY_OCR, 'work', {
      appName: 'Work: Built-in Retina Display',
      windowTitle: 'pinned-work-display'
    })
    expect(ctx.kind).toBe('code')
    expect(ctx.focusedText).toContain('TypeError')
    expect(extractEditorCodeText(NOISY_OCR)).toContain('while left <= right')
  })
})
