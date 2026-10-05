/** Run a capture after the current one releases the lock. */
export async function runWhenCaptureFree<T>(
  isBusy: () => boolean,
  run: () => Promise<T>,
  wait: (ms: number) => Promise<void>,
  attempts = 20,
  delayMs = 200
): Promise<T> {
  let last: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (!isBusy()) {
      try {
        return await run()
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        if (!message.includes('already in progress')) throw err
        last = err
      }
    }
    await wait(delayMs)
  }
  throw last instanceof Error ? last : new Error('Screen capture already in progress')
}
