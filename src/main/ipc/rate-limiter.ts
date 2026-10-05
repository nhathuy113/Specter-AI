interface RateLimitEntry {
  timestamps: number[]
  maxCalls: number
  windowMs: number
}

export interface RateLimitRule { maxCalls: number; windowMs: number }

export function createRateLimiter(rules: Readonly<Record<string, RateLimitRule>>, now: () => number = Date.now) {
  const rateLimiters = new Map<string, RateLimitEntry>(
    Object.entries(rules).map(([channel, rule]) => [channel, { ...rule, timestamps: [] }])
  )
  function checkRateLimit(channel: string): boolean {
    const limiter = rateLimiters.get(channel)
    if (!limiter) return true

    const currentTime = now()
    // Prune old entries
    limiter.timestamps = limiter.timestamps.filter(t => currentTime - t < limiter.windowMs)

    if (limiter.timestamps.length >= limiter.maxCalls) {
      console.warn(`[Specter] Rate limit exceeded for ${channel}`)
      return false
    }

    limiter.timestamps.push(currentTime)
    return true
  }


  return checkRateLimit
}
