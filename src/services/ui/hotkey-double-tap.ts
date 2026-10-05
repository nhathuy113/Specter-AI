/** Double-tap ⌘/ window — exported for regression gates. */
export const ACTIVE_TAB_DOUBLE_TAP_MS = 450

export function shouldFireActiveTabDoubleTap(lastPressMs: number, nowMs: number): 'first-tap' | 'double-tap' {
  if (lastPressMs > 0 && nowMs - lastPressMs <= ACTIVE_TAB_DOUBLE_TAP_MS) {
    return 'double-tap'
  }
  return 'first-tap'
}

export function nextActiveTabPressMs(action: 'first-tap' | 'double-tap', nowMs: number): number {
  return action === 'double-tap' ? 0 : nowMs
}
