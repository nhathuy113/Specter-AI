// Google Gemini API client — OpenAI-compatible chat completions with streaming.
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { GEMINI_BASE_URL } from '../shared/constants'

let currentAbortController: AbortController | null = null

export type GeminiMessage = ChatCompletionMessageParam

export interface GeminiStreamCallbacks {
  onChunk: (content: string) => void
  onDone: () => void
  onError: (error: string) => void
}

export async function streamGeminiCompletion(
  messages: GeminiMessage[],
  model: string,
  apiKey: string,
  callbacks: GeminiStreamCallbacks,
  maxTokens = 1500
): Promise<void> {
  await streamGeminiCompletionInternal(messages, model, apiKey, callbacks, maxTokens)
}

/** Attach a PNG/JPEG screenshot to the last user message for multimodal Gemini. */
export async function streamGeminiVisionCompletion(
  messages: GeminiMessage[],
  model: string,
  apiKey: string,
  imageBase64: string,
  callbacks: GeminiStreamCallbacks,
  maxTokens = 1500,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<void> {
  const visionMessages = withVisionAttachment(messages, imageBase64, mimeType)
  await streamGeminiCompletionInternal(visionMessages, model, apiKey, callbacks, maxTokens)
}

function withVisionAttachment(
  messages: GeminiMessage[],
  imageBase64: string,
  mimeType: 'image/png' | 'image/jpeg'
): GeminiMessage[] {
  const copy = [...messages]
  const lastUserIndex = [...copy].reverse().findIndex((m) => m.role === 'user')
  if (lastUserIndex < 0) return copy

  const index = copy.length - 1 - lastUserIndex
  const lastUser = copy[index]
  const textPart = typeof lastUser.content === 'string'
    ? lastUser.content
    : 'Analyze the attached screenshot.'

  copy[index] = {
    role: 'user',
    content: [
      { type: 'text', text: textPart },
      {
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${imageBase64}` }
      }
    ]
  }

  return copy
}

async function streamGeminiCompletionInternal(
  messages: GeminiMessage[],
  model: string,
  apiKey: string,
  callbacks: GeminiStreamCallbacks,
  maxTokens = 1500
): Promise<void> {
  const client = new OpenAI({
    apiKey,
    baseURL: GEMINI_BASE_URL
  })
  currentAbortController = new AbortController()

  try {
    const stream = await client.chat.completions.create(
      {
        model,
        messages,
        max_tokens: maxTokens,
        stream: true
      },
      { signal: currentAbortController.signal }
    )

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content
      if (content) {
        callbacks.onChunk(content)
      }
    }
    callbacks.onDone()
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      callbacks.onDone()
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown Gemini API error'
    callbacks.onError(message)
  } finally {
    currentAbortController = null
  }
}

export function cancelGeminiStream(): void {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
}

export interface GeminiKeyValidation {
  valid: boolean
  error?: string
}

export async function validateGeminiApiKey(apiKey: string): Promise<GeminiKeyValidation> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    )
    const data = await response.json() as {
      models?: unknown[]
      error?: { message?: string }
    }

    if (!response.ok) {
      return {
        valid: false,
        error: data.error?.message || `Gemini API returned ${response.status}`
      }
    }

    if (!Array.isArray(data.models) || data.models.length === 0) {
      return { valid: false, error: 'Gemini API returned no models for this key.' }
    }

    return { valid: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not reach Gemini API'
    return { valid: false, error: message }
  }
}
