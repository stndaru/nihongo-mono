import { describe, expect, it } from 'vitest'
import { findVocabRowsBySurface } from './ext-search'
import type { VocabIndexRow } from './types'

const row = (
  id: number,
  kanji: string,
  kana: string,
  gloss: string,
  pos = 'n',
): VocabIndexRow => [id, kanji, kana, gloss, pos, 1]

describe('findVocabRowsBySurface', () => {
  // homograph order mirrors the real failure: 屋/おく sits before 屋/や
  const ROWS = [
    row(1, '屋', 'おく', 'house'),
    row(2, '屋', 'や', 'shop; dealer'),
    row(3, '旅行', 'りょこう', 'travel'),
  ]

  it('returns the first row per surface when no reading is wanted', () => {
    const { entries } = findVocabRowsBySurface(ROWS, new Set(['屋']))
    expect(entries.get('屋')?.kana).toBe('おく')
  })

  it('prefers the row matching the wanted reading (屋 read や)', () => {
    const { entries } = findVocabRowsBySurface(ROWS, new Set(['屋']), new Map([['屋', 'や']]))
    expect(entries.get('屋')?.kana).toBe('や')
    expect(entries.get('屋')?.gloss).toEqual(['shop; dealer'])
  })

  it('keeps the first row when nothing matches the wanted reading', () => {
    // best-effort result — the linking layer rejects it via entryReadsAs
    const { entries } = findVocabRowsBySurface(ROWS, new Set(['屋']), new Map([['屋', 'たな']]))
    expect(entries.get('屋')?.kana).toBe('おく')
  })

  it('matches katakana rows through their hira column', () => {
    const rows: VocabIndexRow[] = [[9, 'パン', 'パン', 'bread', 'n', 1, 'ぱん']]
    const { entries } = findVocabRowsBySurface(rows, new Set(['パン']), new Map([['パン', 'ぱん']]))
    expect(entries.get('パン')?.kana).toBe('パン')
  })

  it('counter preference: a ct row beats an earlier noun row (名 after 20)', () => {
    const rows = [
      row(1, '名', 'な', 'name'),
      row(2, '名', 'めい', 'counter for people', 'ct'),
    ]
    const { entries } = findVocabRowsBySurface(
      rows,
      new Set(['名']),
      new Map([['名', 'めい']]),
      { counters: new Set(['名']) },
    )
    expect(entries.get('名')?.pos).toBe('counter')
  })

  it('kana-native preference: いちょう resolves to the ginkgo, not 胃腸', () => {
    // real index order: the kanji homographs come first (common-first)
    const rows = [
      row(1, '胃腸', 'いちょう', 'stomach and intestines'),
      row(2, '医長', 'いちょう', 'medical director'),
      row(3, 'いちょう', 'いちょう', 'ginkgo (Ginkgo biloba)'),
    ]
    const { entries, alternates } = findVocabRowsBySurface(
      rows,
      new Set(['いちょう']),
      new Map([['いちょう', 'いちょう']]),
      { kanaNative: new Set(['いちょう']) },
    )
    expect(entries.get('いちょう')?.gloss[0]).toContain('ginkgo')
    // ...while the homographs remain reachable as popup alternatives
    const alts = alternates.get('いちょう')!
    expect(alts.map((a) => a.kanji)).toEqual(['胃腸', '医長', 'いちょう'])
  })

  it('alternate lists are capped', () => {
    const rows = Array.from({ length: 9 }, (_, i) => row(i, '日', `よみ${i}`, `gloss ${i}`))
    const { alternates } = findVocabRowsBySurface(rows, new Set(['日']))
    expect(alternates.get('日')!.length).toBe(5)
  })
})
