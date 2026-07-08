import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseGtxResponse, parseMyMemoryResponse, translateSentence } from './translate'

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
})

const gtxBody = (...segments: string[]) => [segments.map((s) => [s, 'src', null, null, 10]), null, 'ja']
const myMemoryBody = (text: string, status = 200) => ({
  responseStatus: status,
  responseData: { translatedText: text },
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseGtxResponse', () => {
  it('extracts a single-sentence translation', () => {
    expect(parseGtxResponse(gtxBody('I like cats.'))).toBe('I like cats.')
  })
  it('concatenates all chunks of a multi-sentence translation', () => {
    expect(parseGtxResponse(gtxBody('I ate. ', 'Then I slept.'))).toBe('I ate. Then I slept.')
  })
  it.each([[null], [{}], [[]], [[null]], [['x']]])('throws on unexpected shape %#', (body) => {
    expect(() => parseGtxResponse(body)).toThrow()
  })
  it('skips non-string chunk heads without throwing', () => {
    expect(parseGtxResponse([[['Hello '], [42], ['world']]])).toBe('Hello world')
  })
})

describe('parseMyMemoryResponse', () => {
  it('extracts the translation on responseStatus 200', () => {
    expect(parseMyMemoryResponse(myMemoryBody('I like cats.'))).toBe('I like cats.')
  })
  it('throws when the error arrives as HTTP 200 with a non-200 responseStatus', () => {
    expect(() => parseMyMemoryResponse(myMemoryBody('QUERY LIMIT REACHED', 403))).toThrow()
  })
  it('throws when responseData is missing', () => {
    expect(() => parseMyMemoryResponse({ responseStatus: 200 })).toThrow()
  })
})

// each test uses a unique sentence — the module-level cache persists across tests
describe('translateSentence', () => {
  it('uses google first and encodes the sentence into the gtx url', async () => {
    const urls: string[] = []
    const fetchMock = vi.fn(async (...args: unknown[]) => {
      urls.push(String(args[0]))
      return jsonResponse(gtxBody('I ate sushi.'))
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await translateSentence('寿司を食べた')
    expect(result).toEqual({ text: 'I ate sushi.', provider: 'google' })
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t')
    expect(urls[0]).toContain(`q=${encodeURIComponent('寿司を食べた')}`)
  })

  it('falls back to mymemory when google rejects', async () => {
    const urls: string[] = []
    const fetchMock = vi.fn(async (...args: unknown[]) => {
      urls.push(String(args[0]))
      if (urls.length === 1) throw new Error('network down')
      return jsonResponse(myMemoryBody('I drink water.'))
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(translateSentence('水を飲む')).resolves.toEqual({
      text: 'I drink water.',
      provider: 'mymemory',
    })
    expect(urls).toHaveLength(2)
    expect(urls[1]).toContain('api.mymemory.translated.net/get?q=')
  })

  it('falls back when google responds non-ok', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(null, false, 429))
      .mockResolvedValueOnce(jsonResponse(myMemoryBody('I read books.')))
    vi.stubGlobal('fetch', fetchMock)
    await expect(translateSentence('本を読む')).resolves.toMatchObject({ provider: 'mymemory' })
  })

  it('falls back when google returns a garbage shape', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ nope: true }))
      .mockResolvedValueOnce(jsonResponse(myMemoryBody('I run.')))
    vi.stubGlobal('fetch', fetchMock)
    await expect(translateSentence('走る')).resolves.toMatchObject({ provider: 'mymemory' })
  })

  it('falls back when google returns an empty translation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(gtxBody('  ')))
      .mockResolvedValueOnce(jsonResponse(myMemoryBody('I swim.')))
    vi.stubGlobal('fetch', fetchMock)
    await expect(translateSentence('泳ぐ')).resolves.toMatchObject({ provider: 'mymemory' })
  })

  it('rejects when both providers fail, and does not cache the failure', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', failing)
    await expect(translateSentence('猫がいる')).rejects.toThrow()
    expect(failing).toHaveBeenCalledTimes(2)
    // retry after the outage: not poisoned by a cached failure
    const working = vi.fn(async () => jsonResponse(gtxBody('There is a cat.')))
    vi.stubGlobal('fetch', working)
    await expect(translateSentence('猫がいる')).resolves.toMatchObject({ provider: 'google' })
  })

  it('serves repeats from the cache without refetching', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(gtxBody('I bought a book.')))
    vi.stubGlobal('fetch', fetchMock)
    const first = await translateSentence('本を買った')
    const second = await translateSentence('本を買った')
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
