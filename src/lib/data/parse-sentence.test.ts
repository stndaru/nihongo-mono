import { describe, expect, it } from 'vitest'
import type { VerbEntry, VocabEntry } from './types'
import {
  buildParserDicts,
  isJapaneseOnly,
  parseSentence,
  stripNonJapanese,
  tokensToSegments,
  uniqueWords,
  type JaToken,
} from './parse-sentence'

const verb = (id: string, kanji: string, kana: string, cls: VerbEntry['class']): VerbEntry => ({
  id,
  kanji,
  kana,
  romaji: '',
  furigana: [{ t: kanji, r: kana }],
  gloss: [`gloss ${id}`],
  jlpt: 5,
  common: true,
  examples: [],
  senses: [],
  kanjiChars: [],
  class: cls,
  transitivity: null,
})

const word = (
  id: string,
  kanji: string,
  kana: string,
  pos: VocabEntry['pos'] = 'noun',
): VocabEntry => ({
  id,
  kanji,
  kana,
  romaji: '',
  furigana: [{ t: kanji, r: kana }],
  gloss: [`gloss ${id}`],
  jlpt: 5,
  common: true,
  examples: [],
  senses: [],
  kanjiChars: [],
  pos,
})

const DICTS = buildParserDicts(
  [verb('v1', '食べる', 'たべる', 'v1'), verb('v2', '行く', 'いく', 'v5k-s')],
  [
    word('w1', '旅行', 'りょこう'),
    word('w2', '料理', 'りょうり'),
    word('w3', 'やはり', 'やはり', 'adverb'),
    word('w4', '楽しい', 'たのしい', 'adj-i'),
    word('w5', 'の', 'の', 'particle'),
    word('w6', '木', 'き'), // single-kanji noun — must match; its kana き must not
  ],
)

describe('stripNonJapanese / isJapaneseOnly', () => {
  it('removes latin, digits, and full-width latin', () => {
    expect(stripNonJapanese('abc食べるxyz123ＡＢＣ')).toBe('食べる')
  })
  it('keeps kana, kanji, and Japanese punctuation', () => {
    const s = '旅行の楽しみは、何といっても！'
    expect(stripNonJapanese(s)).toBe(s)
  })
  it('isJapaneseOnly rejects mixed and empty input', () => {
    expect(isJapaneseOnly('食べるtabe')).toBe(false)
    expect(isJapaneseOnly('')).toBe(false)
    expect(isJapaneseOnly('食べた。')).toBe(true)
  })
})

describe('parseSentence', () => {
  it('matches plain nouns and adverbs', () => {
    const segs = parseSentence('旅行やはり', DICTS)
    expect(segs.map((s) => s.word?.entry.id)).toEqual(['w1', 'w3'])
  })

  it('recognizes conjugated verbs and names the form', () => {
    const [seg] = parseSentence('食べた', DICTS)
    expect(seg.word?.entry.id).toBe('v1')
    expect(seg.word?.formLabel).toBe('Past')
    expect(seg.word?.surface).toBe('食べた')
  })

  it('recognizes conjugated い-adjectives', () => {
    const [seg] = parseSentence('楽しかった', DICTS)
    expect(seg.word?.entry.id).toBe('w4')
    expect(seg.word?.formLabel).toBe('Past')
  })

  it('splits compound conjugations at honest boundaries', () => {
    // 食べていた: only 食べて is an exact form of 食べる — the rest stays plain
    const segs = parseSentence('食べていた', DICTS)
    expect(segs[0].word?.entry.id).toBe('v1')
    expect(segs[0].text).toBe('食べて')
    expect(segs[0].word?.formLabel).toBe('Te form')
  })

  it('prefers the longest match', () => {
    // 楽しい must win over any shorter accidental match
    const segs = parseSentence('楽しい旅行', DICTS)
    expect(segs.map((s) => s.word?.entry.id)).toEqual(['w4', 'w1'])
  })

  it('single kana only matches particles, never nouns', () => {
    const segs = parseSentence('きの', DICTS)
    // き (kana of 木) must NOT match; の (particle) must
    expect(segs[0].word).toBeUndefined()
    expect(segs[0].text).toBe('き')
    expect(segs[1].word?.entry.id).toBe('w5')
  })

  it('single kanji words still match', () => {
    const [seg] = parseSentence('木', DICTS)
    expect(seg.word?.entry.id).toBe('w6')
  })

  it('treats punctuation as plain text', () => {
    const segs = parseSentence('旅行、料理。', DICTS)
    expect(segs.map((s) => s.text)).toEqual(['旅行', '、', '料理', '。'])
    expect(segs[1].word).toBeUndefined()
  })

  it('kana spellings of dictionary words match too', () => {
    const [seg] = parseSentence('たべた', DICTS)
    expect(seg.word?.entry.id).toBe('v1')
    expect(seg.word?.formLabel).toBe('Past')
  })
})

const tok = (
  surface: string,
  pos: string,
  detail = '*',
  basic = surface,
  reading?: string,
): JaToken => ({
  surface_form: surface,
  pos,
  pos_detail_1: detail,
  basic_form: basic,
  reading,
})

describe('tokensToSegments (accurate mode)', () => {
  const SU_DICTS = buildParserDicts(
    [
      verb('v1', '食べる', 'たべる', 'v1'),
      verb('v3', '勉強する', 'べんきょうする', 'vs'),
      verb('v4', '遊ぶ', 'あそぶ', 'v5b'),
      verb('v5', '始める', 'はじめる', 'v1'),
    ],
    [word('w1', '旅行', 'りょこう'), word('w4', '楽しい', 'たのしい', 'adj-i')],
  )

  it('merges a verb with its ending chain and names the form', () => {
    const segs = tokensToSegments(
      [
        tok('食べ', '動詞', '自立', '食べる', 'タベ'),
        tok('ませ', '助動詞', '*', 'ます', 'マセ'),
        tok('ん', '助動詞', '*', 'ん', 'ン'),
        tok('でし', '助動詞', '*', 'です', 'デシ'),
        tok('た', '助動詞', '*', 'た', 'タ'),
      ],
      SU_DICTS,
    )
    expect(segs).toHaveLength(1)
    expect(segs[0].text).toBe('食べませんでした')
    expect(segs[0].word?.entry.id).toBe('v1')
    expect(segs[0].word?.formLabel).toBe('Past negative polite')
    expect(segs[0].token?.reading).toBe('たべませんでした')
    expect(segs[0].token?.baseForm).toBe('食べる')
  })

  it('joins サ変 nouns with する into the compound verb', () => {
    const segs = tokensToSegments(
      [
        tok('勉強', '名詞', 'サ変接続', '勉強', 'ベンキョウ'),
        tok('し', '動詞', '自立', 'する', 'シ'),
        tok('た', '助動詞', '*', 'た', 'タ'),
      ],
      SU_DICTS,
    )
    expect(segs).toHaveLength(1)
    expect(segs[0].text).toBe('勉強した')
    expect(segs[0].word?.entry.id).toBe('v3')
    expect(segs[0].word?.formLabel).toBe('Past')
  })

  it('merges い-adjective endings', () => {
    const segs = tokensToSegments(
      [tok('楽しかっ', '形容詞', '自立', '楽しい', 'タノシカッ'), tok('た', '助動詞', '*', 'た', 'タ')],
      SU_DICTS,
    )
    expect(segs[0].text).toBe('楽しかった')
    expect(segs[0].word?.entry.id).toBe('w4')
    expect(segs[0].word?.formLabel).toBe('Past')
  })

  it('annotates non-JLPT tokens with reading/POS but no link', () => {
    const segs = tokensToSegments([tok('東京', '名詞', '固有名詞', '東京', 'トウキョウ')], SU_DICTS)
    expect(segs[0].word).toBeUndefined()
    expect(segs[0].token).toEqual({ pos: 'noun', posLabel: 'Noun', reading: 'とうきょう' })
  })

  it('links plain tokens found in the JLPT lists', () => {
    const segs = tokensToSegments([tok('旅行', '名詞', '一般', '旅行', 'リョコウ')], SU_DICTS)
    expect(segs[0].word?.entry.id).toBe('w1')
  })

  it('never links a particle token to a content word sharing its kana', () => {
    // で the particle must not become 出 (で) the noun
    const dicts = buildParserDicts([], [word('w9', '出', 'で'), word('w5', 'の', 'の', 'particle')])
    const particle = tokensToSegments([tok('で', '助詞', '格助詞', 'で', 'デ')], dicts)
    expect(particle[0].word).toBeUndefined()
    expect(particle[0].token?.pos).toBe('particle')
    const no = tokensToSegments([tok('の', '助詞', '連体化', 'の', 'ノ')], dicts)
    expect(no[0].word?.entry.id).toBe('w5')
  })

  it('labels unidentified conjugations generically instead of dropping them', () => {
    // 食べている isn't one of the 22 forms — still one segment, still linked
    const segs = tokensToSegments(
      [
        tok('食べ', '動詞', '自立', '食べる', 'タベ'),
        tok('て', '助詞', '接続助詞', 'て', 'テ'),
        tok('いる', '動詞', '非自立', 'いる', 'イル'),
      ],
      SU_DICTS,
    )
    expect(segs[0].text).toBe('食べている')
    expect(segs[0].word?.entry.id).toBe('v1')
    expect(segs[0].word?.formLabel).toBe('Conjugated')
  })

  it('passes punctuation through as plain text', () => {
    const segs = tokensToSegments([tok('。', '記号', '句点')], SU_DICTS)
    expect(segs[0]).toEqual({ text: '。' })
  })

  it('keeps compound-verb tails separate (遊び + 始めた, not one 遊ぶ blob)', () => {
    // a 非自立 verb straight after a masu-stem is a compound tail — kuromoji
    // splits it correctly; the merge rule must not glue it back
    const segs = tokensToSegments(
      [
        tok('遊び', '動詞', '自立', '遊ぶ', 'アソビ'),
        tok('始め', '動詞', '非自立', '始める', 'ハジメ'),
        tok('た', '助動詞', '*', 'た', 'タ'),
      ],
      SU_DICTS,
    )
    expect(segs.map((s) => s.text)).toEqual(['遊び', '始めた'])
    expect(segs[0].word?.entry.id).toBe('v4')
    expect(segs[0].word?.formLabel).toBe('Stem')
    expect(segs[1].word?.entry.id).toBe('v5')
    expect(segs[1].word?.formLabel).toBe('Past')
  })

  it('still merges 非自立 helpers after a て connective (食べてしまった)', () => {
    const segs = tokensToSegments(
      [
        tok('食べ', '動詞', '自立', '食べる', 'タベ'),
        tok('て', '助詞', '接続助詞', 'て', 'テ'),
        tok('しまっ', '動詞', '非自立', 'しまう', 'シマッ'),
        tok('た', '助動詞', '*', 'た', 'タ'),
      ],
      SU_DICTS,
    )
    expect(segs).toHaveLength(1)
    expect(segs[0].text).toBe('食べてしまった')
    expect(segs[0].word?.entry.id).toBe('v1')
  })
})

describe('uniqueWords', () => {
  it('dedupes by entry and surface, keeps first-appearance order', () => {
    const segs = parseSentence('旅行の旅行を食べる食べた', DICTS)
    const words = uniqueWords(segs)
    expect(words.map((w) => `${w.entry.id}:${w.surface}`)).toEqual([
      'w1:旅行',
      'w5:の',
      'v1:食べる',
      'v1:食べた',
    ])
  })
})
