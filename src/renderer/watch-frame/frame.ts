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
    setAskHover(true)
    document.body.style.cursor = askLoading ? 'progress' : 'pointer'
    return
  }
  setAskHover(false)
  const edge = hitWatchFrame(event.clientX, event.clientY, window.innerWidth, window.innerHeight)
  passthrough(edge === null)
  document.body.style.cursor = edge === 'move' ? 'move' : edge ? `${edge}-resize` : 'default'
})

const askButton = document.querySelector('#ask')
let askLoading = false
function setAskHover(on: boolean): void {
  askButton?.classList.toggle('is-hover', on && !askLoading)
}
function setAskLoading(on: boolean): void {
  askLoading = on
  askButton?.classList.toggle('is-loading', on)
  askButton?.classList.toggle('is-hover', false)
  if (askButton) askButton.textContent = on ? 'Đang gửi…' : 'Gửi'
}
window.specterAPI.onWatchFrameAskState(setAskLoading)

function isAsk(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('#ask')
}

window.addEventListener('pointerdown', event => {
  if (event.button !== 0) return
  if (isAsk(event.target)) {
    event.preventDefault()
    if (askLoading) return
    passthrough(false)
    setAskLoading(true)
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
