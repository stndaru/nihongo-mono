import { describe, expect, it } from 'vitest'
import { ocrOfflineDownloadPlan, parseOcrCompletionMarker, parseOcrOfflineManifest } from './offline'

const manifest = {
  version: 'v0.4.2',
  paddleBytes: 20,
  totalBytes: 30,
  files: [
    ['/ocr/engine/worker.js', 4],
    ['/ocr/models/jpn.gz', 6],
  ] as [string, number][],
}

describe('parseOcrOfflineManifest', () => {
  it('accepts versioned same-origin fallback files with exact totals', () => {
    expect(parseOcrOfflineManifest(JSON.stringify(manifest))).toEqual(manifest)
  })

  it.each([
    { ...manifest, version: 'latest' },
    { ...manifest, totalBytes: 31 },
    { ...manifest, files: [['https://example.com/model', 10]] },
  ])('rejects malformed manifests', (value) => {
    expect(() => parseOcrOfflineManifest(JSON.stringify(value))).toThrow()
  })
})

describe('ocrOfflineDownloadPlan', () => {
  it('counts cached fallback files and downloads only missing files', () => {
    expect(ocrOfflineDownloadPlan(manifest, new Set(['/ocr/engine/worker.js']))).toEqual({
      files: [['/ocr/models/jpn.gz', 6]],
      cachedBytes: 4,
      downloadBytes: 6,
    })
  })
})

describe('OCR completion marker', () => {
  it('requires a versioned list of every cached OCR target', () => {
    expect(
      parseOcrCompletionMarker(
        JSON.stringify({ version: 'v0.4.2', paths: ['/ocr/paddle/v0.4.2/worker.js'] }),
      ),
    ).toEqual(['/ocr/paddle/v0.4.2/worker.js'])
    expect(() => parseOcrCompletionMarker('{"version":"latest","paths":[]}')).toThrow()
  })
})
