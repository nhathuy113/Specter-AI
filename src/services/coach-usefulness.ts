import type { ScreenKind } from './context-router'

const JUNK_PATTERNS = [
  /\bapi key\b/i,
  /\bgemini api\b/i,
  /\.env\b/i,
  /\bopenrouter\b/i,
  /\bnpm (install|run)\b/i,
  /\bpnpm\b/i,
  /\btypescript error\b/i,
  /\bwebpack\b/i,
  /\bconfigure (your|the) (api|key)\b/i
]

const GAME_USEFUL = /\b(manpower|armored|division|front|reinforce|pause|supply|air|micro|retreat|attack|battle|casualt|encirc|plan|template|brussels|namur|infantry|tank|in-game|game)\b/i
const IDE_REDIRECT = /\b(game|gameplay|external monitor|focus your|switch to)\b/i
const GENERAL_USEFUL = /\b(check|consider|try|open|review|fix|next|step|debug|implement|read|update)\b/i

export interface UsefulnessScore {
  useful: boolean
  reasons: string[]
}

export function scoreCoachReply(reply: string, kind: ScreenKind): UsefulnessScore {
  const text = reply.trim()
  const lower = text.toLowerCase()
  const reasons: string[] = []

  if (text.length < 25) reasons.push('reply too short')

  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(lower)) reasons.push(`contains off-topic dev/setup text (${pattern})`)
  }

  if (kind === 'game-log') {
    if (!GAME_USEFUL.test(lower)) reasons.push('missing tactical game guidance')
    if (!/\b(check|consider|reinforce|pause|pull|micro|watch|open|compare|shift|add|remove|hold|attack|retreat|rotate|push|withdraw|defend|advance|consolidate|replace|replenish|continue|stop|avoid|prioritize)\b/i.test(lower)) {
      reasons.push('missing actionable verb')
    }
  }

  if (kind === 'ide') {
    if (!IDE_REDIRECT.test(text) && !GENERAL_USEFUL.test(lower)) {
      reasons.push('missing actionable guidance for IDE/general screen')
    }
  }

  if (kind === 'general' || kind === 'code' || kind === 'browser') {
    if (!GENERAL_USEFUL.test(lower)) reasons.push('missing actionable guidance')
  }

  return { useful: reasons.length === 0, reasons }
}
