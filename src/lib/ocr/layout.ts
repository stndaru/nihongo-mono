import type { OcrTextItem } from './types'

const japaneseCharacters = (text: string) =>
  Array.from(text).filter((char) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char))
    .length

const height = (item: OcrTextItem) => Math.max(1, item.rect.bottom - item.rect.top)
const width = (item: OcrTextItem) => Math.max(1, item.rect.right - item.rect.left)

/** Approximate glyph size after the upright crop is rotated for jpn_vert. */
const glyphSize = (item: OcrTextItem) => {
  const characters = Math.max(1, japaneseCharacters(item.text))
  return Math.min(height(item), width(item) / characters)
}

const horizontalOverlap = (a: OcrTextItem, b: OcrTextItem) => {
  const overlap = Math.max(0, Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left))
  return overlap / Math.min(width(a), width(b))
}

const verticalGap = (a: OcrTextItem, b: OcrTextItem) =>
  Math.max(0, Math.max(a.rect.top, b.rect.top) - Math.min(a.rect.bottom, b.rect.bottom))

/**
 * The worker rotates upright vertical text counter-clockwise before recognition,
 * making columns horizontal rows and furigana a smaller adjacent row. Only
 * remove a run when a larger neighbour proves that relationship; a standalone
 * small balloon remains legitimate text.
 */
export function excludeVerticalFurigana(lines: OcrTextItem[]): OcrTextItem[] {
  return lines.filter((candidate) => {
    const size = glyphSize(candidate)
    return !lines.some((base) => {
      if (base === candidate || glyphSize(base) < size / 0.62) return false
      return horizontalOverlap(candidate, base) >= 0.5 && verticalGap(candidate, base) <= height(base) * 1.5
    })
  })
}

/** Natural manga order after CCW rotation: top row to bottom, left to right. */
export function verticalTextForParsing(lines: OcrTextItem[], fallback: string): string {
  const ordered = excludeVerticalFurigana(lines)
    .filter((line) => japaneseCharacters(line.text) > 0)
    .toSorted((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)
    .map((line) => line.text.trim())
    .filter(Boolean)
  return ordered.length > 0 ? ordered.join('') : fallback
}
