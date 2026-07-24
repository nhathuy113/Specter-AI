import { describe, expect, it } from 'vitest'
import {
  appendWorkCoachContext,
  extractStableContentId,
  workSessionKey
} from './work-coach-session'

describe('work-coach-session', () => {
  it('builds stable session key from work area + video title', () => {
    const text = 'youtube.com\nPHÂN TÍCH VĨ MÔ VÀ DOANH NGHIỆP\nGDP VÀ CÁC TRỌNG SỐ'
    const a = workSessionKey(text, { appName: 'Work: Built-in Retina Display', windowTitle: 'pinned' })
    const b = workSessionKey(text, { appName: 'Work: Built-in Retina Display', windowTitle: 'pinned' })
    expect(a).toBe(b)
  })

  it('resets key when video topic changes', () => {
    const meta = { appName: 'Work: Built-in', windowTitle: 'x' }
    const k1 = workSessionKey('PHÂN TÍCH GDP 2024', meta)
    const k2 = workSessionKey('LÃI SUẤT VÀ TÍN DỤNG NGÂN HÀNG', meta)
    expect(k1).not.toBe(k2)
  })

  it('appends session thread to coach user message', () => {
    const out = appendWorkCoachContext('[CONTENT] slide 2', 'Already covered GDP 7.63%')
    expect(out).toContain('SESSION ON THIS SCREEN SO FAR')
    expect(out).toContain('GDP 7.63%')
  })

  it('extracts youtube-like content id', () => {
    expect(extractStableContentId('Brave\nPHÂN TÍCH VĨ MÔ youtube')).toMatch(/phân tích/)
  })
})
