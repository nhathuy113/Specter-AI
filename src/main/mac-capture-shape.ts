import type { MacCaptureShape } from '../services/capture/mac-capture-exclusion-v2'

type BoundShape = {
  msg: (self: unknown, sel: unknown) => unknown
  msgU64: (self: unknown, sel: unknown) => number | bigint
  windowSel: unknown
  windowNumberSel: unknown
  connectionId: () => number
  createRegion: (rect: { origin: { x: number; y: number }; size: { width: number; height: number } }) => unknown
  excludeShape: (cid: number, wid: number, region: unknown) => number
  release: (region: unknown) => void
}

let bound: BoundShape | null = null
let loadFailed = false
let loggedExcludeFailure = false

function loadShape(): BoundShape | null {
  if (bound) return bound
  if (loadFailed || process.platform !== 'darwin') return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require('koffi')
    const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
    const objc = koffi.load('/usr/lib/libobjc.A.dylib')
    const CGPoint = koffi.struct('CGPoint', { x: 'double', y: 'double' })
    const CGSize = koffi.struct('CGSize', { width: 'double', height: 'double' })
    const CGRect = koffi.struct('CGRect', { origin: CGPoint, size: CGSize })
    const sel = objc.func('sel_registerName', 'void *', ['string'])
    bound = {
      msg: objc.func('objc_msgSend', 'void *', ['void *', 'void *']),
      msgU64: objc.func('objc_msgSend', 'uint64', ['void *', 'void *']),
      windowSel: sel('window'),
      windowNumberSel: sel('windowNumber'),
      connectionId: cg.func('CGSMainConnectionID', 'uint32', []),
      createRegion: cg.func('CGRegionCreateWithRect', 'void *', [CGRect]),
      excludeShape: cg.func('CGSSetWindowCaptureExcludeShape', 'int', ['uint32', 'uint32', 'void *']),
      release: cg.func('CFRelease', 'void', ['void *'])
    }
    return bound
  } catch (err) {
    console.error('[Specter] mac capture exclusion v2 load failed:', err)
    loadFailed = true
    return null
  }
}

function windowNumber(raw: number | bigint): number | null {
  const id = typeof raw === 'bigint' ? Number(raw) : raw
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export function macCaptureShapeLoaded(): boolean {
  return loadShape() != null
}

export const koffiMacCaptureShape: MacCaptureShape = {
  windowId(handle: Buffer): number | null {
    const shape = loadShape()
    if (!shape || handle.byteLength < 8) return null
    const view = handle.readBigUInt64LE(0)
    if (view === 0n) return null
    const nsWindow = shape.msg(view, shape.windowSel)
    if (nsWindow == null) return null
    return windowNumber(shape.msgU64(nsWindow, shape.windowNumberSel))
  },

  exclude(windowId: number, width: number, height: number): boolean {
    const shape = loadShape()
    if (!shape) return false
    const region = shape.createRegion({ origin: { x: 0, y: 0 }, size: { width, height } })
    if (region == null) return false
    const status = shape.excludeShape(shape.connectionId(), windowId, region)
    shape.release(region)
    if (status !== 0) {
      if (!loggedExcludeFailure) console.warn('[Specter] CGSSetWindowCaptureExcludeShape failed:', status)
      loggedExcludeFailure = true
      return false
    }
    return true
  }
}
