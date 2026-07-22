import type { AssistantMode } from '../shared/types'
import type { Playbook } from '../shared/types'

/** Playbooks with empty `modes` apply to every assistant mode. */
export function filterPlaybooksForMode(playbooks: Playbook[], mode: AssistantMode): Playbook[] {
  return playbooks.filter((playbook) => {
    if (!playbook.isActive) return false
    if (!playbook.modes || playbook.modes.length === 0) return true
    return playbook.modes.includes(mode)
  })
}

export function buildPlaybookContext(playbooks: Playbook[]): string {
  if (playbooks.length === 0) return ''
  return playbooks.map((p) => `[PLAYBOOK: ${p.name}]\n${p.content}`).join('\n\n')
}
