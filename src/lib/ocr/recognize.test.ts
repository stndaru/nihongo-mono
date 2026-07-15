import { describe, expect, it, vi } from 'vitest'
import { ocrDevOverride, recognizeWithFallback, type OcrRunners } from './recognize'

const paddleResult = {
  raw: '日本語',
  confidence: 0.93,
  writingMode: 'horizontal' as const,
  lines: 1,
  provider: 'webgpu',
  elapsedMs: 120,
}

function runners(overrides: Partial<OcrRunners> = {}): OcrRunners {
  return {
    paddle: vi.fn().mockResolvedValue(paddleResult),
    tesseract: vi.fn().mockResolvedValue('代替結果'),
    ...overrides,
  }
}

describe('recognizeWithFallback', () => {
  it('uses Paddle output directly when confidence is acceptable', async () => {
    const deps = runners()

    await expect(recognizeWithFallback(new Blob(), 'jpn', deps)).resolves.toMatchObject({
      engine: 'paddle',
      raw: '日本語',
      confidence: 0.93,
      needsReview: false,
    })
    expect(deps.tesseract).not.toHaveBeenCalled()
  })

  it.each(['error', 'empty'] as const)('automatically falls back on Paddle %s', async (kind) => {
    const deps = runners({
      paddle:
        kind === 'error'
          ? vi.fn().mockRejectedValue(new Error('GPU failed'))
          : vi.fn().mockResolvedValue({ ...paddleResult, raw: '', confidence: null }),
    })

    await expect(recognizeWithFallback(new Blob(), 'jpn', deps)).resolves.toMatchObject({
      engine: 'tesseract',
      raw: '代替結果',
      fallbackReason: kind,
      needsReview: false,
    })
    expect(deps.tesseract).toHaveBeenCalledOnce()
  })

  it('keeps low-confidence Paddle text for review without silently replacing it', async () => {
    const deps = runners({
      paddle: vi.fn().mockResolvedValue({ ...paddleResult, confidence: 0.51 }),
    })

    await expect(recognizeWithFallback(new Blob(), 'jpn', deps)).resolves.toMatchObject({
      engine: 'paddle',
      raw: '日本語',
      confidence: 0.51,
      needsReview: true,
    })
    expect(deps.tesseract).not.toHaveBeenCalled()
  })
})

describe('ocrDevOverride', () => {
  it('accepts only explicit Paddle or Tesseract A/B values', () => {
    expect(ocrDevOverride('?ocrEngine=tesseract')).toBe('tesseract')
    expect(ocrDevOverride('?ocrEngine=paddle')).toBe('paddle')
    expect(ocrDevOverride('?ocrEngine=other')).toBeNull()
  })
})
