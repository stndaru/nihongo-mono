import { describe, expect, it, vi } from 'vitest'
import { selfClearingCache } from './self-clearing'

describe('selfClearingCache', () => {
  it('runs the factory once and reuses the promise', async () => {
    const factory = vi.fn(() => Promise.resolve(42))
    const get = selfClearingCache(factory)
    await expect(get()).resolves.toBe(42)
    await expect(get()).resolves.toBe(42)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('never caches a rejection — the next call retries', async () => {
    let calls = 0
    const get = selfClearingCache(() => {
      calls += 1
      return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve('ok')
    })
    await expect(get()).rejects.toThrow('offline')
    await expect(get()).resolves.toBe('ok')
    expect(calls).toBe(2)
  })

  it('shares the in-flight promise between concurrent callers', async () => {
    const factory = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('done'), 0)),
    )
    const get = selfClearingCache(factory)
    const [a, b] = await Promise.all([get(), get()])
    expect(a).toBe('done')
    expect(b).toBe('done')
    expect(factory).toHaveBeenCalledTimes(1)
  })
})
