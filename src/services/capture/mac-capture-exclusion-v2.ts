export interface MacCaptureShape {
  windowId(handle: Buffer): number | null
  exclude(windowId: number, width: number, height: number): boolean
}

export interface CaptureProtectedWindow {
  isDestroyed(): boolean
  setContentProtection(enable: boolean): void
  getNativeWindowHandle(): Buffer
  getBounds(): { width: number; height: number }
}

/** macOS 15+ capture exclusion. `sharingType` alone is ignored by ScreenCaptureKit. */
export class MacCaptureExclusionV2 {
  constructor(private readonly shape: MacCaptureShape) {}

  protect(win: CaptureProtectedWindow): boolean {
    if (win.isDestroyed()) return false
    win.setContentProtection(true)
    const id = this.shape.windowId(win.getNativeWindowHandle())
    if (id == null) return false
    const { width, height } = win.getBounds()
    return this.shape.exclude(id, width, height)
  }
}

export interface CaptureExclusion {
  protect(win: CaptureProtectedWindow): boolean
}

export class CaptureExclusionV2 implements CaptureExclusion {
  constructor(
    private readonly platform: NodeJS.Platform,
    private readonly mac: MacCaptureExclusionV2,
    private readonly excludeWindows: (win: CaptureProtectedWindow) => boolean
  ) {}

  protect(win: CaptureProtectedWindow): boolean {
    if (win.isDestroyed()) return false
    if (this.platform === 'darwin') return this.mac.protect(win)
    if (this.platform === 'win32') return this.excludeWindows(win)
    return false
  }
}
