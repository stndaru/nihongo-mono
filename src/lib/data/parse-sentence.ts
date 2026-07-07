/**
 * Dictionary-driven sentence breakdown for the /parser page. This is NOT a
 * real morphological analyzer (kuromoji stays build-time only — its IPADIC
 * dictionary is a ~17 MB download): it's greedy longest-match segmentation
 * over the JLPT word lists, with `deconjugate` recovering dictionary forms
 * of conjugated verbs/い-adjectives and the conjugation engines naming the
 * exact form. Heuristic by design — the page carries an accuracy caveat.
 */
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

export interface ParsedSegment {
  text: string
  /** present when this run of text matched a dictionary word */
  word?: ParsedWord
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

export function buildParserDicts(verbs: VerbEntry[], vocab: VocabEntry[]): ParserDicts {
  const lookup = new Map<string, DictHit>()
  const verbMap = new Map<string, VerbEntry>()
  const adjMap = new Map<string, VocabEntry>()
  for (const entry of vocab) {
    const hit = { entry, isVerb: false }
    if (entry.kanji) lookup.set(entry.kanji, hit)
    if (entry.kana) lookup.set(entry.kana, hit)
    if (entry.pos === 'adj-i') {
      if (entry.kanji) adjMap.set(entry.kanji, entry)
      if (entry.kana) adjMap.set(entry.kana, entry)
    }
  }
  // verbs second so a surface that is both (勉強する) resolves to the verb
  for (const entry of verbs) {
    const hit = { entry, isVerb: true }
    if (entry.kanji) lookup.set(entry.kanji, hit)
    if (entry.kana) lookup.set(entry.kana, hit)
    if (entry.kanji) verbMap.set(entry.kanji, entry)
    if (entry.kana) verbMap.set(entry.kana, entry)
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
