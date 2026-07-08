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

/** One component of a pattern-merged compound (参加 + 者). */
export interface WordPart {
  surface: string
  /** hiragana reading, when kuromoji supplied one */
  reading?: string
  /** the entry this component links to on its own, when any — a part's
   *  word never carries parts of its own (no recursion) */
  word?: ParsedWord
}

export interface ParsedWord {
  entry: VerbEntry | VocabEntry
  isVerb: boolean
  /** the word as it appears in the sentence */
  surface: string
  /** e.g. "Te form" when the surface is conjugated; null for dictionary form */
  formLabel: string | null
  /** components of a pattern-merged compound (参加+者) — absent otherwise */
  parts?: WordPart[]
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

/**
 * A POS-pattern compound span (参加+者) the JLPT lists missed — the Beyond
 * pass may still merge it if the extended index has the joined entry.
 */
export interface CompoundCandidate {
  /** joinable prefixes of the span, longest first */
  options: { surface: string; reading?: string; span: number }[]
  /** per-token parts for the LONGEST option; option k uses parts.slice(0, k.span) */
  parts: WordPart[]
}

export interface ParsedSegment {
  text: string
  /** present when this run of text matched a dictionary word */
  word?: ParsedWord
  /** kuromoji annotation (absent for punctuation and heuristic-mode parses) */
  token?: TokenInfo
  /** present on the FIRST segment of an unmerged compound span (smart mode) */
  compound?: CompoundCandidate
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
 * Homograph tie-break for surfaces claimed by several entries. A key that
 * IS the entry's display form (`kanji`; equals `kana` for kana-native words
 * like よう "way/appearing") is a strong claim, worth as much as being a
 * verb — a kanji-written verb's bare kana reading must not outrank a
 * kana-native word of similar frequency (よう in どのように is the N4
 * noun, never 酔う the N3 verb), while 帰る (N5) still beats any rarer
 * native claimant of かえる. Then common words, then the easier JLPT
 * level — so kana こと resolves to 事 (N5, common), not 琴 the zither
 * (N3). The +1 on native claims keeps exact cross-type ties from being
 * decided by insertion order, which must never decide.
 */
function hitScore(entry: VerbEntry | VocabEntry, isVerb: boolean, key: string): number {
  return (
    (key === entry.kanji ? 101 : 0) +
    (isVerb ? 100 : 0) +
    (entry.common ? 10 : 0) +
    entry.jlpt
  )
}

function setPreferring(map: Map<string, DictHit>, key: string, hit: DictHit): void {
  const prev = map.get(key)
  if (!prev || hitScore(hit.entry, hit.isVerb, key) > hitScore(prev.entry, prev.isVerb, key)) {
    map.set(key, hit)
  }
}

function setPreferringT<T extends VerbEntry | VocabEntry>(
  map: Map<string, T>,
  key: string,
  entry: T,
): void {
  const prev = map.get(key)
  if (!prev || hitScore(entry, false, key) > hitScore(prev, false, key)) map.set(key, entry)
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

/**
 * Same check, but conjugating the TOKEN's own spelling — needed when a
 * variant-kanji surface (温かかった) linked to an entry written with the
 * primary form (暖かい): the entry's surfaces can never reproduce it.
 */
function identifyVerbFormAs(
  base: string,
  cls: VerbEntry['class'],
  surface: string,
): string | null {
  const pseudo = { kanji: base, kana: base, class: cls }
  for (const form of CONJUGATION_FORMS) {
    const c = conjugate(pseudo, form)
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

function identifyAdjFormAs(base: string, surface: string): string | null {
  for (const form of ADJECTIVE_FORMS) {
    const c = inflectAdjective({ kanji: base, kana: base }, 'adj-i', form)
    if (c && (c.kanji === surface || c.kana === surface)) {
      return ADJECTIVE_FORM_LABELS[form].label
    }
  }
  return null
}

/**
 * Dictionary-form lookup candidates for a token, best first: the written
 * base, then reading-based forms. JMdict (and therefore every index here)
 * keys variant kanji spellings by their PRIMARY form only, so a surface
 * like 温かい misses by spelling and must fall back to its reading
 * あたたかい to find the 暖かい entry. Conjugated surfaces don't carry a
 * base reading, so the surface reading is deconjugated instead.
 */
function baseCandidates(
  base: string,
  surface: string,
  reading: string | undefined,
): string[] {
  const out = [base]
  if (!reading || reading.length < 2) return out
  if (surface === base) {
    if (reading !== base) out.push(reading)
  } else {
    out.push(...deconjugate(reading))
  }
  return out
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

/**
 * True when the entry can plausibly be read as `reading` (no reading =
 * trust). Single-kana readings DO count — 屋 read や must not accept the
 * 屋/おく entry. (The ≥2 guards elsewhere are about *looking up* by bare
 * kana, which is noisy; *checking* against one is exact.)
 */
function entryReadsAs(entry: VerbEntry | VocabEntry, reading: string | undefined): boolean {
  if (!reading) return true
  return toHiragana(entry.kana) === reading
}

/** Link a token to a JLPT entry: surface, dictionary form, then reading. */
function linkToken(t: JaToken, dicts: ParserDicts): ParsedWord | null {
  let hit = dicts.lookup.get(t.surface_form) ?? dicts.lookup.get(baseOf(t))
  const functionWord = t.pos === '助詞' || t.pos === '助動詞'
  const reading = t.reading ? toHiragana(t.reading) : undefined
  // kuromoji's reading disambiguates homograph surfaces: 頃 read ころ must
  // not link to the けい entry (the Chinese land unit). When the surface hit
  // contradicts the reading, prefer a reading-consistent JLPT entry; if
  // none exists the Beyond pass gets a chance (misreadLink), and failing
  // that the closest match below stands.
  if (
    hit &&
    !functionWord &&
    reading &&
    t.surface_form === baseOf(t) &&
    !entryReadsAs(hit.entry, reading)
  ) {
    const byReading = reading.length >= 2 ? dicts.lookup.get(reading) : undefined
    if (byReading && !byReading.isVerb && entryReadsAs(byReading.entry, reading)) {
      hit = byReading
    }
  }
  if (!hit && !functionWord && reading) {
    if (reading.length >= 2 && reading !== t.surface_form) {
      const byReading = dicts.lookup.get(reading)
      // a reading hit must not jump word class (蛙 the noun ≠ 帰る the verb)
      if (byReading && !byReading.isVerb) hit = byReading
    }
  }
  if (!hit) return null
  // respect kuromoji's POS: a particle/auxiliary token must not link to a
  // content word that merely shares its kana (で the particle ≠ 出 the noun)
  if (functionWord) {
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
  let verb: VerbEntry | undefined
  for (const cand of baseCandidates(base, surface, reading)) {
    verb = dicts.verbs.get(cand)
    if (verb) break
  }
  if (!verb) return { text: surface, token: info }
  // surface === base covers variant-spelling links (温かい → 暖かい entry)
  const isDictForm = surface === base || surface === verb.kanji || surface === verb.kana
  const formLabel = isDictForm
    ? null
    : (identifyVerbForm(verb, surface) ??
      identifyVerbFormAs(base, verb.class, surface) ??
      'Conjugated')
  return {
    text: surface,
    token: info,
    word: { entry: verb, isVerb: true, surface, formLabel },
  }
}

// --- compound merging (smart mode) -------------------------------------------
// IPADIC tokenizes more granularly than JMdict lexemes: 参加者 splits into
// 参加+者 and 非常に into 非常+に even though both are single dictionary
// words. Two bounded patterns re-join them, gated by the honest-boundary
// rule (decisions 23/25): a merge happens ONLY when the joined surface IS a
// dictionary entry whose kana matches the joined reading — no entry or a
// wrong reading, and everything stays split exactly as before.

/** Noun details that may START a compound run. */
const COMPOUND_HEAD = new Set(['一般', 'サ変接続', '形容動詞語幹', '副詞可能'])
/** …plus 接尾, which may CONTINUE one (参加+者) but never start it. 非自立
 *  is excluded everywhere — よう in どのように must stay its own word
 *  (decision 49) — as are 代名詞/数/固有名詞 by not being listed. */
const COMPOUND_TAIL = new Set([...COMPOUND_HEAD, '接尾'])
/** Only adjectival/adverbial stems form に-adverbs (非常に). Plain 一般
 *  nouns never merge with に — 学校に is noun+particle (and no such
 *  dictionary entry exists to validate against anyway). */
const NI_ADVERB_HEAD = new Set(['形容動詞語幹', '副詞可能'])
const MAX_COMPOUND_TOKENS = 3

/** Merged-segment TokenInfo derives from the ENTRY's POS, not the tokens'. */
const VOCAB_POS_KEY: Partial<Record<VocabEntry['pos'], PosKey>> = {
  noun: 'noun',
  adverb: 'adverb',
  'adj-i': 'adjective',
  'adj-na': 'adjective',
  particle: 'particle',
}
const POS_KEY_LABELS: Record<PosKey, string> = {
  verb: 'Verb',
  noun: 'Noun',
  adjective: 'Adjective',
  adverb: 'Adverb',
  particle: 'Particle',
  other: 'Other',
}

function compoundToken(entry: VocabEntry, reading: string | undefined): TokenInfo {
  const pos = VOCAB_POS_KEY[entry.pos] ?? 'noun'
  const info: TokenInfo = { pos, posLabel: POS_KEY_LABELS[pos] }
  if (reading) info.reading = reading
  return info
}

/** A compound component with the link it would have gotten on its own. */
function tokenPart(t: JaToken, dicts: ParserDicts): WordPart {
  const part: WordPart = { surface: t.surface_form }
  if (t.reading) part.reading = toHiragana(t.reading)
  const word = linkToken(t, dicts)
  if (word) part.word = word
  return part
}

type CompoundScan =
  | { merged: ParsedSegment; span: number }
  | { candidate: CompoundCandidate }
  | null

/**
 * At a 名詞 head, look for a P1 noun run (参加+者, 質疑+応答; ≤3 tokens) or
 * a P2 adverbial-に pair (非常+に). Joined surfaces are tried against the
 * JLPT lookup longest-first; a hit merges immediately, otherwise the options
 * become a Beyond candidate for the ext pass. Every token in a span would
 * otherwise emit exactly one plain segment — linkBeyondWords' span
 * replacement RELIES on that 1:1 invariant.
 */
function scanCompound(tokens: JaToken[], i: number, dicts: ParserDicts): CompoundScan {
  const t = tokens[i]
  let end = i + 1
  while (
    end < tokens.length &&
    end - i < MAX_COMPOUND_TOKENS &&
    tokens[end].pos === '名詞' &&
    COMPOUND_TAIL.has(tokens[end].pos_detail_1)
  ) {
    end += 1
  }
  if (
    end === i + 1 &&
    NI_ADVERB_HEAD.has(t.pos_detail_1) &&
    tokens[i + 1]?.pos === '助詞' &&
    tokens[i + 1].surface_form === 'に'
  ) {
    end = i + 2
  }
  if (end - i < 2) return null

  const options: CompoundCandidate['options'] = []
  for (let span = end - i; span >= 2; span -= 1) {
    const surface = joinSurface(tokens, i, i + span)
    if (surface.length > MAX_WORD_LEN) continue
    options.push({ surface, reading: joinReading(tokens, i, i + span), span })
  }
  if (options.length === 0) return null

  const parts = tokens.slice(i, end).map((tk) => tokenPart(tk, dicts))
  for (const opt of options) {
    const hit = dicts.lookup.get(opt.surface)
    if (!hit || hit.isVerb || !entryReadsAs(hit.entry, opt.reading)) continue
    const entry = hit.entry as VocabEntry
    return {
      merged: {
        text: opt.surface,
        token: compoundToken(entry, opt.reading),
        word: {
          entry,
          isVerb: false,
          surface: opt.surface,
          formLabel: null,
          parts: parts.slice(0, opt.span),
        },
      },
      span: opt.span,
    }
  }
  return { candidate: { options, parts } }
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

    // P1/P2 compound scan (参加+者, 質疑+応答, 非常+に): merge when the
    // joined surface IS a dictionary entry (honest-boundary rule), else
    // record a Beyond candidate on the head segment for the ext pass
    if (t.pos === '名詞' && COMPOUND_HEAD.has(t.pos_detail_1)) {
      const res = scanCompound(tokens, i, dicts)
      if (res && 'merged' in res) {
        segments.push(res.merged)
        i += res.span
        continue
      }
      if (res) {
        segments.push({
          text: t.surface_form,
          token: tokenInfo(t),
          word: linkToken(t, dicts) ?? undefined,
          compound: res.candidate,
        })
        i += 1
        continue
      }
      // no pattern here — fall through to the plain single-token emit
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
      let adj: VocabEntry | undefined
      for (const cand of baseCandidates(base, surface, reading)) {
        adj = dicts.adjectives.get(cand)
        if (adj) break
      }
      if (adj) {
        const isDictForm = surface === base || surface === adj.kanji || surface === adj.kana
        const formLabel = isDictForm
          ? null
          : (identifyAdjForm(adj, surface) ?? identifyAdjFormAs(base, surface) ?? 'Inflected')
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

/** Lookup candidates for one unlinked segment, best first. */
function beyondCandidates(seg: ParsedSegment): string[] {
  const token = seg.token!
  const base = token.baseForm ?? seg.text
  if (token.pos === 'verb' || token.pos === 'adjective') {
    return baseCandidates(base, seg.text, token.reading)
  }
  const out = [seg.text]
  if (base !== seg.text) out.push(base)
  if (token.reading && token.reading.length >= 2 && token.reading !== seg.text) {
    out.push(token.reading)
  }
  return out
}

/**
 * A linked, uninflected, non-verb segment whose entry contradicts kuromoji's
 * reading (頃 read ころ linked to the けい entry) — returns the reading so
 * the Beyond pass can look for a better-reading entry to swap in.
 */
function misreadLink(seg: ParsedSegment): string | undefined {
  const reading = seg.token?.reading
  if (!seg.word || seg.word.isVerb || !reading || reading.length < 2) return undefined
  if (seg.token!.baseForm) return undefined // inflected: reading ≠ dict form by nature
  return entryReadsAs(seg.word.entry, reading) ? undefined : reading
}

/**
 * Surfaces worth querying against the extended indexes. `readings` carries
 * kuromoji's reading per uninflected surface so the ext lookup can prefer
 * the homograph that actually reads that way (屋 read や must find 屋/や
 * "shop", not 屋/おく "house", when the index holds both).
 */
export function collectUnlinkedSurfaces(segments: ParsedSegment[]): {
  verbs: Set<string>
  words: Set<string>
  readings: Map<string, string>
} {
  const verbs = new Set<string>()
  const words = new Set<string>()
  const readings = new Map<string, string>()
  for (const seg of segments) {
    if (!seg.token) continue
    // compound candidates (参加者) ride along even when the head segment is
    // itself linked (参加 is) — merging beats the component-only view
    if (seg.compound) {
      for (const opt of seg.compound.options) {
        words.add(opt.surface)
        if (opt.reading) readings.set(opt.surface, opt.reading)
      }
    }
    if (seg.word) {
      // wrong-reading links also go to the ext lookup (repair candidates)
      const reading = misreadLink(seg)
      if (reading) {
        words.add(seg.text)
        words.add(reading)
        readings.set(seg.text, reading)
      }
      continue
    }
    if (seg.token.pos === 'particle' || seg.token.pos === 'other') continue
    const target = seg.token.pos === 'verb' ? verbs : words
    for (const cand of beyondCandidates(seg)) target.add(cand)
    if (seg.token.pos !== 'verb' && !seg.token.baseForm && seg.token.reading) {
      readings.set(seg.text, seg.token.reading)
    }
  }
  return { verbs, words, readings }
}

/**
 * Merge an unresolved compound span (recorded by scanCompound) against the
 * extended entries: options longest-first, entry reading must match — no
 * reading-contradicting fallback (decision 50). Returns null when nothing
 * merges; every span segment then flows through linkOne untouched, so the
 * head (参加) keeps its JLPT link — never trade a real link for a blob.
 */
function mergeCompound(
  cand: CompoundCandidate,
  vocabEntries: Map<string, VocabEntry>,
): { seg: ParsedSegment; span: number } | null {
  for (const opt of cand.options) {
    const entry = vocabEntries.get(opt.surface)
    if (!entry || !entryReadsAs(entry, opt.reading)) continue
    // enrich word-less parts from the ext hits already in hand (者 was
    // queried as its own unlinked segment, so it's usually present)
    const parts = cand.parts.slice(0, opt.span).map((part) => {
      if (part.word) return part
      const e = vocabEntries.get(part.surface)
      if (!e || !entryReadsAs(e, part.reading)) return part
      return {
        ...part,
        word: { entry: e, isVerb: false, surface: part.surface, formLabel: null },
      }
    })
    return {
      span: opt.span,
      seg: {
        text: opt.surface,
        token: compoundToken(entry, opt.reading),
        word: { entry, isVerb: false, surface: opt.surface, formLabel: null, parts },
      },
    }
  }
  return null
}

/** Attaches extended-tier entries (jlpt 0 → "Beyond" badge) to the misses. */
export function linkBeyondWords(
  segments: ParsedSegment[],
  verbEntries: Map<string, VerbEntry>,
  vocabEntries: Map<string, VocabEntry>,
): ParsedSegment[] {
  const linkOne = (seg: ParsedSegment): ParsedSegment => {
    // wrong-reading repair: swap the link only when a Beyond entry actually
    // reads the way kuromoji says — otherwise the closest match stands
    const misread = seg.token ? misreadLink(seg) : undefined
    if (misread) {
      for (const cand of [seg.text, misread]) {
        const better = vocabEntries.get(cand)
        if (better && entryReadsAs(better, misread)) {
          return {
            ...seg,
            word: { entry: better, isVerb: false, surface: seg.text, formLabel: null },
          }
        }
      }
      return seg
    }
    if (seg.word || !seg.token) return seg
    if (seg.token.pos === 'particle' || seg.token.pos === 'other') return seg
    const base = seg.token.baseForm ?? seg.text
    if (seg.token.pos === 'verb') {
      let verb: VerbEntry | undefined
      for (const cand of beyondCandidates(seg)) {
        verb = verbEntries.get(cand)
        if (verb) break
      }
      if (!verb) return seg
      const isDictForm =
        seg.text === base || seg.text === verb.kanji || seg.text === verb.kana
      const formLabel = isDictForm
        ? null
        : (identifyVerbForm(verb, seg.text) ??
          identifyVerbFormAs(base, verb.class, seg.text) ??
          'Conjugated')
      return { ...seg, word: { entry: verb, isVerb: true, surface: seg.text, formLabel } }
    }
    // the entry must agree with kuromoji's reading (only checkable for
    // uninflected tokens): a contradicting link (屋/おく under a token
    // read や) mislabels the word — no link, with the correct furigana
    // still shown, is more honest than the wrong homograph
    const wantReading = seg.token.baseForm ? undefined : seg.token.reading
    let entry: VocabEntry | undefined
    for (const cand of beyondCandidates(seg)) {
      const e = vocabEntries.get(cand)
      if (e && entryReadsAs(e, wantReading)) {
        entry = e
        break
      }
    }
    if (!entry) return seg
    const inflected =
      entry.pos === 'adj-i' &&
      seg.text !== base &&
      seg.text !== entry.kanji &&
      seg.text !== entry.kana
    const formLabel = inflected
      ? (identifyAdjForm(entry, seg.text) ?? identifyAdjFormAs(base, seg.text) ?? 'Inflected')
      : null
    return { ...seg, word: { entry, isVerb: false, surface: seg.text, formLabel } }
  }

  // compound spans first: a merged span consumes its segments (including any
  // candidate recorded inside it); a failed head falls through to linkOne
  // and the next segment's own candidate still gets its chance
  const out: ParsedSegment[] = []
  let i = 0
  while (i < segments.length) {
    const cand = segments[i].compound
    if (cand) {
      const merged = mergeCompound(cand, vocabEntries)
      if (merged) {
        out.push(merged.seg)
        i += merged.span
        continue
      }
    }
    out.push(linkOne(segments[i]))
    i += 1
  }
  return out
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
