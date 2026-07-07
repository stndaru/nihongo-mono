/**
 * Dictionary-driven sentence breakdown for the /parser page. This is NOT a
 * real morphological analyzer (kuromoji stays build-time only — its IPADIC
 * dictionary is a ~17 MB download): it's greedy longest-match segmentation
 * over the JLPT word lists, with `deconjugate` recovering dictionary forms
 * of conjugated verbs/い-adjectives and the conjugation engines naming the
 * exact form. Heuristic by design — the page carries an accuracy caveat.
 */
import { toHiragana } from 'wanakana'
import {
  ADJECTIVE_FORMS,
  ADJECTIVE_FORM_LABELS,
  inflectAdjective,
} from '@/lib/conjugation/adjective'
import { CONJUGATION_FORMS, FORM_LABELS, conjugate } from '@/lib/conjugation'
import type { VerbEntry, VocabEntry } from './types'
import { deconjugate } from './deconjugate'

/** Longest JLPT surface worth trying (expressions top out around here). */
const MAX_WORD_LEN = 16

// Japanese scripts + Japanese punctuation. Deliberately excludes full-width
// latin/digits (ＡＢＣ１２３) — the parser rejects anything roman.
// Ranges: CJK punct 3000–303F · hiragana 3040–309F · katakana 30A0–30FF ·
// katakana ext 31F0–31FF · CJK ext-A 3400–4DBF · CJK 4E00–9FFF.
const JA_ALLOWED =
  /[　-〿぀-ゟ゠-ヿㇰ-ㇿ㐀-䶿一-鿿！？（）：；～\s]/u

/** Punctuation/whitespace — rendered as plain text, never matched. */
const JA_PUNCT =
  /[　-〿！？（）：；～\s]/u

const KANJI = /[㐀-䶿一-鿿]/u

/** Keeps only kana/kanji/Japanese punctuation (used to filter the input). */
export function stripNonJapanese(text: string): string {
  return [...text].filter((ch) => JA_ALLOWED.test(ch)).join('')
}

/** True when every character is Japanese script or punctuation. */
export function isJapaneseOnly(text: string): boolean {
  return text.length > 0 && [...text].every((ch) => JA_ALLOWED.test(ch))
}

export interface ParsedWord {
  entry: VerbEntry | VocabEntry
  isVerb: boolean
  /** the word as it appears in the sentence */
  surface: string
  /** e.g. "Te form" when the surface is conjugated; null for dictionary form */
  formLabel: string | null
}

/** Broad POS bucket — drives the breakdown's underline colors. */
export type PosKey = 'verb' | 'noun' | 'adjective' | 'adverb' | 'particle' | 'other'

/** What kuromoji knows about a token, JLPT-listed or not. */
export interface TokenInfo {
  pos: PosKey
  posLabel: string
  /** hiragana reading (absent for words kuromoji couldn't read) */
  reading?: string
  /** dictionary form, when it differs from the surface */
  baseForm?: string
}

export interface ParsedSegment {
  text: string
  /** present when this run of text matched a dictionary word */
  word?: ParsedWord
  /** kuromoji annotation (absent for punctuation and heuristic-mode parses) */
  token?: TokenInfo
}

interface DictHit {
  entry: VerbEntry | VocabEntry
  isVerb: boolean
}

export interface ParserDicts {
  /** every surface (kanji + kana) → its entry; verbs win surface ties */
  lookup: Map<string, DictHit>
  /** verb dictionary forms only, for deconjugation candidates */
  verbs: Map<string, VerbEntry>
  /** い-adjectives only, for deconjugation candidates */
  adjectives: Map<string, VocabEntry>
}

/**
 * Homograph tie-break for surfaces claimed by several entries: verbs first
 * (existing behavior for surfaces that are both), then common words, then
 * the easier JLPT level — so kana こと resolves to 事 (N5, common), not
 * 琴 the zither (N3). Insertion order must never decide.
 */
function hitScore(entry: VerbEntry | VocabEntry, isVerb: boolean): number {
  return (isVerb ? 100 : 0) + (entry.common ? 10 : 0) + entry.jlpt
}

function setPreferring(map: Map<string, DictHit>, key: string, hit: DictHit): void {
  const prev = map.get(key)
  if (!prev || hitScore(hit.entry, hit.isVerb) > hitScore(prev.entry, prev.isVerb)) {
    map.set(key, hit)
  }
}

function setPreferringT<T extends VerbEntry | VocabEntry>(
  map: Map<string, T>,
  key: string,
  entry: T,
): void {
  const prev = map.get(key)
  if (!prev || hitScore(entry, false) > hitScore(prev, false)) map.set(key, entry)
}

export function buildParserDicts(verbs: VerbEntry[], vocab: VocabEntry[]): ParserDicts {
  const lookup = new Map<string, DictHit>()
  const verbMap = new Map<string, VerbEntry>()
  const adjMap = new Map<string, VocabEntry>()
  for (const entry of vocab) {
    const hit = { entry, isVerb: false }
    if (entry.kanji) setPreferring(lookup, entry.kanji, hit)
    if (entry.kana) setPreferring(lookup, entry.kana, hit)
    if (entry.pos === 'adj-i') {
      if (entry.kanji) setPreferringT(adjMap, entry.kanji, entry)
      if (entry.kana) setPreferringT(adjMap, entry.kana, entry)
    }
  }
  for (const entry of verbs) {
    const hit = { entry, isVerb: true }
    if (entry.kanji) setPreferring(lookup, entry.kanji, hit)
    if (entry.kana) setPreferring(lookup, entry.kana, hit)
    if (entry.kanji) setPreferringT(verbMap, entry.kanji, entry)
    if (entry.kana) setPreferringT(verbMap, entry.kana, entry)
  }
  return { lookup, verbs: verbMap, adjectives: adjMap }
}

/** Which of the 22 verb forms produces this exact surface, if any. */
function identifyVerbForm(verb: VerbEntry, surface: string): string | null {
  for (const form of CONJUGATION_FORMS) {
    const c = conjugate(verb, form)
    if (c && (c.kanji === surface || c.kana === surface)) return FORM_LABELS[form].label
  }
  return null
}

function identifyAdjForm(adj: VocabEntry, surface: string): string | null {
  for (const form of ADJECTIVE_FORMS) {
    const c = inflectAdjective(adj, 'adj-i', form)
    if (c && (c.kanji === surface || c.kana === surface)) {
      return ADJECTIVE_FORM_LABELS[form].label
    }
  }
  return null
}

/**
 * Single kana characters only match closed-class words (particles,
 * conjunctions) — matching every stray か as a noun would be pure noise.
 */
function acceptable(surface: string, hit: DictHit): boolean {
  if (surface.length > 1 || KANJI.test(surface)) return true
  if (hit.isVerb) return false
  const pos = (hit.entry as VocabEntry).pos
  return pos === 'particle' || pos === 'conjunction'
}

/** Longest dictionary match starting at `i`, or null. */
function matchAt(text: string, i: number, dicts: ParserDicts): ParsedWord | null {
  const max = Math.min(MAX_WORD_LEN, text.length - i)
  for (let len = max; len >= 1; len -= 1) {
    const s = text.slice(i, i + len)
    const direct = dicts.lookup.get(s)
    if (direct && acceptable(s, direct)) {
      return { entry: direct.entry, isVerb: direct.isVerb, surface: s, formLabel: null }
    }
    if (len >= 2) {
      // conjugated? recover dictionary-form candidates, then demand that the
      // surface is EXACTLY one of the candidate's forms — that keeps the
      // segment boundary honest (食べてい never matches; 食べて does)
      for (const cand of deconjugate(s)) {
        const verb = dicts.verbs.get(cand)
        if (verb) {
          const label = identifyVerbForm(verb, s)
          if (label) return { entry: verb, isVerb: true, surface: s, formLabel: label }
        }
        const adj = dicts.adjectives.get(cand)
        if (adj) {
          const label = identifyAdjForm(adj, s)
          if (label) return { entry: adj, isVerb: false, surface: s, formLabel: label }
        }
      }
    }
  }
  return null
}

export function parseSentence(text: string, dicts: ParserDicts): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  let plain = ''
  const flush = () => {
    if (plain) {
      segments.push({ text: plain })
      plain = ''
    }
  }
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (JA_PUNCT.test(ch)) {
      plain += ch
      i += 1
      continue
    }
    const word = matchAt(text, i, dicts)
    if (word) {
      flush()
      segments.push({ text: word.surface, word })
      i += word.surface.length
    } else {
      plain += ch
      i += 1
    }
  }
  flush()
  return segments
}

// --- kuromoji-backed segmentation (the opt-in "Accurate Parsing" mode) ------

/** Minimal shape of a kuromoji IPADIC token (see @types/kuromoji). */
export interface JaToken {
  surface_form: string
  pos: string
  pos_detail_1: string
  basic_form: string
  reading?: string
}

const POS_KEYS: Record<string, PosKey> = {
  動詞: 'verb',
  名詞: 'noun',
  形容詞: 'adjective',
  副詞: 'adverb',
  助詞: 'particle',
}

const POS_LABELS_EN: Record<string, string> = {
  動詞: 'Verb',
  名詞: 'Noun',
  形容詞: 'Adjective',
  副詞: 'Adverb',
  助詞: 'Particle',
  助動詞: 'Auxiliary',
  接続詞: 'Conjunction',
  連体詞: 'Adnominal',
  感動詞: 'Interjection',
  接頭詞: 'Prefix',
  フィラー: 'Filler',
}

function baseOf(t: JaToken): string {
  return t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form
}

function tokenInfo(t: JaToken): TokenInfo {
  const naAdj = t.pos === '名詞' && t.pos_detail_1 === '形容動詞語幹'
  const info: TokenInfo = {
    pos: naAdj ? 'adjective' : (POS_KEYS[t.pos] ?? 'other'),
    posLabel: naAdj ? 'な-adjective' : (POS_LABELS_EN[t.pos] ?? 'Other'),
  }
  if (t.reading) info.reading = toHiragana(t.reading)
  if (baseOf(t) !== t.surface_form) info.baseForm = baseOf(t)
  return info
}

/**
 * A verb/adjective plus the endings glued onto it (た, ます, て + helper
 * verbs…) reads as one word — merge them so 食べませんでした is a single
 * segment whose base form is 食べる.
 *
 * Non-independent verbs (動詞・非自立) are absorbed ONLY after a て/で
 * connective (食べて+いる, 食べて+しまう). Directly after a masu-stem they
 * are compound-verb tails and must stay their own word: 遊び始めた is
 * 遊び (stem of 遊ぶ) + 始めた (past of 始める), not one 遊ぶ blob.
 */
function chainEnd(tokens: JaToken[], start: number): number {
  let j = start + 1
  let sawConnective = false
  while (j < tokens.length) {
    const t = tokens[j]
    if (t.pos === '助動詞') {
      j += 1
      continue
    }
    if (
      t.pos === '助詞' &&
      t.pos_detail_1 === '接続助詞' &&
      ['て', 'で', 'ちゃ', 'じゃ'].includes(t.surface_form)
    ) {
      sawConnective = true
      j += 1
      continue
    }
    if (t.pos === '動詞' && t.pos_detail_1 === '非自立' && sawConnective) {
      j += 1
      continue
    }
    break
  }
  return j
}

function joinSurface(tokens: JaToken[], from: number, to: number): string {
  let s = ''
  for (let k = from; k < to; k += 1) s += tokens[k].surface_form
  return s
}

function joinReading(tokens: JaToken[], from: number, to: number): string | undefined {
  let s = ''
  for (let k = from; k < to; k += 1) {
    if (!tokens[k].reading) return undefined
    s += tokens[k].reading
  }
  return toHiragana(s)
}

/** Link a token to a JLPT entry by surface first, then dictionary form. */
function linkToken(t: JaToken, dicts: ParserDicts): ParsedWord | null {
  const hit = dicts.lookup.get(t.surface_form) ?? dicts.lookup.get(baseOf(t))
  if (!hit) return null
  // respect kuromoji's POS: a particle/auxiliary token must not link to a
  // content word that merely shares its kana (で the particle ≠ 出 the noun)
  if (t.pos === '助詞' || t.pos === '助動詞') {
    const pos = (hit.entry as VocabEntry).pos
    if (hit.isVerb || (pos !== 'particle' && pos !== 'conjunction')) return null
  }
  return { entry: hit.entry, isVerb: hit.isVerb, surface: t.surface_form, formLabel: null }
}

function verbSegment(
  tokens: JaToken[],
  i: number,
  j: number,
  base: string,
  dicts: ParserDicts,
): ParsedSegment {
  const surface = joinSurface(tokens, i, j)
  const info: TokenInfo = { pos: 'verb', posLabel: 'Verb' }
  const reading = joinReading(tokens, i, j)
  if (reading) info.reading = reading
  if (base !== surface) info.baseForm = base
  const verb = dicts.verbs.get(base)
  if (!verb) return { text: surface, token: info }
  const isDictForm = surface === verb.kanji || surface === verb.kana
  const formLabel = isDictForm ? null : (identifyVerbForm(verb, surface) ?? 'Conjugated')
  return {
    text: surface,
    token: info,
    word: { entry: verb, isVerb: true, surface, formLabel },
  }
}

/**
 * Turns kuromoji tokens into the same ParsedSegment shape the greedy parser
 * emits, so the page renders both engines identically — with `token`
 * annotations (reading/POS/base form) on everything kuromoji analyzed.
 */
export function tokensToSegments(tokens: JaToken[], dicts: ParserDicts): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]

    if (t.pos === '記号') {
      segments.push({ text: t.surface_form })
      i += 1
      continue
    }

    // a verb + its ending chain; 非自立 verbs land here too when they head
    // their own chain (the 始め of 遊び+始めた)
    if (t.pos === '動詞') {
      const j = chainEnd(tokens, i)
      segments.push(verbSegment(tokens, i, j, baseOf(t), dicts))
      i = j
      continue
    }

    // サ変 noun + する → the noun+する verb entry (勉強しました → 勉強する)
    if (
      t.pos === '名詞' &&
      t.pos_detail_1 === 'サ変接続' &&
      tokens[i + 1]?.pos === '動詞' &&
      baseOf(tokens[i + 1]) === 'する' &&
      dicts.verbs.has(t.surface_form + 'する')
    ) {
      const j = chainEnd(tokens, i + 1)
      segments.push(verbSegment(tokens, i, j, t.surface_form + 'する', dicts))
      i = j
      continue
    }

    // い-adjective + its ending chain (楽しかっ+た)
    if (t.pos === '形容詞' && t.pos_detail_1 === '自立') {
      let j = i + 1
      while (j < tokens.length && tokens[j].pos === '助動詞') j += 1
      const surface = joinSurface(tokens, i, j)
      const info: TokenInfo = { pos: 'adjective', posLabel: 'Adjective' }
      const reading = joinReading(tokens, i, j)
      if (reading) info.reading = reading
      const base = baseOf(t)
      if (base !== surface) info.baseForm = base
      const adj = dicts.adjectives.get(base)
      if (adj) {
        const isDictForm = surface === adj.kanji || surface === adj.kana
        const formLabel = isDictForm ? null : (identifyAdjForm(adj, surface) ?? 'Inflected')
        segments.push({
          text: surface,
          token: info,
          word: { entry: adj, isVerb: false, surface, formLabel },
        })
      } else {
        segments.push({ text: surface, token: info })
      }
      i = j
      continue
    }

    // everything else is a single token: annotate, link when JLPT-listed
    segments.push({
      text: t.surface_form,
      token: tokenInfo(t),
      word: linkToken(t, dicts) ?? undefined,
    })
    i += 1
  }
  return segments
}

// --- Beyond-tier linking (smart mode only) -----------------------------------
// Content-word tokens the JLPT maps missed get a second chance against the
// extended indexes, so 渦潮 links to its JMdict entry marked "Beyond".

/** Surfaces worth querying against the extended indexes. */
export function collectUnlinkedSurfaces(segments: ParsedSegment[]): {
  verbs: Set<string>
  words: Set<string>
} {
  const verbs = new Set<string>()
  const words = new Set<string>()
  for (const seg of segments) {
    if (seg.word || !seg.token) continue
    if (seg.token.pos === 'particle' || seg.token.pos === 'other') continue
    const base = seg.token.baseForm ?? seg.text
    if (seg.token.pos === 'verb') {
      verbs.add(base)
    } else {
      words.add(seg.text)
      if (base !== seg.text) words.add(base)
    }
  }
  return { verbs, words }
}

/** Attaches extended-tier entries (jlpt 0 → "Beyond" badge) to the misses. */
export function linkBeyondWords(
  segments: ParsedSegment[],
  verbEntries: Map<string, VerbEntry>,
  vocabEntries: Map<string, VocabEntry>,
): ParsedSegment[] {
  return segments.map((seg) => {
    if (seg.word || !seg.token) return seg
    const base = seg.token.baseForm ?? seg.text
    if (seg.token.pos === 'verb') {
      const verb = verbEntries.get(base)
      if (!verb) return seg
      const isDictForm = seg.text === verb.kanji || seg.text === verb.kana
      const formLabel = isDictForm ? null : (identifyVerbForm(verb, seg.text) ?? 'Conjugated')
      return { ...seg, word: { entry: verb, isVerb: true, surface: seg.text, formLabel } }
    }
    const entry = vocabEntries.get(seg.text) ?? vocabEntries.get(base)
    if (!entry) return seg
    const formLabel =
      entry.pos === 'adj-i' && seg.text !== entry.kanji && seg.text !== entry.kana
        ? (identifyAdjForm(entry, seg.text) ?? 'Inflected')
        : null
    return { ...seg, word: { entry, isVerb: false, surface: seg.text, formLabel } }
  })
}

/** The matched words in order of first appearance, deduped by id+surface. */
export function uniqueWords(segments: ParsedSegment[]): ParsedWord[] {
  const seen = new Set<string>()
  const out: ParsedWord[] = []
  for (const seg of segments) {
    if (!seg.word) continue
    const key = `${seg.word.entry.id}:${seg.word.surface}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(seg.word)
  }
  return out
}
