import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, OVERLAY_DEFAULTS } from '../shared/constants'
import { IPC_CHANNELS } from '../shared/ipc-channels'

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

  it('does not hide overlay during background watch (shows pill instead)', () => {
    const src = readFileSync(resolve(__dirname, '../main/overlay-window.ts'), 'utf-8')
    expect(src).not.toMatch(/win\.hide\(\)[\s\S]*setOverlayBackgroundWatch/)
    expect(src).toContain('showOverlayPill()')
    expect(src).not.toContain('app.setActivationPolicy(\'accessory\')')
  })

  it('keeps opaque overlay panel styles for readability', () => {
    const css = readFileSync(resolve(__dirname, '../renderer/styles.css'), 'utf-8')
    expect(css).toContain('.specter-overlay-panel')
    expect(css).toContain('rgba(12, 12, 18, 0.94)')
    expect(css).toContain('.specter-overlay-messages')
    expect(css).toContain('rgba(8, 8, 14, 0.98)')
  })

  it('routes double ⌘/ to work auto toggle (not one-shot explain)', () => {
    const hotkeys = readFileSync(resolve(__dirname, '../main/hotkey-manager.ts'), 'utf-8')
    expect(hotkeys).toContain('toggleWorkAutoMode(win)')
    expect(hotkeys).not.toContain('HOTKEY_ACTIVE_TAB')
    expect(hotkeys).not.toContain('analyzeActiveTab')
  })

  it('keeps coach screen-only (no journal bleed in coach mode)', () => {
    const ipc = readFileSync(resolve(__dirname, '../main/ipc-handlers.ts'), 'utf-8')
    expect(ipc).toMatch(/args\.coachMode\s*\?\s*''\s*:\s*journalEnabled/)
  })

  it('keeps work capture pinned to MacBook primary fallback', () => {
    const css = readFileSync(resolve(__dirname, './work-area-capture.ts'), 'utf-8')
    expect(css).toContain('planPinnedWorkDisplay')
    expect(css).toContain('displays.find((d) => d.isPrimary)')
  })
})
