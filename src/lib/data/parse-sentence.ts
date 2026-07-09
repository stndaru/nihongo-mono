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

/**
 * Parser input cap, shared by the /parser route and the palette's "Break
 * Down as Sentence" gate. Sized to keep the translation fallback alive:
 * MyMemory rejects queries over 500 bytes, and Japanese is 3 bytes/char in
 * UTF-8, so ~166 chars is the hard ceiling — 120 stays safely inside it
 * (and the ?q= URL stays ~1.1 KB percent-encoded).
 */
export const MAX_SENTENCE_LEN = 120

// Japanese scripts + Japanese punctuation + digits (both ASCII and
// full-width — 3人 and ３人 are ordinary Japanese text). Deliberately
// excludes latin (ＡＢＣ/abc) — the parser rejects anything roman.
// Ranges: CJK punct 3000–303F · hiragana 3040–309F · katakana 30A0–30FF ·
// katakana ext 31F0–31FF · CJK ext-A 3400–4DBF · CJK 4E00–9FFF.
const JA_ALLOWED =
  /[　-〿぀-ゟ゠-ヿㇰ-ㇿ㐀-䶿一-鿿！？（）：；～0-9０-９\s]/u

/** Punctuation/whitespace — rendered as plain text, never matched. */
const JA_PUNCT =
  /[　-〿！？（）：；～\s]/u

const KANJI = /[㐀-䶿一-鿿]/u

/** Any kana or kanji — what makes text *Japanese* rather than just allowed. */
const JA_SCRIPT = /[぀-ゟ゠-ヿㇰ-ㇿ㐀-䶿一-鿿]/u

/** Entirely katakana — signals the kana-native word (イチョウ the ginkgo). */
const KATAKANA_ONLY = /^[゠-ヿㇰ-ㇿ]+$/u

/** Keeps only kana/kanji/digits/Japanese punctuation (input filter). */
export function stripNonJapanese(text: string): string {
  return [...text].filter((ch) => JA_ALLOWED.test(ch)).join('')
}

/**
 * True when the text is entirely allowed characters AND contains at least
 * one kana/kanji — digits alone ("123") are allowed *in* a sentence but are
 * not a Japanese sentence, so the palette must not offer to parse them.
 */
export function isJapaneseOnly(text: string): boolean {
  return (
    text.length > 0 && JA_SCRIPT.test(text) && [...text].every((ch) => JA_ALLOWED.test(ch))
  )
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
  /**
   * Other entries that could equally claim this exact surface (うち links to
   * "house" but may be 内 "while"; いった may be 言った) — best first, so the
   * summary popup can offer them when the tie-break picked wrong. An
   * alternative never carries alternatives of its own (no recursion).
   */
  alternatives?: ParsedWord[]
  /**
   * The token sits right after a number (146本) but the linked entry is not
   * a counter — it IS acting as one here (kuromoji 名詞・接尾), the lists
   * just have no counter entry for it. The popup shows an honest usage note.
   */
  counterUse?: boolean
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
  /** suffix noun right after a number (146本, 20名) — a counter position */
  counter?: boolean
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
  /**
   * Contested surfaces only: every key claimed by ≥2 entries → ALL claimants,
   * best first. `lookup` keeps just the tie-break winner; this keeps the
   * losers so mistagged homographs (うち "house" vs 内 "while") stay
   * reachable as alternatives.
   */
  alternates: Map<string, DictHit[]>
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
  const claims = new Map<string, DictHit[]>()
  const claim = (key: string, hit: DictHit) => {
    const list = claims.get(key)
    if (list) list.push(hit)
    else claims.set(key, [hit])
  }
  for (const entry of vocab) {
    const hit = { entry, isVerb: false }
    if (entry.kanji) {
      setPreferring(lookup, entry.kanji, hit)
      claim(entry.kanji, hit)
    }
    if (entry.kana) {
      setPreferring(lookup, entry.kana, hit)
      if (entry.kana !== entry.kanji) claim(entry.kana, hit)
    }
    if (entry.pos === 'adj-i') {
      if (entry.kanji) setPreferringT(adjMap, entry.kanji, entry)
      if (entry.kana) setPreferringT(adjMap, entry.kana, entry)
    }
  }
  for (const entry of verbs) {
    const hit = { entry, isVerb: true }
    if (entry.kanji) {
      setPreferring(lookup, entry.kanji, hit)
      claim(entry.kanji, hit)
    }
    if (entry.kana) {
      setPreferring(lookup, entry.kana, hit)
      if (entry.kana !== entry.kanji) claim(entry.kana, hit)
    }
    if (entry.kanji) setPreferringT(verbMap, entry.kanji, entry)
    if (entry.kana) setPreferringT(verbMap, entry.kana, entry)
  }
  // keep only contested keys (uncontested arrays would triple the map's
  // footprint for zero information — the winner is already in `lookup`)
  const alternates = new Map<string, DictHit[]>()
  for (const [key, hits] of claims) {
    if (hits.length < 2) continue
    hits.sort(
      (a, b) => hitScore(b.entry, b.isVerb, key) - hitScore(a.entry, a.isVerb, key),
    )
    alternates.set(key, hits)
  }
  return { lookup, verbs: verbMap, adjectives: adjMap, alternates }
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

// --- homograph alternatives ---------------------------------------------------
// The tie-break (hitScore) has no sentence context, so it sometimes picks the
// wrong claimant of a shared surface (うち in 乗っているうち is 内 "while",
// not "house"). Every linked word therefore carries the OTHER plausible
// entries for its exact written form, and the summary popup offers them.
// Reading-only claimants are deliberately not alternatives — a kanji surface
// pins the word (集 can never be 週), which is decision 52's lookup rule.

/** Shown in the popup — more than this is noise, not disambiguation. */
const MAX_ALTERNATIVES = 4

function altKey(hit: DictHit): string {
  return `${hit.isVerb ? 'v' : 'w'}:${hit.entry.id}`
}

/** Other entries claiming this exact surface as a dictionary form. */
function directAlternatives(
  surface: string,
  chosen: DictHit,
  dicts: ParserDicts,
): ParsedWord[] | undefined {
  const hits = dicts.alternates.get(surface)
  if (!hits) return undefined
  const skip = altKey(chosen)
  const out: ParsedWord[] = []
  for (const hit of hits) {
    if (altKey(hit) === skip || !acceptable(surface, hit)) continue
    out.push({ entry: hit.entry, isVerb: hit.isVerb, surface, formLabel: null })
    if (out.length === MAX_ALTERNATIVES) break
  }
  return out.length > 0 ? out : undefined
}

/** Merge two alternative lists, first-list-first, deduped, capped. */
function mergeAlternatives(
  a: ParsedWord[] | undefined,
  b: ParsedWord[] | undefined,
): ParsedWord[] | undefined {
  if (!a || !b) return a ?? b
  const seen = new Set(a.map((w) => altKey({ entry: w.entry, isVerb: w.isVerb })))
  const out = [...a]
  for (const w of b) {
    if (!seen.has(altKey({ entry: w.entry, isVerb: w.isVerb }))) out.push(w)
  }
  return out.slice(0, MAX_ALTERNATIVES)
}

/**
 * Other verbs/adjectives whose conjugation also produces this exact surface
 * (いった is the past of both 行く and 言う). Each candidate must reproduce
 * the surface through a named form — same honesty bar as the primary link.
 */
function conjugatedAlternatives(
  surface: string,
  chosen: DictHit,
  dicts: ParserDicts,
): ParsedWord[] | undefined {
  const seen = new Set([altKey(chosen)])
  const out: ParsedWord[] = []
  for (const cand of deconjugate(surface)) {
    const hits: DictHit[] = []
    const verb = dicts.verbs.get(cand)
    if (verb) hits.push({ entry: verb, isVerb: true })
    const adj = dicts.adjectives.get(cand)
    if (adj) hits.push({ entry: adj, isVerb: false })
    hits.push(...(dicts.alternates.get(cand) ?? []))
    for (const hit of hits) {
      const key = altKey(hit)
      if (seen.has(key)) continue
      const label = hit.isVerb
        ? identifyVerbForm(hit.entry as VerbEntry, surface)
        : (hit.entry as VocabEntry).pos === 'adj-i'
          ? identifyAdjForm(hit.entry as VocabEntry, surface)
          : null
      if (!label) continue
      seen.add(key)
      out.push({ entry: hit.entry, isVerb: hit.isVerb, surface, formLabel: label })
      if (out.length === MAX_ALTERNATIVES) return out
    }
  }
  return out.length > 0 ? out : undefined
}

/** Longest dictionary match starting at `i`, or null. */
function matchAt(text: string, i: number, dicts: ParserDicts): ParsedWord | null {
  const max = Math.min(MAX_WORD_LEN, text.length - i)
  for (let len = max; len >= 1; len -= 1) {
    const s = text.slice(i, i + len)
    const direct = dicts.lookup.get(s)
    if (direct && acceptable(s, direct)) {
      const word: ParsedWord = {
        entry: direct.entry,
        isVerb: direct.isVerb,
        surface: s,
        formLabel: null,
      }
      // both directions: いける is 生ける's own form AND the potential of
      // 行く — the latter only surfaces as a conjugated alternative
      const alts = mergeAlternatives(
        directAlternatives(s, direct, dicts),
        len >= 2 ? conjugatedAlternatives(s, direct, dicts) : undefined,
      )
      if (alts) word.alternatives = alts
      return word
    }
    if (len >= 2) {
      // conjugated? recover dictionary-form candidates, then demand that the
      // surface is EXACTLY one of the candidate's forms — that keeps the
      // segment boundary honest (食べてい never matches; 食べて does)
      for (const cand of deconjugate(s)) {
        const verb = dicts.verbs.get(cand)
        if (verb) {
          const label = identifyVerbForm(verb, s)
          if (label) {
            const word: ParsedWord = { entry: verb, isVerb: true, surface: s, formLabel: label }
            const alts = conjugatedAlternatives(s, { entry: verb, isVerb: true }, dicts)
            if (alts) word.alternatives = alts
            return word
          }
        }
        const adj = dicts.adjectives.get(cand)
        if (adj) {
          const label = identifyAdjForm(adj, s)
          if (label) {
            const word: ParsedWord = { entry: adj, isVerb: false, surface: s, formLabel: label }
            const alts = conjugatedAlternatives(s, { entry: adj, isVerb: false }, dicts)
            if (alts) word.alternatives = alts
            return word
          }
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
 * Voice suffixes IPADIC tags as 動詞・接尾 (悩まさ+れ+た). Purely
 * inflectional — never independent verbs — so the chain absorbs them
 * unconditionally, unlike 非自立 compound tails. Restricted to this set:
 * other 接尾 verbs (がる, めく…) derive NEW words and must stay separate.
 */
const VOICE_SUFFIXES = new Set(['れる', 'られる', 'せる', 'させる'])

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
    // passive/causative endings: 悩まさ+れ+た must read 悩まされた
    if (t.pos === '動詞' && t.pos_detail_1 === '接尾' && VOICE_SUFFIXES.has(baseOf(t))) {
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
  const surfaceHit = hit
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
    // the swap-in must not contradict the WRITTEN form either: 名 read めい
    // must not become 姪 "niece" just because both read めい — only an entry
    // written as this surface, or a kana-native one (ころ for 頃), may
    // replace it. The kanji pins the word (decisions 52/55).
    if (
      byReading &&
      !byReading.isVerb &&
      entryReadsAs(byReading.entry, reading) &&
      (byReading.entry.kanji === t.surface_form ||
        byReading.entry.kanji === byReading.entry.kana)
    ) {
      hit = byReading
    }
  }
  if (!hit && !functionWord && reading) {
    // the reading fallback assumes a variant SPELLING of the same word
    // (附近 → 付近) — that only holds for multi-character surfaces. A lone
    // kanji shares its reading with unrelated words (集/週/州 are all
    // しゅう), so single-kanji tokens never link by reading; the Beyond
    // pass finds them by exact surface instead.
    if (t.surface_form.length > 1 && reading.length >= 2 && reading !== t.surface_form) {
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
    // no alternatives either — kuromoji's POS already pinned the class,
    // so 歯/二 must not surface as "could also be" on every は/に
    return { entry: hit.entry, isVerb: hit.isVerb, surface: t.surface_form, formLabel: null }
  }
  const word: ParsedWord = {
    entry: hit.entry,
    isVerb: hit.isVerb,
    surface: t.surface_form,
    formLabel: null,
  }
  const alts = directAlternatives(t.surface_form, hit, dicts) ?? []
  // a reading-consistent swap displaced the surface's own claimant (頃 read
  // ころ dropped the けい entry) — that entry is still a plausible reading
  // of the written form, so keep it reachable
  if (
    surfaceHit &&
    altKey(surfaceHit) !== altKey(hit) &&
    acceptable(t.surface_form, surfaceHit) &&
    !alts.some((a) => altKey({ entry: a.entry, isVerb: a.isVerb }) === altKey(surfaceHit))
  ) {
    alts.push({
      entry: surfaceHit.entry,
      isVerb: surfaceHit.isVerb,
      surface: t.surface_form,
      formLabel: null,
    })
  }
  if (alts.length > 0) word.alternatives = alts.slice(0, MAX_ALTERNATIVES)
  return word
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
  let verb = dicts.verbs.get(base)
  let baseDeconjLabel: string | null = null
  if (!verb) {
    // IPADIC lexicalizes godan potentials: 行ける tokenizes with base 行ける,
    // which no JLPT list carries — and the reading fallback below would find
    // 生ける "to arrange flowers" through the shared kana いける, ignoring
    // the kanji. Deconjugating the BASE keeps its kanji (行ける → 行く), so
    // that runs first, with proof (honest-boundary rule): the entry must
    // reproduce the surface as a named form ("Potential"), or the surface
    // must at least be a form of the lexicalized base itself (行けない —
    // negative of the ichidan-conjugating 行ける), earning the generic
    // "Conjugated" label.
    for (const cand of deconjugate(base)) {
      const v = dicts.verbs.get(cand)
      if (!v) continue
      const label =
        identifyVerbForm(v, surface) ??
        (identifyVerbFormAs(base, 'v1', surface) ? 'Conjugated' : null)
      if (!label) continue
      verb = v
      baseDeconjLabel = label
      break
    }
  }
  if (!verb) {
    for (const cand of baseCandidates(base, surface, reading)) {
      verb = dicts.verbs.get(cand)
      if (verb) break
    }
  }
  if (!verb) return { text: surface, token: info }
  const formLabel = baseDeconjLabel
    ? surface === verb.kanji || surface === verb.kana
      ? null
      : baseDeconjLabel
    : // surface === base covers variant-spelling links (温かい → 暖かい entry)
      surface === base || surface === verb.kanji || surface === verb.kana
      ? null
      : (identifyVerbForm(verb, surface) ??
        identifyVerbFormAs(base, verb.class, surface) ??
        'Conjugated')
  const word: ParsedWord = { entry: verb, isVerb: true, surface, formLabel }
  const chosen = { entry: verb, isVerb: true }
  // dict-form surfaces check both directions: いける is 生ける's own form
  // AND the potential of 行く — the latter is only reachable as a
  // conjugated alternative
  const alts =
    formLabel === null
      ? mergeAlternatives(
          directAlternatives(surface, chosen, dicts),
          conjugatedAlternatives(surface, chosen, dicts),
        )
      : conjugatedAlternatives(surface, chosen, dicts)
  if (alts) word.alternatives = alts
  return { text: surface, token: info, word }
}

// --- compound merging (smart mode) -------------------------------------------
// IPADIC tokenizes more granularly than JMdict lexemes: 参加者 splits into
// 参加+者 and 非常に into 非常+に even though both are single dictionary
// words. Two bounded patterns re-join them, gated by the honest-boundary
// rule (decisions 23/25): a merge happens ONLY when the joined surface IS a
// dictionary entry whose kana matches the joined reading — no entry or a
// wrong reading, and everything stays split exactly as before.

/** Noun details that may START a compound run. ナイ形容詞語幹 is IPADIC's
 *  class for ない-adjective stems (問題, 仕方) — ordinary content nouns
 *  that head real compounds (問題+集 → 問題集). */
const COMPOUND_HEAD = new Set([
  '一般',
  'サ変接続',
  '形容動詞語幹',
  '副詞可能',
  'ナイ形容詞語幹',
])
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
        const word: ParsedWord = { entry: adj, isVerb: false, surface, formLabel }
        const chosen = { entry: adj, isVerb: false }
        const alts = isDictForm
          ? directAlternatives(surface, chosen, dicts)
          : conjugatedAlternatives(surface, chosen, dicts)
        if (alts) word.alternatives = alts
        segments.push({ text: surface, token: info, word })
      } else {
        segments.push({ text: surface, token: info })
      }
      i = j
      continue
    }

    // everything else is a single token: annotate, link when JLPT-listed
    const info = tokenInfo(t)
    const word = linkToken(t, dicts) ?? undefined
    // a suffix noun right after a number is a counter position (146本,
    // 20名) — mark it so the Beyond pass can look for a real counter entry
    // and the popup can explain the usage when none exists
    if (
      t.pos === '名詞' &&
      t.pos_detail_1 === '接尾' &&
      tokens[i - 1]?.pos === '名詞' &&
      tokens[i - 1].pos_detail_1 === '数'
    ) {
      info.counter = true
      if (word && (word.isVerb || (word.entry as VocabEntry).pos !== 'counter')) {
        word.counterUse = true
      }
    }
    segments.push({ text: t.surface_form, token: info, word })
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
  // reading = variant-spelling fallback: multi-character surfaces only —
  // a lone kanji shares its reading with unrelated words (集/週/州)
  if (
    seg.text.length > 1 &&
    token.reading &&
    token.reading.length >= 2 &&
    token.reading !== seg.text
  ) {
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
  /** counter-position surfaces (146本) — the ext lookup prefers ct rows */
  counters: Set<string>
  /** reading candidates of katakana surfaces — prefer kana-native rows */
  kanaNative: Set<string>
} {
  const verbs = new Set<string>()
  const words = new Set<string>()
  const readings = new Map<string, string>()
  const counters = new Set<string>()
  const kanaNative = new Set<string>()
  for (const seg of segments) {
    if (!seg.token) continue
    // digits (kuromoji 名詞・数) can never be dictionary entries — querying
    // them would only force the ext scan to run to the end of its rows
    if (!JA_SCRIPT.test(seg.text)) continue
    // compound candidates (参加者) ride along even when the head segment is
    // itself linked (参加 is) — merging beats the component-only view
    if (seg.compound) {
      for (const opt of seg.compound.options) {
        words.add(opt.surface)
        if (opt.reading) readings.set(opt.surface, opt.reading)
      }
    }
    // counter positions linked to a non-counter entry (146本 → "book"):
    // query the ext index — a real counter entry (名/めい) beats the noun
    if (seg.token.counter && seg.word?.counterUse) {
      words.add(seg.text)
      counters.add(seg.text)
      if (seg.token.reading) readings.set(seg.text, seg.token.reading)
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
    if (seg.token.counter) counters.add(seg.text)
    const target = seg.token.pos === 'verb' ? verbs : words
    const isKatakana = KATAKANA_ONLY.test(seg.text)
    for (const cand of beyondCandidates(seg)) {
      target.add(cand)
      // イチョウ queries its reading いちょう too — a katakana spelling
      // signals the kana-native homograph (ginkgo), not 胃腸
      if (isKatakana && cand !== seg.text) kanaNative.add(cand)
    }
    if (seg.token.pos !== 'verb' && !seg.token.baseForm && seg.token.reading) {
      readings.set(seg.text, seg.token.reading)
    }
  }
  return { verbs, words, readings, counters, kanaNative }
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

/**
 * Homograph alternatives from the ext lookup's per-surface row lists —
 * reading-consistent rows only, minus the chosen entry (胃腸/医長 for a
 * surface linked to the ginkgo いちょう).
 */
function extAlternatives(
  cand: string,
  surface: string,
  chosenId: string,
  reading: string | undefined,
  pool: Map<string, VocabEntry[]> | undefined,
): ParsedWord[] | undefined {
  const rows = pool?.get(cand)
  if (!rows) return undefined
  const out: ParsedWord[] = []
  for (const e of rows) {
    if (e.id === chosenId || !entryReadsAs(e, reading)) continue
    out.push({ entry: e, isVerb: false, surface, formLabel: null })
    if (out.length === MAX_ALTERNATIVES) break
  }
  return out.length > 0 ? out : undefined
}

/** Attaches extended-tier entries (jlpt 0 → "Beyond" badge) to the misses. */
export function linkBeyondWords(
  segments: ParsedSegment[],
  verbEntries: Map<string, VerbEntry>,
  vocabEntries: Map<string, VocabEntry>,
  vocabAlternates?: Map<string, VocabEntry[]>,
): ParsedSegment[] {
  const linkOne = (seg: ParsedSegment): ParsedSegment => {
    // counter positions (146本): a real counter entry written as this
    // surface (名/めい "counter for people") beats the standalone noun —
    // the noun is demoted to the first alternative. With no counter entry
    // anywhere (本 keeps its N5 "book" JMdict id, so the ext tier has no
    // row for it), the noun link stands with `counterUse` explaining the
    // usage and any ext homographs attached as alternatives.
    if (seg.token?.counter && seg.word?.counterUse) {
      const reading = seg.token.reading
      const better = vocabEntries.get(seg.text)
      if (
        better &&
        better.pos === 'counter' &&
        entryReadsAs(better, reading) &&
        (better.kanji === seg.text || better.kanji === better.kana)
      ) {
        const demoted: ParsedWord = {
          entry: seg.word.entry,
          isVerb: seg.word.isVerb,
          surface: seg.text,
          formLabel: null,
        }
        const alts = mergeAlternatives(
          [demoted],
          extAlternatives(seg.text, seg.text, better.id, reading, vocabAlternates),
        )
        return {
          ...seg,
          word: {
            entry: better,
            isVerb: false,
            surface: seg.text,
            formLabel: null,
            ...(alts && { alternatives: alts }),
          },
        }
      }
      const alts = mergeAlternatives(
        seg.word.alternatives,
        extAlternatives(seg.text, seg.text, seg.word.entry.id, reading, vocabAlternates),
      )
      if (alts && alts !== seg.word.alternatives) {
        return { ...seg, word: { ...seg.word, alternatives: alts } }
      }
      return seg
    }
    // wrong-reading repair: swap the link only when a Beyond entry actually
    // reads the way kuromoji says — otherwise the closest match stands.
    // Same written-form gate as linkToken's swap: the ext lookup matches
    // rows by kana too, so the めい query for 名 can hand back 姪 "niece" —
    // an entry may only replace the link if it's written as this surface
    // or is kana-native. The kanji pins the word (decisions 52/55).
    const misread = seg.token ? misreadLink(seg) : undefined
    if (misread) {
      for (const cand of [seg.text, misread]) {
        const better = vocabEntries.get(cand)
        if (
          better &&
          entryReadsAs(better, misread) &&
          (better.kanji === seg.text || better.kanji === better.kana)
        ) {
          // the displaced entry is still a plausible reading of this
          // written form — keep it reachable, plus any ext homographs
          const demoted: ParsedWord = {
            entry: seg.word!.entry,
            isVerb: seg.word!.isVerb,
            surface: seg.text,
            formLabel: null,
          }
          const alts = mergeAlternatives(
            [demoted],
            extAlternatives(cand, seg.text, better.id, misread, vocabAlternates),
          )
          return {
            ...seg,
            word: {
              entry: better,
              isVerb: false,
              surface: seg.text,
              formLabel: null,
              ...(alts && { alternatives: alts }),
            },
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
    let hitCand: string | undefined
    for (const cand of beyondCandidates(seg)) {
      const e = vocabEntries.get(cand)
      if (e && entryReadsAs(e, wantReading)) {
        entry = e
        hitCand = cand
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
    // the other ext entries sharing the matched surface (胃腸/医長 next to
    // the ginkgo いちょう) — the reading can't tell them apart, the reader can
    const alts = inflected
      ? undefined
      : extAlternatives(hitCand!, seg.text, entry.id, wantReading, vocabAlternates)
    return {
      ...seg,
      word: {
        entry,
        isVerb: false,
        surface: seg.text,
        formLabel,
        ...(alts && { alternatives: alts }),
      },
    }
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
