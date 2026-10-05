interface StoreLifecycle<T> {
  load(): T
  recover(error: unknown): T
  migrate(store: T): void
}

export function createLazySettingsStore<T>(lifecycle: StoreLifecycle<T>): () => T {
  let initialized = false
  let store: T
  return () => {
    if (!initialized) {
      let loaded: T
      try { loaded = lifecycle.load() }
      catch (error) { loaded = lifecycle.recover(error) }
      // Migration failures must never be mistaken for corruption and erase data.
      lifecycle.migrate(loaded)
      store = loaded
      initialized = true
    }
    return store
  }
}
