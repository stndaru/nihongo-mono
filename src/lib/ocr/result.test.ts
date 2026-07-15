import { describe, expect, it } from 'vitest'
import {
  assessPaddleResult,
  normalizePaddleResult,
  type PaddleResultItem,
} from './result'

const box = (x: number, y: number, width: number, height: number): PaddleResultItem['poly'] => [
  [x, y],
  [x + width, y],
  [x + width, y + height],
  [x, y + height],
]

describe('normalizePaddleResult', () => {
  it('reads predominantly vertical Japanese columns from right to left', () => {
    const result = normalizePaddleResult([
      { text: '左の列', score: 0.9, poly: box(10, 0, 20, 120) },
      { text: '右の列', score: 0.8, poly: box(80, 0, 20, 120) },
    ])

    expect(result.writingMode).toBe('vertical')
    expect(result.raw).toBe('右の列\n左の列')
  })

  it('preserves Paddle line order for horizontal text and weights confidence by text length', () => {
    const result = normalizePaddleResult([
      { text: 'Long line', score: 0.9, poly: box(0, 0, 120, 20) },
      { text: 'x', score: 0.1, poly: box(0, 30, 10, 20) },
    ])

    expect(result.writingMode).toBe('horizontal')
    expect(result.raw).toBe('Long line\nx')
    expect(result.confidence).toBeCloseTo(0.82, 5)
  })
})

describe('assessPaddleResult', () => {
  it('automatically falls back only for errors or empty output', () => {
    expect(assessPaddleResult({ raw: '', confidence: null })).toBe('auto-fallback')
    expect(assessPaddleResult({ error: new Error('worker failed') })).toBe('auto-fallback')
  })

  it('keeps low-confidence text for review and a manual Tesseract retry', () => {
    expect(assessPaddleResult({ raw: '日本語', confidence: 0.54 })).toBe('review')
    expect(assessPaddleResult({ raw: '日本語', confidence: 0.92 })).toBe('commit')
  })
})
