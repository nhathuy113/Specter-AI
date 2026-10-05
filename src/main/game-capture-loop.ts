import { app } from 'electron'
import path from 'path'
import { DEFAULT_SETTINGS } from '../shared/constants'
import { detectGame, isGameStillForeground, type DetectedGame } from '../services/game/game-mode'
import { fingerprintPng, shouldKeepFrame, type BufferedFrame } from '../services/game/game-frame-dedup'
import { shouldSkipGameFrame } from '../services/game/game-frame-filter'
import { GameCaptureStore } from '../services/game/game-capture-store'
import { runGameHourlyAi } from '../services/game/game-hourly-ai'
import { getSetting } from '../services/settings/store'
import { captureGameFrame, isCurrentlyCapturing } from './screen-capture'

let captureTimer: ReturnType<typeof setInterval> | null = null
let blockTimer: ReturnType<typeof setInterval> | null = null
let hourlyTimer: ReturnType<typeof setTimeout> | null = null

let activeSession: DetectedGame | null = null
let sessionStartMs = 0
let blockFrames: BufferedFrame[] = []
let blockStartMs = 0
let lastKeptHash: string | null = null
let hourStartMs = 0
let ticking = false

function storeRoot(): string {
  return path.join(app.getPath('userData'), 'game-captures')
}

function getStore(): GameCaptureStore {
  return new GameCaptureStore(storeRoot())
}

function hourBoundaryMs(date = new Date()): number {
  const d = new Date(date)
  d.setMinutes(0, 0, 0)
  return d.getTime()
}

async function flushBlock(force = false): Promise<void> {
  if (!activeSession || blockFrames.length === 0) return
  const now = Date.now()
  const blockSec = getSetting<number>('gameBlockSec') || DEFAULT_SETTINGS.gameBlockSec
  if (!force && blockStartMs > 0 && now - blockStartMs < blockSec * 1000) return

  const endMs = now
  const startMs = blockStartMs || endMs - blockSec * 1000
  const quality =
    getSetting<number>('gameDeepCompressQuality') || DEFAULT_SETTINGS.gameDeepCompressQuality
  await getStore().writeBlock(
    activeSession.profile.id,
    activeSession.profile.label,
    startMs,
    endMs,
    blockFrames,
    quality
  )
  console.info(
    `[Specter] Game block saved: ${activeSession.profile.id} ${blockFrames.length} keyframes`
  )
  blockFrames = []
  blockStartMs = 0
  lastKeptHash = null
}

async function runHourlyAi(): Promise<void> {
  const endMs = hourBoundaryMs(new Date())
  const startMs = endMs - 3600_000
  const store = getStore()
  const gameIds = new Set<string>(store.listGameIds(new Date(endMs - 1)))
  if (activeSession) gameIds.add(activeSession.profile.id)

  for (const gameId of gameIds) {
    const blocks = store.listBlocksInHour(gameId, startMs, endMs)
    if (blocks.length === 0) continue
    const label = blocks[0].gameLabel || gameId
    await runGameHourlyAi({
      store,
      gameId,
      gameLabel: label,
      hourStartMs: startMs,
      hourEndMs: endMs,
      blocks
    })
  }
  hourStartMs = endMs
}

async function gameCaptureTick(): Promise<void> {
  if (ticking || isCurrentlyCapturing()) return
  ticking = true
  try {
    const frame = await captureGameFrame()
    const game = detectGame(frame.appName, frame.windowTitle)

    if (!game) {
      if (activeSession && !activeSession.profile.watchWhileBackground) {
        await flushBlock(true)
        activeSession = null
      }
      return
    }

    if (activeSession && !isGameStillForeground(activeSession, frame.appName, frame.windowTitle)) {
      if (!activeSession.profile.watchWhileBackground) {
        await flushBlock(true)
        activeSession = null
        return
      }
    }

    if (!activeSession) {
      activeSession = game
      sessionStartMs = frame.timestamp
      blockStartMs = frame.timestamp
      hourStartMs = hourStartMs || hourBoundaryMs(new Date(frame.timestamp))
      console.info(`[Specter] Game Mode session: ${game.profile.label}`)
    }

    const warmupSec = getSetting<number>('gameWarmupSec') ?? DEFAULT_SETTINGS.gameWarmupSec
    const skip = await shouldSkipGameFrame(
      frame.pngBuffer,
      frame.windowTitle,
      frame.timestamp - sessionStartMs,
      warmupSec
    )
    if (skip.skip) return

    const hash = await fingerprintPng(frame.pngBuffer)
    if (!shouldKeepFrame(hash, lastKeptHash)) return

    lastKeptHash = hash
    if (blockStartMs === 0) blockStartMs = frame.timestamp
    blockFrames.push({
      timestamp: frame.timestamp,
      hash,
      pngBuffer: frame.pngBuffer
    })
  } catch (err) {
    console.warn('[Specter] Game capture tick failed:', err)
  } finally {
    ticking = false
  }
}

function scheduleHourlyAi(): void {
  if (hourlyTimer) clearTimeout(hourlyTimer)
  const intervalSec = getSetting<number>('gameHourlyAiSec') || DEFAULT_SETTINGS.gameHourlyAiSec
  const now = Date.now()
  const next = hourBoundaryMs(new Date(now)) + intervalSec * 1000
  const delay = Math.max(1000, next - now)
  hourlyTimer = setTimeout(async () => {
    await flushBlock(true)
    await runHourlyAi()
    scheduleHourlyAi()
  }, delay)
}

export function stopGameCaptureLoop(): void {
  if (captureTimer) {
    clearInterval(captureTimer)
    captureTimer = null
  }
  if (blockTimer) {
    clearInterval(blockTimer)
    blockTimer = null
  }
  if (hourlyTimer) {
    clearTimeout(hourlyTimer)
    hourlyTimer = null
  }
  void flushBlock(true)
  activeSession = null
  sessionStartMs = 0
  blockFrames = []
}

export function syncGameCaptureLoop(): void {
  const enabled = getSetting<boolean>('gameModeEnabled') ?? DEFAULT_SETTINGS.gameModeEnabled
  stopGameCaptureLoop()
  if (!enabled) return

  const intervalMs =
    (getSetting<number>('gameCaptureIntervalSec') || DEFAULT_SETTINGS.gameCaptureIntervalSec) * 1000
  const blockSec = getSetting<number>('gameBlockSec') || DEFAULT_SETTINGS.gameBlockSec

  captureTimer = setInterval(() => {
    void gameCaptureTick()
  }, Math.max(500, intervalMs))

  blockTimer = setInterval(() => {
    void flushBlock(true)
  }, blockSec * 1000)

  scheduleHourlyAi()
  console.info(
    `[Specter] Game Mode on — ${intervalMs}ms capture, ${blockSec}s block dedup, hourly AI`
  )
}

export function getActiveGameSessionForTest(): DetectedGame | null {
  return activeSession
}
