import { desktopCapturer, screen } from 'electron'
import { displayAtScreenshotIndex } from '../services/capture/display-capture'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** Capture one display from inside Electron. The external helper fails under launchd. */
export async function captureScreenPng(displayIndex = 0): Promise<Buffer> {
  if (!Number.isInteger(displayIndex) || displayIndex < 0) throw new Error('Invalid capture display index')
  const displays = screen.getAllDisplays()
  const display = displayAtScreenshotIndex(displays, screen.getPrimaryDisplay().id, displayIndex)
  if (!display) throw new Error('No display to capture')
  const width = Math.max(1, Math.round(display.bounds.width * display.scaleFactor))
  const height = Math.max(1, Math.round(display.bounds.height * display.scaleFactor))
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height }
  })
  const id = String(display.id)
  const source = sources.find((item) => item.display_id === id || item.id.startsWith(`screen:${id}:`))
  if (!source) throw new Error('Screen capture source not found')
  const png = source.thumbnail.toPNG()
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Screen capture returned an invalid PNG')
  return png
}
