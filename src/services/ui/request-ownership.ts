/** Only the latest request for a target may publish or persist its result. */
export function createRequestOwnership<T extends object>() {
  const owners = new WeakMap<T, object>()
  return {
    begin(target: T): () => boolean {
      const owner = {}
      owners.set(target, owner)
      return () => owners.get(target) === owner
    },
    invalidate(target: T): void {
      owners.delete(target)
    }
  }
}
