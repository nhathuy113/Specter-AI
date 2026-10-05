import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { CoachPanelSink } from '../work/coach-panel-port'

/** The transport needs only these two capabilities, not all of WebContents. */
export interface MessageTarget {
  isDestroyed(): boolean
  send(channel: string, payload: unknown): void
}

export function createCoachPanelSink(target: MessageTarget): CoachPanelSink {
  const send = (channel: string, payload: unknown) => {
    if (!target.isDestroyed()) target.send(channel, payload)
  }
  return {
    isDisposed: () => target.isDestroyed(),
    start: (labels) => send(IPC_CHANNELS.AI_COACH_TRIPLE_START, { labels }),
    update: (index, content, done) => send(IPC_CHANNELS.AI_COACH_TRIPLE_PANEL, { index, content, done }),
    done: (model) => send(IPC_CHANNELS.AI_COACH_TRIPLE_DONE, { model })
  }
}
