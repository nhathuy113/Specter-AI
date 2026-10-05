import { BrowserWindow } from 'electron'
import { CaptureExclusionV2, MacCaptureExclusionV2, type CaptureExclusion } from '../services/capture/mac-capture-exclusion-v2'
import { applyExcludeFromCapture } from './capture-protection'
import { koffiMacCaptureShape } from './mac-capture-shape'

export const captureExclusion: CaptureExclusion = new CaptureExclusionV2(
  process.platform,
  new MacCaptureExclusionV2(koffiMacCaptureShape),
  win => applyExcludeFromCapture(win as BrowserWindow)
)
