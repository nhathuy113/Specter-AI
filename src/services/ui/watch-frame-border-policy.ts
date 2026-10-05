export type WatchFrameBorderAction = 'ignore' | 'hide' | 'show'

/** Command+] only changes the border. Watch off has no border to toggle. */
export function nextWatchFrameBorder(wanted: boolean, visible: boolean): WatchFrameBorderAction {
  if (!wanted) return 'ignore'
  return visible ? 'hide' : 'show'
}

/** A user-closed border stays hidden until the next toggle. */
export function mayAutoShowWatchFrame(userClosed: boolean): boolean {
  return !userClosed
}
