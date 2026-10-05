import fs from 'fs'
import os from 'os'
import path from 'path'
import type { AiProviderId } from './contracts'

export const CLOAK_DEEPSEEK_PROFILE = path.join(
  os.homedir(),
  '.cloakbrowser',
  'profiles',
  'cloak-nhathuy113'
)

export type CompletionRouteId = AiProviderId | 'deepseek-cloak'

export function cloakDeepseekProfileReady(): boolean {
  return fs.existsSync(path.join(CLOAK_DEEPSEEK_PROFILE, 'Default', 'Cookies'))
}

/** Coach auto uses the Cloak DeepSeek profile. Other chats keep the configured provider. */
export function selectCompletionRoute(coachMode: boolean, provider: AiProviderId, profileReady?: boolean): CompletionRouteId {
  if (coachMode && (profileReady ?? cloakDeepseekProfileReady())) return 'deepseek-cloak'
  return provider
}
