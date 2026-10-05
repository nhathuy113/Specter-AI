export interface CodeErrorBlock {
  headline: string
  file?: string
  line?: number
  column?: number
  message: string
  stackLines: string[]
}

const ERROR_HEADLINE =
  /^(?:error|warning|failed to compile|cannot find module|syntaxerror|typeerror|referenceerror|exception)\b/i
const TS_ERROR = /error TS(\d+):\s*(.+)/i
const STACK_LINE = /^\s*at .+\(.+:\d+:\d+\)/
const FILE_LINE = /([A-Za-z0-9_./\\-]+\.(?:tsx?|jsx?|mjs|cjs|vue|py|go|rs)):(\d+)(?::(\d+))?/

export function extractCodeErrors(lines: string[]): CodeErrorBlock[] {
  const blocks: CodeErrorBlock[] = []
  let current: Partial<CodeErrorBlock> | null = null

  const pushCurrent = (): void => {
    if (!current?.message && !current?.headline) return
    blocks.push({
      headline: current.headline || current.message || 'Error',
      file: current.file,
      line: current.line,
      column: current.column,
      message: current.message || current.headline || 'Unknown error',
      stackLines: current.stackLines || []
    })
    current = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const tsMatch = line.match(TS_ERROR)
    if (tsMatch) {
      pushCurrent()
      current = {
        headline: line,
        message: tsMatch[2].trim(),
        stackLines: []
      }
      const fileMatch = line.match(FILE_LINE)
      if (fileMatch) {
        current.file = fileMatch[1]
        current.line = parseInt(fileMatch[2], 10)
        if (fileMatch[3]) current.column = parseInt(fileMatch[3], 10)
      }
      continue
    }

    if (ERROR_HEADLINE.test(line) && !STACK_LINE.test(line)) {
      pushCurrent()
      current = { headline: line, message: line, stackLines: [] }
      const fileMatch = line.match(FILE_LINE)
      if (fileMatch) {
        current.file = fileMatch[1]
        current.line = parseInt(fileMatch[2], 10)
        if (fileMatch[3]) current.column = parseInt(fileMatch[3], 10)
      }
      continue
    }

    if (STACK_LINE.test(line)) {
      if (!current) current = { headline: 'Stack trace', message: 'Runtime error', stackLines: [] }
      current.stackLines = [...(current.stackLines || []), line]
      continue
    }

    if (current && /error|exception|failed/i.test(line)) {
      current.message = line
    }
  }

  pushCurrent()
  return blocks
}

export function formatCodeErrors(blocks: CodeErrorBlock[]): string {
  if (blocks.length === 0) return ''

  return blocks
    .slice(0, 5)
    .map((block, index) => {
      const parts = [`${index + 1}. ${block.message}`]
      if (block.file) {
        parts.push(`File: ${block.file}${block.line ? `:${block.line}` : ''}`)
      }
      if (block.stackLines.length) {
        parts.push(`Stack: ${block.stackLines.slice(0, 3).join(' | ')}`)
      }
      return parts.join(' — ')
    })
    .join('\n')
}

export function detectCodeErrors(text: string): { blocks: CodeErrorBlock[]; focusedText: string } | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const blocks = extractCodeErrors(lines)
  if (blocks.length === 0) return null
  return {
    blocks,
    focusedText: formatCodeErrors(blocks)
  }
}
