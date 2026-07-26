/** Extract and compare coach-suggested code vs OCR editor code. */

const LEETCODE_SIGNAL = /leetcode|problemlist|submissions|editorial|median of two sorted/i
const LEETCODE_JUNK =
  /problemlist|submit|premium|editorial|solutions|submissions|example \d|^\s*input:|^\s*output:|explanation:|constraints:|testcase|test result|runtime error|saved ln|online|description \||^hard$|^easy$|given two sorted arrays|return the median of the two|overall run time complexity|^\d+\s*constraints:/i
const PYTHON_CODE_START =
  /^(class |def |import |from |if |elif |else:|while |for |return |#|[A-Za-z_][\w]*\s*=|maxleft|minright|max_left|min_right|elif )/i

const FENCE_RE = /```(?:\w+)?\s*([\s\S]*?)```/g

export function extractSuggestedSnippets(assistantReply: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(FENCE_RE.source, 'g')
  while ((m = re.exec(assistantReply)) !== null) {
    const block = m[1]?.trim()
    if (block && block.length > 2) out.push(block)
  }
  return out
}

export function normalizeCodeForCompare(code: string): string {
  return code
    .split('\n')
    .map((line) => line.replace(/#.*$|\/\/.*$/, '').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && line !== 'pass' && line !== '...')
    .join('\n')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function significantLines(snippet: string): string[] {
  return snippet
    .split('\n')
    .map((line) => line.replace(/#.*$|\/\/.*$/, '').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 5 && !/^(pass|\.\.\.)$/i.test(line))
    .map((line) => line.replace(/\s+/g, '').toLowerCase())
}

function stripLeetCodeLinePrefix(line: string): string {
  const numbered = line.match(/^\d{1,2}\s+(.+)/)
  if (numbered) return numbered[1].trim()
  const embedded = line.match(/\b(\d{1,2})\s+((?:if |while |return |def |class |[A-Za-z_][\w]*\s*=).+)/)
  if (embedded) return embedded[2].trim()
  return line.trim()
}

/** Pull Python editor lines out of noisy LeetCode OCR. */
export function cleanLeetCodeEditorOcr(screenText: string): string {
  if (!LEETCODE_SIGNAL.test(screenText)) return ''

  const rawLines = screenText.split('\n').map((l) => l.trim()).filter(Boolean)
  const codeLines: string[] = []

  for (const raw of rawLines) {
    if (LEETCODE_JUNK.test(raw)) continue
    let line = stripLeetCodeLinePrefix(raw)
    if (!line || LEETCODE_JUNK.test(line)) continue

    // Split "11 m, n =n, m if len(A) > len(B):" → take code tail after problem description glue
    const glued = line.match(/\b(if |while |return |class |def |[A-Za-z_][\w]*\s*=)(.+)$/i)
    if (!PYTHON_CODE_START.test(line) && glued) {
      line = (glued[1] + glued[2]).trim()
    }

    if (PYTHON_CODE_START.test(line) || /^float\(/.test(line)) {
      codeLines.push(line.replace(/\s{2,}/g, ' '))
    }
  }

  const defIdx = codeLines.findIndex((l) => /\bdef findMedian/i.test(l))
  const start = defIdx >= 0 ? defIdx : 0
  const deduped: string[] = []
  for (const line of codeLines.slice(start)) {
    const norm = line.replace(/\s+/g, ' ').toLowerCase()
    if (deduped.some((d) => d.replace(/\s+/g, ' ').toLowerCase() === norm)) continue
    deduped.push(line)
  }

  return deduped.slice(0, 48).join('\n')
}

/** Editor code lines from OCR (same heuristics as fingerprint). */
export function extractEditorCodeText(screenText: string): string {
  const leetClean = cleanLeetCodeEditorOcr(screenText)
  if (leetClean.trim()) return leetClean

  const CODE_LINE =
    /^\s*(def |class |import |from |return |if |elif |else:|for |while |print\b|public |private |void |int |#include|function |const |let |var |nums|self\.|\}|\{|\)|\(.*=>)/i
  const SKIP_LINE =
    /^(file|edit|selection|view|run|terminal|submit|acceptance|submissions|description|solution|console|output)$/i
  const UI_NOISE = /leetcode|easy|medium|hard|acceptance rate|memory|runtime|beats \d/i

  return screenText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !SKIP_LINE.test(l) && !UI_NOISE.test(l))
    .filter(
      (l) =>
        CODE_LINE.test(l) ||
        (/[=<>+\-*\/\[\]{}();]/.test(l) && l.length > 5 && /[a-zA-Z_]/.test(l))
    )
    .join('\n')
}

/**
 * User typed code that matches the last suggested snippet (review approve).
 * Requires most significant lines from snippet to appear in editor OCR.
 */
export function snippetApproved(suggestedSnippet: string, screenText: string): boolean {
  const lines = significantLines(suggestedSnippet)
  if (lines.length === 0) {
    const sug = normalizeCodeForCompare(suggestedSnippet)
    const ed = normalizeCodeForCompare(extractEditorCodeText(screenText))
    return sug.length > 8 && ed.includes(sug)
  }

  const editorNorm = normalizeCodeForCompare(extractEditorCodeText(screenText))
  let matched = 0
  for (const line of lines) {
    if (editorNorm.includes(line)) matched++
  }
  const need = Math.max(1, Math.ceil(lines.length * 0.65))
  return matched >= need
}

const CONFUSION_PHRASE_RE =
  /chưa\s*hiểu|không\s*hiểu|ko\s*hiểu|giải\s*thích\s*lại|restart|chưa\s*rõ|khó\s*hiểu|là\s*sao|sao\s*vậy|don't understand|explain again|what\?/i

const COACH_AUTO_QUERY = /^\[Coach auto\]$/i

/** Overlay chat that is NOT snippet approval — user confused or asking meta questions. */
export function isUserConfusionFeedback(query: string): boolean {
  const q = query.trim()
  if (!q || COACH_AUTO_QUERY.test(q) || q.startsWith('[Coach]')) return false
  if (q.startsWith('MEETING AUDIO') || q === '(Analyze my screen)') return false
  if (/```/.test(q)) return false
  if (/^\s*(def |class |import |from |public |void |function |const |let |var |#include)/im.test(q)) {
    return false
  }
  if (CONFUSION_PHRASE_RE.test(q)) return true
  if (q.length < 100 && (/\?/.test(q) || /\bchưa\b/i.test(q))) return true
  return false
}

/** User has typed real logic beyond class/def/pass stub. */
export function hasUserWrittenLogic(screenText: string): boolean {
  return !isEditorStillStub(screenText)
}

/** Editor has no user logic yet (pass / signature only). */
export function isEditorStillStub(screenText: string): boolean {
  const lines = extractEditorCodeText(screenText)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return true

  const bodyLines = lines.filter(
    (l) =>
      !/^(class |def |import |from |public |private |void |#include)/i.test(l) &&
      !/^\s*pass\s*$/i.test(l) &&
      l !== '...'
  )

  if (bodyLines.length === 0) return true

  return !bodyLines.some((l) => /\b(if|for|while|return\b|=)/.test(l))
}
