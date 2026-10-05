/** @deprecated Import from context-router.ts instead */
export {
  extractScreenContext as extractCoachContext,
  type ScreenContext as CoachScreenContext,
  type ScreenKind as CoachScreenKind
} from './context-router'

export type { GameLogEntry as Hoi4CombatEntry } from './skills/game-log'
export { parseGameLogEntries as parseHoi4CombatEntries, formatGameLogEntries as formatHoi4CombatEntries } from './skills/game-log'
