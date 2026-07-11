/** Retry ceiling for rate-limited Drive calls within one sync attempt. */
export const MAX_ATTEMPTS = 5

/**
 * Exponential backoff for Drive rate limits: 1s, 2s, 4s, 8s, 16s, plus up
 * to 250 ms of jitter so concurrent tabs don't retry in lockstep. Pure —
 * the random source is injected for tests.
 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const capped = Math.min(Math.max(attempt, 0), MAX_ATTEMPTS - 1)
  return 1000 * 2 ** capped + Math.floor(random() * 250)
}
