import { describe, expect, it } from 'vitest'
import type { VerbEntry, VocabEntry } from './types'
import {
  buildParserDicts,
  collectUnlinkedSurfaces,
  isJapaneseOnly,
  linkBeyondWords,
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

  it('kana-native words beat a kanji verb’s kana reading (どのよう ≠ 酔う)', () => {
    // real-world failure: bare よう linked to 酔う "to get drunk" (N3 verb,
    // kana よう) instead of the kana-native N4 noun よう "way / appearing"
    const you = word('you', 'よう', 'よう')
    you.jlpt = 4
    const drunk = verb('drunk', '酔う', 'よう', 'v5u')
    drunk.jlpt = 3
    const dicts = buildParserDicts([drunk], [you])
    const segs = parseSentence('どのように', dicts)
    const seg = segs.find((s) => s.text === 'よう')
    expect(seg?.word?.entry.id).toBe('you')
    // the verb still owns its own written form
    const [drunkSeg] = parseSentence('酔う', dicts)
    expect(drunkSeg.word?.entry.id).toBe('drunk')
  })

  it('a common easy verb still beats a rarer kana-native homograph (かえる)', () => {
    const kaeru = verb('kaeru', '帰る', 'かえる', 'v5r') // N5, common
    const frog = word('frog', 'かえる', 'かえる')
    frog.jlpt = 2
    const dicts = buildParserDicts([kaeru], [frog])
    const [seg] = parseSentence('かえる', dicts)
    expect(seg.word?.entry.id).toBe('kaeru')
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

  it('links variant kanji spellings through the reading (温かい → 暖かい)', () => {
    // JMdict keys spelling variants by the primary form only
    const dicts = buildParserDicts([], [word('warm', '暖かい', 'あたたかい', 'adj-i')])
    const segs = tokensToSegments(
      [tok('温かい', '形容詞', '自立', '温かい', 'アタタカイ')],
      dicts,
    )
    expect(segs[0].word?.entry.id).toBe('warm')
    // the surface IS the token's dictionary form — no conjugation label
    expect(segs[0].word?.formLabel).toBeNull()
  })

  it('labels conjugated variant spellings via the token spelling (温かかった)', () => {
    const dicts = buildParserDicts([], [word('warm', '暖かい', 'あたたかい', 'adj-i')])
    const segs = tokensToSegments(
      [
        tok('温かかっ', '形容詞', '自立', '温かい', 'アタタカカッ'),
        tok('た', '助動詞', '*', 'た', 'タ'),
      ],
      dicts,
    )
    expect(segs[0].word?.entry.id).toBe('warm')
    expect(segs[0].word?.formLabel).toBe('Past')
  })

  it('links nouns through the reading, but never across word class', () => {
    const dicts = buildParserDicts(
      [verb('kaeru', '帰る', 'かえる', 'v5r')],
      [word('fukin', '付近', 'ふきん')],
    )
    // 附近 misses by spelling, links via フキン
    const fukin = tokensToSegments([tok('附近', '名詞', '一般', '附近', 'フキン')], dicts)
    expect(fukin[0].word?.entry.id).toBe('fukin')
    // 蛙 the noun must NOT link to 帰る the verb just because both read かえる
    const frog = tokensToSegments([tok('蛙', '名詞', '一般', '蛙', 'カエル')], dicts)
    expect(frog[0].word).toBeUndefined()
  })

  it('includes reading candidates in the Beyond surface collection', () => {
    const segs = tokensToSegments(
      [tok('温かい', '形容詞', '自立', '温かい', 'アタタカイ')],
      buildParserDicts([], []),
    )
    const { words } = collectUnlinkedSurfaces(segs)
    expect(words.has('温かい')).toBe(true)
    expect(words.has('あたたかい')).toBe(true)
  })

  it('prefers the common/easier entry among homographs, in any insert order', () => {
    // こと must resolve to 事 "thing" (N5, common), never 琴 the zither (N3)
    const koto = word('thing', '事', 'こと')
    const zither = word('zither', '琴', 'こと')
    zither.jlpt = 3
    for (const vocab of [
      [koto, zither],
      [zither, koto],
    ]) {
      const dicts = buildParserDicts([], vocab)
      const segs = tokensToSegments([tok('こと', '名詞', '非自立', 'こと', 'コト')], dicts)
      expect(segs[0].word?.entry.id).toBe('thing')
    }
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

describe('compound merging (smart mode)', () => {
  it('merges 非常+に into the listed 非常に adverb, with parts', () => {
    const dicts = buildParserDicts(
      [],
      [
        word('hijou', '非常', 'ひじょう'),
        word('hijouni', '非常に', 'ひじょうに', 'adverb'),
        word('ni', 'に', 'に', 'particle'),
      ],
    )
    const segs = tokensToSegments(
      [tok('非常', '名詞', '形容動詞語幹', '非常', 'ヒジョウ'), tok('に', '助詞', '格助詞', 'に', 'ニ')],
      dicts,
    )
    expect(segs).toHaveLength(1)
    expect(segs[0].text).toBe('非常に')
    expect(segs[0].word?.entry.id).toBe('hijouni')
    expect(segs[0].word?.formLabel).toBeNull()
    expect(segs[0].token?.reading).toBe('ひじょうに')
    expect(segs[0].token?.pos).toBe('adverb')
    const parts = segs[0].word?.parts
    expect(parts?.map((p) => p.word?.entry.id)).toEqual(['hijou', 'ni'])
  })

  it('never merges a 非自立 head (よう+に stays split — decision 49)', () => {
    const dicts = buildParserDicts(
      [],
      [word('you', 'よう', 'よう'), word('youni', 'ように', 'ように', 'adverb')],
    )
    const segs = tokensToSegments(
      [tok('よう', '名詞', '非自立', 'よう', 'ヨウ'), tok('に', '助詞', '格助詞', 'に', 'ニ')],
      dicts,
    )
    expect(segs).toHaveLength(2)
    expect(segs[0].word?.entry.id).toBe('you')
  })

  it('never merges an ordinary noun with a case particle (学校+に)', () => {
    // even a (hypothetical) 学校に entry must not attract the merge — に
    // after a 一般 noun is grammar, not vocabulary
    const dicts = buildParserDicts(
      [],
      [word('gakkou', '学校', 'がっこう'), word('gakkouni', '学校に', 'がっこうに', 'adverb')],
    )
    const segs = tokensToSegments(
      [tok('学校', '名詞', '一般', '学校', 'ガッコウ'), tok('に', '助詞', '格助詞', 'に', 'ニ')],
      dicts,
    )
    expect(segs).toHaveLength(2)
    expect(segs[0].word?.entry.id).toBe('gakkou')
  })

  it('merges noun+suffix when the compound is listed (旅行+者)', () => {
    const dicts = buildParserDicts(
      [],
      [word('ryokou', '旅行', 'りょこう'), word('ryokousha', '旅行者', 'りょこうしゃ')],
    )
    const segs = tokensToSegments(
      [tok('旅行', '名詞', '一般', '旅行', 'リョコウ'), tok('者', '名詞', '接尾', '者', 'シャ')],
      dicts,
    )
    expect(segs).toHaveLength(1)
    expect(segs[0].word?.entry.id).toBe('ryokousha')
    const parts = segs[0].word?.parts
    expect(parts?.[0].word?.entry.id).toBe('ryokou')
    expect(parts?.[1].word).toBeUndefined() // 者 alone isn't listed here
  })

  it('rejects a merge whose reading contradicts the tokens', () => {
    const dicts = buildParserDicts(
      [],
      [word('ryokou', '旅行', 'りょこう'), word('ryokousha', '旅行者', 'りょこうしゃ')],
    )
    // 者 read モノ: joined りょこうもの ≠ entry りょこうしゃ → stays split
    const segs = tokensToSegments(
      [tok('旅行', '名詞', '一般', '旅行', 'リョコウ'), tok('者', '名詞', '接尾', '者', 'モノ')],
      dicts,
    )
    expect(segs).toHaveLength(2)
    expect(segs[0].word?.entry.id).toBe('ryokou')
    expect(segs[0].compound).toBeDefined() // still a Beyond candidate
  })

  it('records a Beyond candidate for unlisted compounds (参加+者)', () => {
    const dicts = buildParserDicts([], [word('sanka', '参加', 'さんか')])
    const segs = tokensToSegments(
      [tok('参加', '名詞', 'サ変接続', '参加', 'サンカ'), tok('者', '名詞', '接尾', '者', 'シャ')],
      dicts,
    )
    expect(segs).toHaveLength(2)
    expect(segs[0].word?.entry.id).toBe('sanka') // head keeps its JLPT link
    expect(segs[0].compound?.options[0]).toEqual({
      surface: '参加者',
      reading: 'さんかしゃ',
      span: 2,
    })
    const { words, readings } = collectUnlinkedSurfaces(segs)
    expect(words.has('参加者')).toBe(true)
    expect(readings.get('参加者')).toBe('さんかしゃ')
  })

  it('Beyond pass merges the candidate and enriches parts', () => {
    const dicts = buildParserDicts([], [word('sanka', '参加', 'さんか')])
    const segs = tokensToSegments(
      [tok('参加', '名詞', 'サ変接続', '参加', 'サンカ'), tok('者', '名詞', '接尾', '者', 'シャ')],
      dicts,
    )
    const compound = word('e-sankasha', '参加者', 'さんかしゃ')
    compound.jlpt = 0 as never
    const sha = word('e-sha', '者', 'しゃ')
    sha.jlpt = 0 as never
    const linked = linkBeyondWords(
      segs,
      new Map(),
      new Map([
        ['参加者', compound],
        ['者', sha],
      ]),
    )
    expect(linked).toHaveLength(1)
    expect(linked[0].text).toBe('参加者')
    expect(linked[0].word?.entry.id).toBe('e-sankasha')
    expect(linked[0].word?.entry.jlpt).toBe(0)
    const parts = linked[0].word?.parts
    expect(parts?.[0].word?.entry.id).toBe('sanka') // kept from the JLPT tier
    expect(parts?.[1].word?.entry.id).toBe('e-sha') // enriched from the ext hits
    // Words Found lists the compound once, never its parts
    expect(uniqueWords(linked).map((w) => w.entry.id)).toEqual(['e-sankasha'])
  })

  it('ext miss leaves the split exactly as today', () => {
    const dicts = buildParserDicts([], [word('sanka', '参加', 'さんか')])
    const segs = tokensToSegments(
      [tok('参加', '名詞', 'サ変接続', '参加', 'サンカ'), tok('者', '名詞', '接尾', '者', 'シャ')],
      dicts,
    )
    const linked = linkBeyondWords(segs, new Map(), new Map())
    expect(linked).toHaveLength(2)
    expect(linked[0].word?.entry.id).toBe('sanka')
    expect(linked[1].word).toBeUndefined()
  })

  it('rejects a Beyond compound whose reading contradicts the tokens', () => {
    const dicts = buildParserDicts([], [word('sanka', '参加', 'さんか')])
    const segs = tokensToSegments(
      [tok('参加', '名詞', 'サ変接続', '参加', 'サンカ'), tok('者', '名詞', '接尾', '者', 'シャ')],
      dicts,
    )
    const wrong = word('bad', '参加者', 'さんかもの')
    const linked = linkBeyondWords(segs, new Map(), new Map([['参加者', wrong]]))
    expect(linked).toHaveLength(2)
    expect(linked[0].word?.entry.id).toBe('sanka')
  })

  it('merges plain noun+noun runs from the ext index (質疑+応答)', () => {
    const dicts = buildParserDicts([], [])
    const segs = tokensToSegments(
      [
        tok('質疑', '名詞', '一般', '質疑', 'シツギ'),
        tok('応答', '名詞', 'サ変接続', '応答', 'オウトウ'),
      ],
      dicts,
    )
    expect(segs[0].compound?.options[0].surface).toBe('質疑応答')
    const compound = word('e-shitsugi', '質疑応答', 'しつぎおうとう')
    const linked = linkBeyondWords(segs, new Map(), new Map([['質疑応答', compound]]))
    expect(linked).toHaveLength(1)
    expect(linked[0].word?.entry.id).toBe('e-shitsugi')
  })

  it('a failed head still lets an inner candidate merge (企業内+勉強会 shape)', () => {
    const dicts = buildParserDicts([], [])
    const segs = tokensToSegments(
      [
        tok('企業', '名詞', '一般', '企業', 'キギョウ'),
        tok('内', '名詞', '接尾', '内', 'ナイ'),
        tok('勉強', '名詞', 'サ変接続', '勉強', 'ベンキョウ'),
        tok('会', '名詞', '接尾', '会', 'カイ'),
      ],
      dicts,
    )
    const linked = linkBeyondWords(
      segs,
      new Map(),
      new Map([
        ['企業内', word('e-kigyounai', '企業内', 'きぎょうない')],
        ['勉強会', word('e-benkyoukai', '勉強会', 'べんきょうかい')],
      ]),
    )
    expect(linked.map((s) => s.text)).toEqual(['企業内', '勉強会'])
    expect(linked.map((s) => s.word?.entry.id)).toEqual(['e-kigyounai', 'e-benkyoukai'])
  })
})

describe('Beyond linking', () => {
  const DICTS = buildParserDicts([verb('v1', '食べる', 'たべる', 'v1')], [])

  it('collects only unlinked content-word surfaces', () => {
    const segs = tokensToSegments(
      [
        tok('渦潮', '名詞', '一般', '渦潮', 'ウズシオ'),
        tok('を', '助詞', '格助詞', 'を', 'ヲ'),
        tok('食べ', '動詞', '自立', '食べる', 'タベ'),
        tok('た', '助動詞', '*', 'た', 'タ'),
      ],
      DICTS,
    )
    const { verbs, words } = collectUnlinkedSurfaces(segs)
    // を is a particle, 食べた is linked; the reading rides along as a
    // fallback candidate for variant spellings
    expect([...words]).toEqual(['渦潮', 'うずしお'])
    expect(verbs.size).toBe(0)
  })

  it('never links a Beyond entry that contradicts the reading (屋/おく ≠ や)', () => {
    // real-world failure: 帽子屋 tokenized 帽子+屋, 屋 read ヤ, but the ext
    // lookup returned the 屋/おく "house" homograph and it got linked anyway
    // (single-kana readings used to bypass the entryReadsAs check)
    const segs = tokensToSegments([tok('屋', '名詞', '接尾', '屋', 'ヤ')], DICTS)
    const { words, readings } = collectUnlinkedSurfaces(segs)
    expect(words.has('屋')).toBe(true)
    expect(readings.get('屋')).toBe('や') // fed to findVocabRowsBySurface
    const oku = word('oku', '屋', 'おく')
    const wrongly = linkBeyondWords(segs, new Map(), new Map([['屋', oku]]))
    expect(wrongly[0].word).toBeUndefined() // no link beats the wrong homograph
    const ya = word('ya', '屋', 'や', 'suffix')
    const rightly = linkBeyondWords(segs, new Map(), new Map([['屋', ya]]))
    expect(rightly[0].word?.entry.id).toBe('ya')
  })

  it('attaches extended entries with the conjugation identified', () => {
    const segs = tokensToSegments(
      [
        tok('彷徨っ', '動詞', '自立', '彷徨う', 'サマヨッ'),
        tok('た', '助動詞', '*', 'た', 'タ'),
        tok('渦潮', '名詞', '一般', '渦潮', 'ウズシオ'),
      ],
      DICTS,
    )
    const extVerb = verb('e1', '彷徨う', 'さまよう', 'v5u')
    extVerb.jlpt = 0 as never
    const extNoun = word('e2', '渦潮', 'うずしお')
    extNoun.jlpt = 0 as never
    const linked = linkBeyondWords(
      segs,
      new Map([['彷徨う', extVerb]]),
      new Map([['渦潮', extNoun]]),
    )
    expect(linked[0].word?.entry.id).toBe('e1')
    expect(linked[0].word?.formLabel).toBe('Past')
    expect(linked[1].word?.entry.id).toBe('e2')
    expect(linked[1].word?.entry.jlpt).toBe(0)
  })
})

describe('reading-mismatch handling (頃 read ころ, not けい)', () => {
  // the real-world failure: JLPT lists carry 頃/けい (the Chinese land
  // unit) but not 頃/ころ, so the surface lookup returns the wrong homograph
  const KEI = word('kei', '頃', 'けい')
  const koroToken = tok('頃', '名詞', '一般', '頃', 'コロ')

  it('prefers a reading-consistent JLPT entry over the surface hit', () => {
    const dicts = buildParserDicts(
      [],
      [KEI, word('koro', 'ころ', 'ころ')], // ころ listed kana-only
    )
    const [seg] = tokensToSegments([koroToken], dicts)
    expect(seg.word?.entry.id).toBe('koro')
  })

  it('collects wrong-reading links for the Beyond pass', () => {
    const dicts = buildParserDicts([], [KEI])
    const segs = tokensToSegments([koroToken], dicts)
    expect(segs[0].word?.entry.id).toBe('kei') // no better JLPT option yet
    const { verbs, words } = collectUnlinkedSurfaces(segs)
    expect([...words]).toEqual(['頃', 'ころ'])
    expect(verbs.size).toBe(0)
  })

  it('swaps in a Beyond entry that matches the reading', () => {
    const dicts = buildParserDicts([], [KEI])
    const segs = tokensToSegments([koroToken], dicts)
    const koroExt = word('e-koro', '頃', 'ころ')
    koroExt.jlpt = 0 as never
    const linked = linkBeyondWords(segs, new Map(), new Map([['頃', koroExt]]))
    expect(linked[0].word?.entry.id).toBe('e-koro')
    expect(linked[0].word?.formLabel).toBeNull()
  })

  it('keeps the closest match when no Beyond entry reads correctly', () => {
    const dicts = buildParserDicts([], [KEI])
    const segs = tokensToSegments([koroToken], dicts)
    const stillWrong = word('e-kei', '頃', 'けい')
    const linked = linkBeyondWords(segs, new Map(), new Map([['頃', stillWrong]]))
    expect(linked[0].word?.entry.id).toBe('kei') // original JLPT link stands
  })

  it('never flags inflected or verb links as misread', () => {
    const dicts = buildParserDicts([verb('v1', '食べる', 'たべる', 'v1')], [])
    const segs = tokensToSegments(
      [tok('食べ', '動詞', '自立', '食べる', 'タベ'), tok('た', '助動詞', '*', 'た', 'タ')],
      dicts,
    )
    expect(segs[0].word?.entry.id).toBe('v1')
    const { words } = collectUnlinkedSurfaces(segs)
    expect(words.size).toBe(0)
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
