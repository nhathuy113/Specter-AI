/** Each concurrent request owns its controller until it finishes. */
export function createStreamScope() {
  const active = new Set<AbortController>()
  return {
    begin(): AbortController {
      const controller = new AbortController()
      active.add(controller)
      return controller
    },
    finish(controller: AbortController): void {
      active.delete(controller)
    },
    cancel(): void {
      for (const controller of active) controller.abort()
      active.clear()
    }
  }
}
