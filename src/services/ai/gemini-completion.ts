import type { CompletionStream } from './contracts'
import { streamGeminiCompletion, streamGeminiVisionCompletion } from './gemini-api'

export const streamGemini: CompletionStream = (request, callbacks) => request.screenshot
  ? streamGeminiVisionCompletion(request.messages, request.model, request.apiKey, request.screenshot, callbacks, request.maxTokens)
  : streamGeminiCompletion(request.messages, request.model, request.apiKey, callbacks, request.maxTokens)
