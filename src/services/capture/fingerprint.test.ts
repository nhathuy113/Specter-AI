import { describe, expect, it } from 'vitest'
import { fingerprintScreenText, normalizeScreenText } from './fingerprint'

const BRUSSELS_BATTLE = `
Brussels
2 hours ago.
Manpower: 23
Armored: 6
Air: 0
Other: 15
Manpower: 17.36K
Armored: 44
Air: 0
Other: 1.83K
`.trim()

const BRUSSELS_BATTLE_LATER = `
Brussels
3 hours ago.
Manpower: 23
Armored: 6
Air: 0
Other: 15
Manpower: 17.36K
Armored: 44
Air: 0
Other: 1.83K
`.trim()

const NAMUR_BATTLE = `
Namur
5 days ago.
Manpower: 112
Armored: 9
Air: 0
Other: 14
Manpower: 20.75K
Armored: 0
Air: 0
Other: 2.15K
`.trim()

describe('normalizeScreenText', () => {
  it('strips relative timestamps but keeps battle stats', () => {
    expect(normalizeScreenText(BRUSSELS_BATTLE)).toBe(normalizeScreenText(BRUSSELS_BATTLE_LATER))
  })

  it('changes fingerprint when battle location or stats change', () => {
    expect(fingerprintScreenText(BRUSSELS_BATTLE)).not.toBe(fingerprintScreenText(NAMUR_BATTLE))
  })
})

describe('fingerprintScreenText', () => {
  it('returns empty fingerprint for blank OCR', () => {
    expect(fingerprintScreenText('   \n  ')).toBe('')
  })

  it('is stable for identical normalized content', () => {
    const first = fingerprintScreenText(BRUSSELS_BATTLE)
    const second = fingerprintScreenText(BRUSSELS_BATTLE)
    expect(first).toBe(second)
    expect(first.length).toBe(64)
  })
})
