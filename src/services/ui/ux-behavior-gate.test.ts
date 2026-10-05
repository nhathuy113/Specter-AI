import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, OVERLAY_DEFAULTS, DEFAULT_WORK_COACH_SYSTEM_PROMPT, WORK_COACH_REPLY_FORMAT_VI } from '../../shared/constants'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

/**
 * Regression gates for UX contracts the user validated in production.
 * Failures here mean a future change drifted from agreed behavior.
 */
describe('ux behavior gate', () => {
  it('keeps readable overlay defaults', () => {
    expect(OVERLAY_DEFAULTS.opacity).toBe(1.0)
    expect(DEFAULT_SETTINGS.overlayOpacity).toBe(1.0)
    expect(DEFAULT_SETTINGS.theme).toBe('dark')
  })

  it('keeps overlay IPC surface for pill + expand/collapse', () => {
    expect(IPC_CHANNELS.OVERLAY_SET_PILL_MODE).toBe('overlay:set-pill-mode')
    expect(IPC_CHANNELS.OVERLAY_EXPAND).toBe('overlay:expand')
    expect(IPC_CHANNELS.OVERLAY_COLLAPSE).toBe('overlay:collapse')
    expect(IPC_CHANNELS.WORK_AUTO_TOGGLED).toBe('work-auto:toggled')
  })

  it('does not shrink expanded overlay when auto/watch toggles', () => {
    const src = readFileSync(resolve(__dirname, '../../main/overlay-window.ts'), 'utf-8')
    expect(src).toContain('Expanded overlay stays expanded when auto/watch toggles on')
    expect(src).toContain('applyOverlayBackgroundLayout')
    expect(src).not.toContain('applyOverlayInteractiveState')
  })

  it('does not hide overlay during background watch (shows pill when hidden)', () => {
    const src = readFileSync(resolve(__dirname, '../../main/overlay-window.ts'), 'utf-8')
    expect(src).not.toMatch(/win\.hide\(\)[\s\S]*setOverlayBackgroundWatch/)
    expect(src).toContain('showOverlayPill()')
    expect(src).not.toContain('app.setActivationPolicy(\'accessory\')')
    expect(src).toContain('app.dock?.hide()')
    expect(src).not.toContain('app.dock?.show()')
  })

  it('pill logs work only; coach + debug when expanded panel open', () => {
    const coachLoop = readFileSync(resolve(__dirname, '../../main/continuous-coach-loop.ts'), 'utf-8')
    const journalLoop = readFileSync(resolve(__dirname, '../../main/activity-journal-loop.ts'), 'utf-8')
    const overlay = readFileSync(resolve(__dirname, '../../main/overlay-window.ts'), 'utf-8')
    expect(overlay).toContain('shouldRunCoachAutoUi')
    expect(overlay).toContain('shouldRunWorkJournal')
    expect(overlay).toContain('shouldRunCoachVerboseLogging')
    expect(overlay).toContain('isOverlayExpandedForCoach')
    expect(coachLoop).toContain('shouldRunCoachAutoUi()')
    expect(coachLoop).toContain('recordTrigger: uiReady')
    expect(coachLoop).toContain('flushCoachTickOnExpand')
    expect(coachLoop).toContain('shouldRunWorkJournal()')
    expect(journalLoop).toContain('shouldRunWorkJournal()')
  })

  it('keeps macOS native vibrancy glass on overlay window', () => {
    const css = readFileSync(resolve(__dirname, '../../renderer/styles.css'), 'utf-8')
    expect(css).toContain('.specter-overlay-panel')
    expect(css).toContain('specter-native-glass')
    expect(css).toContain('.specter-overlay-messages')
    expect(css).toContain('background: transparent')
    const overlay = readFileSync(resolve(__dirname, '../../main/overlay-window.ts'), 'utf-8')
    expect(overlay).toContain("vibrancy: 'under-window'")
    expect(overlay).toContain('setVibrancy')
    expect(overlay).toContain('fitOverlayToContent')
    expect(IPC_CHANNELS.OVERLAY_SET_GLASS_MODE).toBe('overlay:set-glass-mode')
  })

  it('routes double ⌘/ to work auto toggle (not one-shot explain)', () => {
    const hotkeys = readFileSync(resolve(__dirname, '../../main/hotkey-manager.ts'), 'utf-8')
    expect(hotkeys).toContain('toggleWorkAutoMode(win)')
    expect(hotkeys).not.toContain('HOTKEY_ACTIVE_TAB')
    expect(hotkeys).not.toContain('analyzeActiveTab')
  })

  it('keeps work coach reply format (5 sections, Vietnamese)', () => {
    expect(WORK_COACH_REPLY_FORMAT_VI).toContain('**Trạng thái:**')
    expect(WORK_COACH_REPLY_FORMAT_VI).toContain('**Tại sao:**')
    expect(WORK_COACH_REPLY_FORMAT_VI).toContain('Giải pháp')
    expect(WORK_COACH_REPLY_FORMAT_VI).toContain('**Đọc code:**')
    expect(WORK_COACH_REPLY_FORMAT_VI).toContain('2–3 câu')
    expect(DEFAULT_WORK_COACH_SYSTEM_PROMPT).toContain('First message on a new problem: 6 sections')
    expect(DEFAULT_WORK_COACH_SYSTEM_PROMPT).toContain('CROP of the active work window')
  })

  it('keeps adaptive coach IPC for work expand (Gemini + optional Cursor)', () => {
    expect(IPC_CHANNELS.AI_COACH_TRIPLE_START).toBe('ai:coach-triple-start')
    expect(IPC_CHANNELS.AI_COACH_TRIPLE_PANEL).toBe('ai:coach-triple-panel')
    expect(IPC_CHANNELS.AI_COACH_TRIPLE_DONE).toBe('ai:coach-triple-done')
    const runner = readFileSync(resolve(__dirname, '../work/work-coach-runner.ts'), 'utf-8')
    const orchestrator = readFileSync(resolve(__dirname, '../work/work-coach-orchestrator.ts'), 'utf-8')
    expect(orchestrator).toContain('WORK_COACH_GEMINI_LITE')
    expect(orchestrator).toContain('WORK_COACH_GEMINI_36')
    expect(orchestrator).toContain('includeCursor')
    expect(runner).toContain('completeCursorWorkCoach')
  })

  it('keeps coach screen-only (no journal bleed in coach mode)', () => {
    const ipc = readFileSync(resolve(__dirname, '../../main/ipc/ai-handlers.ts'), 'utf-8')
    expect(ipc).toMatch(/effectiveCoachMode\s*\?\s*''\s*:\s*journalEnabled/)
  })

  it('keeps work capture pinned to MacBook primary fallback', () => {
    const css = readFileSync(resolve(__dirname, '../capture/work-area-capture.ts'), 'utf-8')
    expect(css).toContain('planPinnedWorkDisplay')
    expect(css).toContain('displays.find((d) => d.isPrimary)')
  })
})
