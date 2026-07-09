import { afterEach, describe, expect, it, vi } from 'vitest'
import { findGrammar, loadGrammarLevel } from './loader'
import type { GrammarEntry } from './types'

const entry = (slug: string, over: Partial<GrammarEntry> = {}): GrammarEntry => ({
  slug,
  title: 'ないで',
  kana: 'ないで',
  romaji: 'naide',
  meaning: 'without doing',
  jlpt: 5,
  summary: 'summary',
  structure: ['Verb［ない form］＋ で'],
  pitfalls: [],
  examples: [
    { ja: 'あ', en: 'a' },
    { ja: 'い', en: 'b' },
  ],
  synonyms: [],
  antonyms: [],
  related: [],
  sources: ['jlptsensei'],
  ...over,
})

// plain (non-gzip) body exercises fetchJsonGz's magic-byte fallback branch
const gzResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(body)).buffer,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// NOTE: the level caches are module-level and persist across tests — each
// test below touches levels no earlier test has cached (5, then 4, then the
// rest via findGrammar, which deliberately re-uses the primed 5/4 caches).
describe('grammar loader', () => {
  it('caches a level after the first fetch', async () => {
    const urls: string[] = []
    const fetchMock = vi.fn(async (...args: unknown[]) => {
      urls.push(String(args[0]))
      return gzResponse([entry('cached-five')])
    })
    vi.stubGlobal('fetch', fetchMock)
    const first = await loadGrammarLevel(5)
    const second = await loadGrammarLevel(5)
    expect(first).toEqual(second)
    expect(first[0].slug).toBe('cached-five')
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('jlpt/grammar-n5.json.gz')
  })

  it('does not cache a failed fetch (decision 60)', async () => {
    const failing = vi.fn(async () => gzResponse(null, false, 500))
    vi.stubGlobal('fetch', failing)
    await expect(loadGrammarLevel(4)).rejects.toThrow()

    const working = vi.fn(async () => gzResponse([entry('four-retry', { jlpt: 4 })]))
    vi.stubGlobal('fetch', working)
    const retried = await loadGrammarLevel(4)
    expect(retried[0].slug).toBe('four-retry')
    expect(working).toHaveBeenCalledTimes(1)
  })

  it('findGrammar scans all levels and returns undefined on a miss', async () => {
    // levels 5 and 4 come from the caches primed above; 3/2/1 fetch fresh
    const fetchMock = vi.fn(async () => gzResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    expect(await findGrammar('cached-five')).toMatchObject({ slug: 'cached-five' })
    expect(await findGrammar('four-retry')).toMatchObject({ slug: 'four-retry', jlpt: 4 })
    expect(await findGrammar('no-such-slug')).toBeUndefined()
    // only the three uncached levels hit the network, once ever
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
