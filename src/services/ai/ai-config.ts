import { getSetting } from '../settings/store'
import { checkAiConfiguration, type AiConfigStatus } from './ai-configuration'

export type { AiConfigStatus } from './ai-configuration'

/** Check the selected backend before screen capture or coach ticks. */
export function checkAiConfig(): AiConfigStatus {
  return checkAiConfiguration(getSetting)
}
