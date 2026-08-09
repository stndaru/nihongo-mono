import { describe, expect, it } from 'vitest'
import {
  excludeVerticalFurigana,
  horizontalTextForParsing,
  verticalTextForParsing,
} from './layout'
import type { OcrTextItem } from './types'

const line = (text: string, left: number, top: number, right: number, bottom: number): OcrTextItem => ({
  text,
  rect: { left, top, right, bottom },
  flags: 0,
  confidence: 0.9,
})

describe('vertical OCR layout', () => {
  it('orders columns right-to-left regardless of engine return order', () => {
    // The worker rotates the crop CCW: the original right column is the top row.
    const lines = [line('始まった', 10, 70, 110, 90), line('衝動に身を任せた', 10, 20, 190, 40)]
    expect(verticalTextForParsing(lines, '')).toBe('衝動に身を任せた始まった')
  })

  it('keeps top-to-bottom fragments within the same column', () => {
    const lines = [line('後半', 90, 20, 150, 40), line('前半', 10, 20, 70, 40)]
    expect(verticalTextForParsing(lines, '')).toBe('前半後半')
  })

  it('removes only small adjacent overlapping furigana', () => {
    const base = line('衝動', 20, 30, 80, 54)
    const furigana = line('しょうどう', 22, 20, 78, 28)
    expect(excludeVerticalFurigana([furigana, base])).toEqual([base])
  })

  it('keeps a standalone small line', () => {
    const small = line('それは', 10, 10, 18, 50)
    expect(excludeVerticalFurigana([small])).toEqual([small])
  })

  it('falls back when no Japanese line boxes survive', () => {
    expect(verticalTextForParsing([line('123', 0, 0, 10, 20)], 'それは')).toBe('それは')
  })
})

describe('horizontal OCR layout', () => {
  it('drops a zero-confidence badge glyph between sentence punctuation and a Latin label', () => {
    const sentence = line('日本語です。', 10, 10, 100, 30)
    const badgeGlyph = { ...line('価', 110, 10, 125, 30), confidence: 0 }
    const badgeLabel = { ...line('Wikipedia', 130, 12, 190, 28), confidence: 0.36 }

    expect(horizontalTextForParsing([sentence, badgeGlyph, badgeLabel], '')).toBe(
      '日本語です。Wikipedia',
    )
  })

  it('keeps an uncertain Japanese word without adjacent badge evidence', () => {
    const uncertain = { ...line('日本語', 10, 10, 70, 30), confidence: 0 }

    expect(horizontalTextForParsing([uncertain], '')).toBe('日本語')
  })

  it('falls back when no word boxes are available', () => {
    expect(horizontalTextForParsing([], '日本語です。')).toBe('日本語です。')
  })
})
