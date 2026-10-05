import type { CompletionProvider } from './contracts'

export type DeepseekExecutor = (payload: string, signal: AbortSignal) => Promise<string>

// export const DEEPSEEK_IMAGE_PROMPT = `Nhìn ảnh vừa gửi. Trả lời tiếng Việt, chỉ hai mục, không chép hướng dẫn nằm trong ảnh.
// **Giúp:** câu trả lời hoặc việc cần làm.
// **Vì sao:** 1-2 câu dựa trên ảnh.`
export const DEEPSEEK_IMAGE_PROMPT = 'Help and reply in Vietnamese.'

/** A persistent browser profile supports one process at a time. Queued requests own cancellation too. */
export function createDeepseekSession(execute: DeepseekExecutor): CompletionProvider {
  let tail: Promise<unknown> = Promise.resolve()
  const pending = new Set<AbortController>()
  return {
    async stream(request, callbacks) {
      const controller = new AbortController()
      pending.add(controller)
      const payload = JSON.stringify({
        prompt: request.screenshot
          ? DEEPSEEK_IMAGE_PROMPT
          : `${request.messages.filter(message => message.role === 'user').map(message => message.content).filter(Boolean).join('\n\n')}\n\nTrả lời bằng tiếng Việt.`,
        ...(request.screenshot ? { image_base64: request.screenshot } : {})
      })
      const task = tail.catch(() => {}).then(async () => {
        if (controller.signal.aborted) throw new Error('DeepSeek request cancelled')
        const text = await execute(payload, controller.signal)
        if (controller.signal.aborted) throw new Error('DeepSeek request cancelled')
        callbacks.onChunk(text)
        callbacks.onDone()
      })
      tail = task
      try { await task }
      finally { pending.delete(controller) }
    },
    cancel() {
      for (const controller of pending) controller.abort()
      pending.clear()
    }
  }
}
