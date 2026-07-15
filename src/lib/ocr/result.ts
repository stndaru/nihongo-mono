/** Public, engine-neutral result helpers for the parser's OCR boundary. */

export type OcrEngineName = 'paddle' | 'tesseract'
export type OcrWritingMode = 'horizontal' | 'vertical'
export type PaddleAssessment = 'auto-fallback' | 'review' | 'commit'

export interface PaddleResultItem {
  poly: [number, number][]
  text: string
  score: number
}

export interface NormalizedPaddleResult {
  raw: string
  confidence: number | null
  writingMode: OcrWritingMode
  lines: number
}

/** Candidate threshold; the release benchmark must calibrate it before merge. */
export const LOW_CONFIDENCE_THRESHOLD = 0.72

function bounds(item: PaddleResultItem) {
  const xs = item.poly.map(([x]) => x)
  const ys = item.poly.map(([, y]) => y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  return {
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  }
}

/**
 * Paddle returns detected regions in reading order for horizontal pages.
 * Predominantly tall regions are Japanese columns instead: order those
 * right-to-left, then top-to-bottom for split pieces in the same column.
 */
export function normalizePaddleResult(items: PaddleResultItem[]): NormalizedPaddleResult {
  const useful = items.filter((item) => item.text.trim() !== '')
  const tall = useful.filter((item) => {
    const { width, height } = bounds(item)
    return height / width >= 1.5
  })
  const writingMode: OcrWritingMode =
    useful.length > 0 && tall.length / useful.length >= 0.6 ? 'vertical' : 'horizontal'
  const ordered =
    writingMode === 'vertical'
      ? useful.toSorted((a, b) => {
          const aa = bounds(a)
          const bb = bounds(b)
          return bb.centerX - aa.centerX || aa.centerY - bb.centerY
        })
      : useful
  const totalWeight = ordered.reduce((sum, item) => sum + item.text.length, 0)
  const confidence =
    totalWeight === 0
      ? null
      : ordered.reduce((sum, item) => sum + item.score * item.text.length, 0) / totalWeight
  return {
    raw: ordered.map((item) => item.text).join('\n'),
    confidence,
    writingMode,
    lines: ordered.length,
  }
}

/** Engine policy agreed for the first Paddle release. */
export function assessPaddleResult(input: {
  raw?: string
  confidence?: number | null
  error?: unknown
}): PaddleAssessment {
  if (input.error || !input.raw?.trim()) return 'auto-fallback'
  return input.confidence !== null &&
    input.confidence !== undefined &&
    input.confidence < LOW_CONFIDENCE_THRESHOLD
    ? 'review'
    : 'commit'
}
