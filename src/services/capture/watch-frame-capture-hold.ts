export type FrameCaptureHold = { hidden: boolean; restore: () => void }

export interface WatchFrameSurface {
  readonly dragging: boolean
  readonly visible: boolean
  hide(): void
  restore(): void
}

export interface FrameVisibilityPolicy {
  keepsVisible(): boolean
}

/** OS already omits the border from screenshots. */
export class ExcludedFromCapturePolicy implements FrameVisibilityPolicy {
  keepsVisible(): boolean { return true }
}

/** Linux has no capture exclusion, so the border must leave the screen. */
export class HiddenDuringCapturePolicy implements FrameVisibilityPolicy {
  keepsVisible(): boolean { return false }
}

export function frameVisibilityPolicy(platform: NodeJS.Platform): FrameVisibilityPolicy {
  return platform === 'linux' ? new HiddenDuringCapturePolicy() : new ExcludedFromCapturePolicy()
}

export interface CaptureHold {
  readonly suspended: boolean
  begin(surface: WatchFrameSurface): FrameCaptureHold
}

export class WatchFrameCaptureHold implements CaptureHold {
  private suspensions = 0

  constructor(private readonly policy: FrameVisibilityPolicy) {}

  get suspended(): boolean {
    return this.suspensions > 0
  }

  begin(surface: WatchFrameSurface): FrameCaptureHold {
    if (surface.dragging) throw new Error('Watch frame is being adjusted. Release the pointer before capturing.')
    if (this.policy.keepsVisible()) return { hidden: false, restore() {} }
    this.suspensions++
    const hidden = surface.visible
    if (hidden) surface.hide()
    let restored = false
    return {
      hidden,
      restore: () => {
        if (restored) return
        restored = true
        this.suspensions--
        if (this.suspensions === 0) surface.restore()
      }
    }
  }
}

export const watchFrameCaptureHold: CaptureHold = new WatchFrameCaptureHold(frameVisibilityPolicy(process.platform))
