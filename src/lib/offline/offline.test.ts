import { beforeEach, describe, expect, it } from 'vitest'
import { downloadOrder, formatMB, hasOcrOfflineCache, loadOfflineMeta, parseManifest } from './offline'

// node has no localStorage — back the meta module with a Map
const backing = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
}

beforeEach(() => backing.clear())

describe('parseManifest', () => {
  it('accepts the generated shape', () => {
    const m = parseManifest(
      JSON.stringify({
        version: 'abc123',
        totalBytes: 42,
        files: [
          ['/index.html', 10],
          ['/assets/app.js', 32],
        ],
      }),
    )
    expect(m.version).toBe('abc123')
    expect(m.files).toHaveLength(2)
  })

  it.each([
    ['not json at all', 'nope'],
    ['null', 'null'],
    ['missing version', '{"totalBytes":1,"files":[]}'],
    ['files not tuples', '{"version":"v","totalBytes":1,"files":["x"]}'],
    ['path without leading slash', '{"version":"v","totalBytes":1,"files":[["x",1]]}'],
    ['size not a number', '{"version":"v","totalBytes":1,"files":[["/x","1"]]}'],
  ])('rejects %s', (_name, text) => {
    expect(() => parseManifest(text)).toThrow()
  })
})

describe('downloadOrder', () => {
  it('moves index.html to the very end (torn downloads keep a working shell)', () => {
    const order = downloadOrder([
      ['/index.html', 1],
      ['/assets/a.js', 2],
      ['/data/x.json.gz', 3],
    ])
    expect(order[order.length - 1][0]).toBe('/index.html')
    expect(order).toHaveLength(3)
  })

  it('is a no-op when index.html is absent', () => {
    const files: [string, number][] = [['/a', 1], ['/b', 2]]
    expect(downloadOrder(files)).toEqual(files)
  })
})

describe('offline meta', () => {
  it('is null when unset or malformed', () => {
    expect(loadOfflineMeta()).toBeNull()
    backing.set('nihongo-mono:offline:v1', 'not json')
    expect(loadOfflineMeta()).toBeNull()
    backing.set('nihongo-mono:offline:v1', '{"version":1}')
    expect(loadOfflineMeta()).toBeNull()
  })

  it('round-trips a valid record', () => {
    backing.set(
      'nihongo-mono:offline:v1',
      JSON.stringify({
        version: 'v1',
        bytes: 100,
        files: 3,
        completedAt: '2026-07-12T00:00:00.000Z',
        persisted: true,
      }),
    )
    expect(loadOfflineMeta()).toEqual({
      version: 'v1',
      bytes: 100,
      files: 3,
      completedAt: '2026-07-12T00:00:00.000Z',
      persisted: true,
    })
  })
})

describe('formatMB', () => {
  it('one decimal under 100 MB, none above', () => {
    expect(formatMB(1048576)).toBe('1.0 MB')
    expect(formatMB(75 * 1048576)).toBe('75.0 MB')
    expect(formatMB(150 * 1048576)).toBe('150 MB')
  })
})

describe('OCR service-worker ownership', () => {
  it('keeps the worker when a versioned OCR cache exists', () => {
    expect(hasOcrOfflineCache(['nihongo-mono-ocr-paddle-v0.4.2'])).toBe(true)
    expect(hasOcrOfflineCache(['nihongo-mono-offline-v1'])).toBe(false)
  })
})
