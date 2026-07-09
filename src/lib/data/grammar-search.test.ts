import { describe, expect, it } from 'vitest'
import { searchGrammar } from './grammar-search'
import type { GrammarEntry } from './types'

const entry = (
  slug: string,
  title: string,
  kana: string,
  romaji: string,
  meaning: string,
): GrammarEntry => ({
  slug,
  title,
  kana,
  romaji,
  meaning,
  jlpt: 5,
  summary: 's',
  structure: ['x'],
  pitfalls: [],
  examples: [
    { ja: 'あ', en: 'a' },
    { ja: 'い', en: 'b' },
  ],
  synonyms: [],
  antonyms: [],
  related: [],
  sources: ['jlptsensei'],
})

const ENTRIES = [
  entry('naide', 'ないで', 'ないで', 'naide', 'without doing ~'),
  entry('hou-ga-ii', 'ほうがいい', 'ほうがいい', 'hou ga ii', 'had better; should ~'),
  entry('ta-koto-ga-aru', '〜たことがある', 'たことがある', 'ta koto ga aru', 'have done before'),
]

describe('searchGrammar', () => {
  it('returns the list unchanged for an empty query', () => {
    expect(searchGrammar(ENTRIES, '')).toEqual(ENTRIES)
    expect(searchGrammar(ENTRIES, '  ')).toEqual(ENTRIES)
  })

  it('matches kana exactly and via romaji conversion', () => {
    expect(searchGrammar(ENTRIES, 'ないで')[0].slug).toBe('naide')
    expect(searchGrammar(ENTRIES, 'naide')[0].slug).toBe('naide')
  })

  it('ignores spacing in romaji queries', () => {
    expect(searchGrammar(ENTRIES, 'hou ga ii')[0].slug).toBe('hou-ga-ii')
    expect(searchGrammar(ENTRIES, 'hougaii')[0].slug).toBe('hou-ga-ii')
  })

  it('ignores the connective tilde in titles', () => {
    expect(searchGrammar(ENTRIES, 'たことがある')[0].slug).toBe('ta-koto-ga-aru')
    expect(searchGrammar(ENTRIES, 'takotogaaru')[0].slug).toBe('ta-koto-ga-aru')
  })

  it('falls back to meaning substrings and excludes non-matches', () => {
    const hits = searchGrammar(ENTRIES, 'without doing')
    expect(hits.map((h) => h.slug)).toEqual(['naide'])
    expect(searchGrammar(ENTRIES, 'zzz')).toEqual([])
  })

  it('ranks prefix matches above substring matches', () => {
    const list = [
      entry('koto', 'こと', 'こと', 'koto', 'nominalizer'),
      entry('ta-koto-ga-aru', '〜たことがある', 'たことがある', 'ta koto ga aru', 'have done'),
    ]
    expect(searchGrammar(list, 'こと')[0].slug).toBe('koto')
  })
})
