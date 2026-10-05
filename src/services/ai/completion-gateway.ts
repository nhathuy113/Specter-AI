import type { AiProviderId, CompletionProvider, CompletionRequest, StreamCallbacks } from './contracts'

export function createCompletionGateway(providers: Record<AiProviderId, CompletionProvider>) {
  return {
    async stream(provider: AiProviderId, request: CompletionRequest, callbacks: StreamCallbacks): Promise<void> {
      // A provider must have exactly one terminal outcome, even if it throws after
      // an error callback or emits more data after completion.
      let finished = false
      const guarded: StreamCallbacks = {
        onChunk: (content) => { if (!finished) callbacks.onChunk(content) },
        onDone: () => {
          if (finished) return
          finished = true
          callbacks.onDone()
        },
        onError: (error) => {
          if (finished) return
          finished = true
          callbacks.onError(error)
        }
      }
      try {
        await providers[provider].stream(request, guarded)
        guarded.onDone()
      } catch (error) {
        guarded.onError(error instanceof Error ? error.message : 'AI completion failed')
      }
    },
    cancel(): void {
      for (const provider of Object.values(providers) as CompletionProvider[]) provider.cancel()
    }
  }
}
