import { describe, expect, it } from 'vitest'
import {
  createSharedAssetEnsurer,
  PADDLE_ASSET_VERSION,
  paddleAssetDownloadPlan,
  parsePaddleAssetManifest,
} from './assets'

const valid = {
  version: PADDLE_ASSET_VERSION,
  totalBytes: 30,
  files: [
    {
      source: `/ocr/paddle/${PADDLE_ASSET_VERSION}/download/worker.js.pack`,
      target: `/ocr/paddle/${PADDLE_ASSET_VERSION}/worker.js`,
      bytes: 10,
      inflatedBytes: 20,
      sha256: 'a'.repeat(64),
      contentType: 'text/javascript',
    },
    {
      source: `/ocr/paddle/${PADDLE_ASSET_VERSION}/download/model.tar.pack`,
      target: `/ocr/paddle/${PADDLE_ASSET_VERSION}/models/model.tar`,
      bytes: 20,
      inflatedBytes: 40,
      sha256: 'b'.repeat(64),
      contentType: 'application/octet-stream',
    },
  ],
}

describe('parsePaddleAssetManifest', () => {
  it('accepts versioned same-origin compressed sources with exact totals', () => {
    expect(parsePaddleAssetManifest(JSON.stringify(valid))).toEqual(valid)
  })

  it.each([
    ['wrong version', { ...valid, version: 'latest' }],
    ['wrong total', { ...valid, totalBytes: 29 }],
    [
      'external source',
      { ...valid, files: [{ ...valid.files[0], source: 'https://cdn.example/worker.js.pack' }] },
    ],
    ['unversioned target', { ...valid, files: [{ ...valid.files[0], target: '/ocr/worker.js' }] }],
    ['invalid checksum', { ...valid, files: [{ ...valid.files[0], sha256: 'nope' }] }],
  ])('rejects %s', (_name, data) => {
    expect(() => parsePaddleAssetManifest(JSON.stringify(data))).toThrow()
  })
})

describe('paddleAssetDownloadPlan', () => {
  it('downloads only missing cache targets and accounts for cached bytes', () => {
    const plan = paddleAssetDownloadPlan(valid, new Set([valid.files[0].target]))

    expect(plan.cachedBytes).toBe(10)
    expect(plan.downloadBytes).toBe(20)
    expect(plan.files).toEqual([valid.files[1]])
  })

  it('adds a required target prefix to both cache lookup and download URLs', () => {
    const plan = paddleAssetDownloadPlan(valid, new Set(['/app' + valid.files[0].target]), '/app/')

    expect(plan.cachedBytes).toBe(10)
    expect(plan.files[0]).toMatchObject({
      source: '/app' + valid.files[1].source,
      target: '/app' + valid.files[1].target,
    })
  })
})

describe('createSharedAssetEnsurer', () => {
  it('shares one in-flight transfer and broadcasts progress to every caller', async () => {
    let starts = 0
    let finish: ((value: string) => void) | undefined
    let report: ((done: number, total: number) => void) | undefined
    const ensure = createSharedAssetEnsurer<string>((onProgress) => {
      starts += 1
      report = onProgress
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    const firstProgress: number[] = []
    const secondProgress: number[] = []

    const first = ensure({ onProgress: (done) => firstProgress.push(done) })
    const second = ensure({ onProgress: (done) => secondProgress.push(done) })
    await Promise.resolve()
    report?.(12, 30)
    finish?.('ready')

    await expect(Promise.all([first, second])).resolves.toEqual(['ready', 'ready'])
    expect(starts).toBe(1)
    expect(firstProgress).toEqual([12])
    expect(secondProgress).toEqual([12])
  })
})
