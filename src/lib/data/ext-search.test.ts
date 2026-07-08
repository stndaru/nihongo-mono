import { describe, expect, it } from 'vitest'
import { findVocabRowsBySurface } from './ext-search'
import type { VocabIndexRow } from './types'

const row = (id: number, kanji: string, kana: string, gloss: string): VocabIndexRow => [
  id,
  kanji,
  kana,
  gloss,
  'n',
  1,
]

describe('findVocabRowsBySurface', () => {
  // homograph order mirrors the real failure: 屋/おく sits before 屋/や
  const ROWS = [
    row(1, '屋', 'おく', 'house'),
    row(2, '屋', 'や', 'shop; dealer'),
    row(3, '旅行', 'りょこう', 'travel'),
  ]

  it('returns the first row per surface when no reading is wanted', () => {
    const hits = findVocabRowsBySurface(ROWS, new Set(['屋']))
    expect(hits.get('屋')?.kana).toBe('おく')
  })

  it('prefers the row matching the wanted reading (屋 read や)', () => {
    const hits = findVocabRowsBySurface(ROWS, new Set(['屋']), new Map([['屋', 'や']]))
    expect(hits.get('屋')?.kana).toBe('や')
    expect(hits.get('屋')?.gloss).toEqual(['shop; dealer'])
  })

  it('keeps the first row when nothing matches the wanted reading', () => {
    // best-effort result — the linking layer rejects it via entryReadsAs
    const hits = findVocabRowsBySurface(ROWS, new Set(['屋']), new Map([['屋', 'たな']]))
    expect(hits.get('屋')?.kana).toBe('おく')
  })

  it('matches katakana rows through their hira column', () => {
    const rows: VocabIndexRow[] = [[9, 'パン', 'パン', 'bread', 'n', 1, 'ぱん']]
    const hits = findVocabRowsBySurface(rows, new Set(['パン']), new Map([['パン', 'ぱん']]))
    expect(hits.get('パン')?.kana).toBe('パン')
  })
})
