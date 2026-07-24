import fs from 'fs'
import path from 'path'
import { completeGeminiVisionMulti } from './gemini-api'
import { getSetting } from './store'
import { DEFAULT_SETTINGS } from '../shared/constants'
import type { GameBlockManifest, GameCaptureStore, GameHourlyReport } from './game-capture-store'
import { pickBestKeyframePath } from './game-image-compress'

const THREAD_MARKER = '---THREAD---'

export function parseHourlyAiResponse(raw: string): { summary: string; sessionThread: string } {
  const idx = raw.indexOf(THREAD_MARKER)
  if (idx < 0) {
    return { summary: raw.trim(), sessionThread: raw.trim().slice(-500) }
  }
  const summary = raw.slice(0, idx).trim()
  const sessionThread = raw.slice(idx + THREAD_MARKER.length).trim()
  return { summary, sessionThread }
}

function gameSpecificHint(gameId: string, gameLabel: string): string {
  if (gameId === 'hoi4' || /hearts of iron/i.test(gameLabel)) {
    return 'Game hints: HOI4 — look for map, production queue, division designer, combat log, diplomacy, focus tree, navy/air tabs.'
  }
  return ''
}

export async function runGameHourlyAi(params: {
  store: GameCaptureStore
  gameId: string
  gameLabel: string
  hourStartMs: number
  hourEndMs: number
  blocks: GameBlockManifest[]
}): Promise<GameHourlyReport | null> {
  const { store, gameId, gameLabel, hourStartMs, hourEndMs, blocks } = params
  if (blocks.length === 0) return null

  const apiKey = (getSetting<string>('geminiApiKey') || '').trim()
  if (!apiKey) {
    console.warn('[Specter] Game hourly AI skipped — no Gemini API key')
    return null
  }
  const model = getSetting<string>('geminiModel') || DEFAULT_SETTINGS.geminiModel
  const systemPrompt =
    getSetting<string>('gameModeVisionPrompt') || DEFAULT_SETTINGS.gameModeVisionPrompt

  const previous = store.loadPreviousHourlyReport(gameId, hourStartMs)
  const priorThread = previous?.sessionThread || previous?.aiSummary || ''

  const imagePaths: string[] = []
  for (const block of blocks) {
    const first =
      block.frames[0]?.imageFile ?? block.frames[0]?.webpFile ?? block.frames[0]?.pngFile ?? 'kf-01.webp'
    const blockDir = path.dirname(
      store.blockAbsolutePath(gameId, block.blockStartMs, block.blockEndMs, first)
    )
    const best = pickBestKeyframePath(block, blockDir)
    if (best) imagePaths.push(best)
  }

  const images = imagePaths.slice(0, 12).map((p) => ({
    base64: fs.readFileSync(p).toString('base64'),
    mime: p.endsWith('.webp') ? ('image/webp' as const) : ('image/png' as const)
  }))

  const userParts = [
    `Game: ${gameLabel} (${gameId})`,
    `Hour: ${new Date(hourStartMs).toISOString()} – ${new Date(hourEndMs).toISOString()}`,
    `Attached: ${images.length} screenshots, chronological (one per ~5-min block).`,
    gameSpecificHint(gameId, gameLabel)
  ]

  if (priorThread) {
    userParts.push(
      '',
      '[SESSION SO FAR — from previous hour, continue from here]',
      priorThread,
      '',
      'Describe ONLY new activity in THIS hour. Update THREAD at the end.'
    )
  } else {
    userParts.push('', 'First hour of this session — no prior context.')
  }

  let rawResponse = ''
  try {
    rawResponse = await completeGeminiVisionMulti(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userParts.join('\n') }
      ],
      model,
      apiKey,
      images,
      1400
    )
  } catch (err) {
    console.warn('[Specter] Game hourly AI failed:', err)
    rawResponse = '_AI summary failed — keyframes saved on disk._'
  }

  const { summary, sessionThread } = parseHourlyAiResponse(rawResponse)

  const report: GameHourlyReport = {
    gameId,
    hourStartMs,
    hourEndMs,
    generatedAt: Date.now(),
    aiSummary: summary,
    sessionThread,
    previousHourSummary: previous?.aiSummary,
    blockIds: blocks.map((b) => `${b.blockStartMs}-${b.blockEndMs}`)
  }

  const md = [
    `# Game Session — ${gameLabel}`,
    '',
    `- **Hour:** ${new Date(hourStartMs).toLocaleString()} – ${new Date(hourEndMs).toLocaleString()}`,
    `- **Blocks:** ${blocks.length} | **Images sent:** ${images.length}`,
    `- **Chained from previous hour:** ${previous ? 'yes' : 'no'}`,
    '',
    summary,
    '',
    previous
      ? `## Previous hour (context)\n\n${previous.aiSummary.slice(0, 800)}${previous.aiSummary.length > 800 ? '…' : ''}\n`
      : '',
    `## Session thread (for next hour)\n\n${sessionThread}`,
    '',
    `Generated: ${new Date().toISOString()}`
  ]
    .filter(Boolean)
    .join('\n')

  store.saveHourlyReport(report, md)
  console.info(
    'AGENT_LOOP_WAKE_game_hourly ' +
      JSON.stringify({
        gameId,
        hour: new Date(hourStartMs).toISOString(),
        blocks: blocks.length,
        images: images.length,
        chained: !!previous
      })
  )

  return report
}
