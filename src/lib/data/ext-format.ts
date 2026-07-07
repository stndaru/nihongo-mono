import type { VerbEntry, VocabPos } from './types'

/**
 * Wire format of the extended-tier index rows (public/data/…/index.json).
 * Shared by scripts/build-extended.ts (writer) and the app (reader), so the
 * two can never drift. Everything here exists to keep a ~200k-row file small:
 * numeric ids, short part-of-speech codes, and a hiragana key only when it
 * differs from the reading (katakana words).
 */

export const POS_TO_CODE: Record<VocabPos, string> = {
  noun: 'n',
  'adj-i': 'ai',
  'adj-na': 'an',
  adverb: 'av',
  expression: 'ex',
  interjection: 'in',
  pronoun: 'pn',
  particle: 'pt',
  conjunction: 'cj',
  counter: 'ct',
  prefix: 'pf',
  suffix: 'sf',
  verb: 'vb',
  other: 'ot',
}

export const CODE_TO_POS: Record<string, VocabPos> = Object.fromEntries(
  Object.entries(POS_TO_CODE).map(([pos, code]) => [code, pos as VocabPos]),
)

export const TRANS_TO_CODE: Record<string, string> = { vt: 't', vi: 'i', both: 'b' }

export const CODE_TO_TRANS: Record<string, VerbEntry['transitivity']> = {
  t: 'vt',
  i: 'vi',
  b: 'both',
}

/** List/search rows never need more meaning than this; details come from shards. */
export const INDEX_GLOSS_MAX = 80
