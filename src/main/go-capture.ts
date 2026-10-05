import { spawn, execFile } from 'child_process'
import { existsSync } from 'fs'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'
import { app } from 'electron'
import { runPngCapture } from '../services/capture/capture-process'

const execFileAsync = promisify(execFile)

export function resolveCaptureBinary(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'specter-capture')
    : path.join(app.getAppPath(), 'capture', 'bin', 'specter-capture')
}

/** Optional Go helper; development falls back to the same native macOS command. */
export async function captureScreenPng(displayIndex = 0): Promise<Buffer> {
  if (!Number.isInteger(displayIndex) || displayIndex < 0) throw new Error('Invalid capture display index')
  const bin = resolveCaptureBinary()
  if (existsSync(bin)) {
    return runPngCapture(() => spawn(bin, ['-display', String(displayIndex + 1)], { stdio: ['ignore', 'pipe', 'pipe'] }))
  }
  const directory = await mkdtemp(path.join(tmpdir(), 'specter-capture-'))
  const file = path.join(directory, 'screen.png')
  try {
    await execFileAsync('/usr/sbin/screencapture', ['-x', '-D', String(displayIndex + 1), file], { timeout: 15_000 })
    return await readFile(file)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
