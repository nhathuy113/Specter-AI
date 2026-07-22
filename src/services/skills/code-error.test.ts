import { describe, expect, it } from 'vitest'
import { extractCodeErrors, formatCodeErrors, detectCodeErrors } from './code-error'

describe('code-error skill', () => {
  it('extracts TypeScript error with file location', () => {
    const text = `
src/main/ipc-handlers.ts:248:11 - error TS2304: Cannot find name 'assistantMode'.
    at Object.<anonymous> (src/main/ipc-handlers.ts:248:11)
`
    const blocks = extractCodeErrors(text.split('\n'))
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks[0].message.toLowerCase()).toContain('cannot find name')
    expect(blocks[0].file).toContain('ipc-handlers.ts')
  })

  it('formats errors for the model', () => {
    const detected = detectCodeErrors('error TS2339: Property foo does not exist on type Bar')
    expect(detected).not.toBeNull()
    expect(formatCodeErrors(detected!.blocks)).toContain('Property foo')
  })
})
