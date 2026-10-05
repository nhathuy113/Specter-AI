import type { SpecterAPI } from '../../preload/index'
import { hitWatchFrame } from '../../services/capture/watch-frame'
import { createWatchFrameDrag } from '../../services/ui/watch-frame-drag'

declare global {
  interface Window { specterAPI: SpecterAPI }
}

const drag = createWatchFrameDrag(window.specterAPI.getWatchFrameBounds, window.specterAPI.setWatchFrameBounds)
let dragging = false
let ignored: boolean | undefined
function passthrough(ignore: boolean): void {
  if (ignore === ignored) return
  ignored = ignore
  window.specterAPI.setWatchFramePassthrough(ignore)
}

window.addEventListener('pointermove', event => {
  if (dragging) drag.move({ x: event.screenX, y: event.screenY })
})

// Electron forwards mousemove while click-through is enabled.
window.addEventListener('mousemove', event => {
  if (dragging) return
  if (isAsk(event.target)) {
    passthrough(false)
    document.body.style.cursor = 'pointer'
    return
  }
  const edge = hitWatchFrame(event.clientX, event.clientY, window.innerWidth, window.innerHeight)
  passthrough(edge === null)
  document.body.style.cursor = edge === 'move' ? 'move' : edge ? `${edge}-resize` : 'default'
})

function isAsk(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('#ask')
}

window.addEventListener('pointerdown', event => {
  if (event.button !== 0) return
  if (isAsk(event.target)) {
    event.preventDefault()
    passthrough(false)
    window.specterAPI.askWatchFrame()
    return
  }
  const edge = hitWatchFrame(event.clientX, event.clientY, window.innerWidth, window.innerHeight)
  if (!edge) return
  event.preventDefault()
  dragging = true
  window.specterAPI.setWatchFrameDragging(true)
  passthrough(false)
  document.documentElement.setPointerCapture(event.pointerId)
  void drag.begin(edge, { x: event.screenX, y: event.screenY }).catch(() => endDrag())
})

function endDrag(): void {
  dragging = false
  window.specterAPI.setWatchFrameDragging(false)
  drag.end()
  passthrough(true)
}
window.addEventListener('pointerup', endDrag)
window.addEventListener('pointercancel', endDrag)
document.documentElement.addEventListener('lostpointercapture', endDrag)
window.addEventListener('blur', endDrag)
passthrough(true)
