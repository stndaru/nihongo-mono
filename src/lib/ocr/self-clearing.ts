/**
 * Promise cache that never caches a rejection (decision 60): the first
 * call runs the factory and every later call reuses the same promise —
 * unless it rejected, in which case the next call retries from scratch.
 */
export function selfClearingCache<T>(factory: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null
  return () => {
    if (!cached) {
      cached = factory()
      cached.catch(() => {
        cached = null
      })
    }
    return cached
  }
}
