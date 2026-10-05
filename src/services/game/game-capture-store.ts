import fs from 'fs'
import path from 'path'
import type { BufferedFrame } from './game-frame-dedup'
import { encodePngBufferToWebp } from './game-image-compress'

export interface GameBlockManifest {
  gameId: string
  gameLabel: string
  blockStartMs: number
  blockEndMs: number
  frames: GameBlockFrame[]
}

export interface GameBlockFrame {
  timestamp: number
  hash: string
  /** WebP keyframe on disk (current format) */
  imageFile: string
  /** @deprecated legacy PNG blocks */
  pngFile?: string
  webpFile?: string
}

export interface GameHourlyReport {
  gameId: string
  hourStartMs: number
  hourEndMs: number
  generatedAt: number
  aiSummary: string
  blockIds: string[]
  /** Rolling context passed into the next hourly AI call */
  sessionThread?: string
  previousHourSummary?: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function blockDirName(startMs: number, endMs: number): string {
  const s = new Date(startMs)
  const e = new Date(endMs)
  return `${pad2(s.getHours())}${pad2(s.getMinutes())}-${pad2(e.getHours())}${pad2(e.getMinutes())}`
}

export function hourDirName(hourStartMs: number): string {
  const d = new Date(hourStartMs)
  return `${pad2(d.getHours())}00`
}

export class GameCaptureStore {
  constructor(private readonly rootDir: string) {}

  gameRoot(gameId: string, day = new Date()): string {
    const y = day.getFullYear()
    const m = pad2(day.getMonth() + 1)
    const d = pad2(day.getDate())
    return path.join(this.rootDir, `${y}-${m}-${d}`, gameId)
  }

  async writeBlock(
    gameId: string,
    gameLabel: string,
    blockStartMs: number,
    blockEndMs: number,
    frames: BufferedFrame[],
    webpQuality = 35
  ): Promise<GameBlockManifest> {
    const dir = path.join(this.gameRoot(gameId), 'blocks', blockDirName(blockStartMs, blockEndMs))
    fs.mkdirSync(dir, { recursive: true })

    const manifestFrames: GameBlockFrame[] = []
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]!
      const name = `kf-${pad2(i + 1)}.webp`
      const webp = await encodePngBufferToWebp(f.pngBuffer, { webpQuality })
      fs.writeFileSync(path.join(dir, name), webp)
      manifestFrames.push({
        timestamp: f.timestamp,
        hash: f.hash,
        imageFile: name
      })
    }

    const manifest: GameBlockManifest = {
      gameId,
      gameLabel,
      blockStartMs,
      blockEndMs,
      frames: manifestFrames
    }
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
    return manifest
  }

  listBlocksInHour(gameId: string, hourStartMs: number, hourEndMs: number): GameBlockManifest[] {
    const blocksRoot = path.join(this.gameRoot(gameId, new Date(hourStartMs)), 'blocks')
    if (!fs.existsSync(blocksRoot)) return []

    const out: GameBlockManifest[] = []
    for (const name of fs.readdirSync(blocksRoot)) {
      const manifestPath = path.join(blocksRoot, name, 'manifest.json')
      if (!fs.existsSync(manifestPath)) continue
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as GameBlockManifest
      if (manifest.blockEndMs > hourStartMs && manifest.blockStartMs < hourEndMs) {
        out.push(manifest)
      }
    }
    return out.sort((a, b) => a.blockStartMs - b.blockStartMs)
  }

  blockAbsolutePath(gameId: string, blockStartMs: number, blockEndMs: number, file: string): string {
    return path.join(
      this.gameRoot(gameId, new Date(blockStartMs)),
      'blocks',
      blockDirName(blockStartMs, blockEndMs),
      file
    )
  }

  saveHourlyReport(report: GameHourlyReport, markdown: string): string {
    const dir = path.join(this.gameRoot(report.gameId, new Date(report.hourStartMs)), 'hourly')
    fs.mkdirSync(dir, { recursive: true })
    const label = hourDirName(report.hourStartMs)
    fs.writeFileSync(path.join(dir, `${label}.json`), JSON.stringify(report, null, 2), 'utf-8')
    fs.writeFileSync(path.join(dir, `${label}.md`), markdown, 'utf-8')
    return path.join(dir, `${label}.md`)
  }

  listGameIds(day = new Date()): string[] {
    const y = day.getFullYear()
    const m = pad2(day.getMonth() + 1)
    const d = pad2(day.getDate())
    const dayDir = path.join(this.rootDir, `${y}-${m}-${d}`)
    if (!fs.existsSync(dayDir)) return []
    return fs.readdirSync(dayDir).filter((name) => {
      const p = path.join(dayDir, name)
      return fs.statSync(p).isDirectory()
    })
  }

  /** Latest hourly report strictly before hourStartMs (for prompt chaining). */
  loadPreviousHourlyReport(gameId: string, hourStartMs: number): GameHourlyReport | null {
    const hourlyDir = path.join(this.gameRoot(gameId, new Date(hourStartMs)), 'hourly')
    if (!fs.existsSync(hourlyDir)) return null

    let best: GameHourlyReport | null = null
    for (const file of fs.readdirSync(hourlyDir)) {
      if (!file.endsWith('.json')) continue
      const report = JSON.parse(
        fs.readFileSync(path.join(hourlyDir, file), 'utf-8')
      ) as GameHourlyReport
      if (report.hourStartMs < hourStartMs && (!best || report.hourStartMs > best.hourStartMs)) {
        best = report
      }
    }
    return best
  }
}
