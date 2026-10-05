import { createCompletionGateway } from './completion-gateway'
import { cancelCodexStream, streamCodexCompletion } from './codex'
import { cancelDeepseekCloak, streamDeepseekCloak } from './deepseek-cloak'
import { cancelGeminiStream } from './gemini-api'
import { streamGemini } from './gemini-completion'
import { cancelOpenAIStream, streamOpenAICompletion } from './openai-api'
import { cancelStream, streamCompletion } from './openrouter'

/** Composition root: concrete clients are wired here, not in request policy. */
export const completionGateway = createCompletionGateway({
  codex: {
    stream: (r, c) => streamCodexCompletion(r.messages, r.model, c),
    cancel: cancelCodexStream
  },
  openai: {
    stream: (r, c) => streamOpenAICompletion(r.messages, r.model, r.apiKey, c, r.maxTokens),
    cancel: cancelOpenAIStream
  },
  gemini: {
    stream: streamGemini,
    cancel: cancelGeminiStream
  },
  openrouter: {
    stream: (r, c) => streamCompletion(r.messages, r.model, r.apiKey, c, r.maxTokens),
    cancel: cancelStream
  },
  'deepseek-cloak': {
    stream: streamDeepseekCloak,
    cancel: cancelDeepseekCloak
  }
})
