import type { UserSettings } from '../../shared/types'

export type AiProviderId = UserSettings['aiProvider']

export interface TextMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamCallbacks {
  onChunk(content: string): void
  onDone(): void
  onError(error: string): void
}

export interface CompletionRequest {
  messages: TextMessage[]
  model: string
  apiKey: string
  screenshot?: string
  maxTokens?: number
}

/** Providers implement only completion and cancellation; IPC stays outside. */
export interface CompletionProvider {
  stream(request: CompletionRequest, callbacks: StreamCallbacks): Promise<void>
  cancel(): void
}

export type CompletionStream = CompletionProvider['stream']
