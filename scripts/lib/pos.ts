/** Shared part-of-speech classification for the vocab build scripts. */
import type { VerbClass } from '../../src/lib/conjugation'
import type { VocabPos } from '../../src/lib/data/types'
import type { JmdictWord } from './jmdict'

/** Verb classes the conjugation engine supports — these go to the verbs dataset. */
export const VERB_CLASSES: ReadonlySet<string> = new Set([
  'v5u', 'v5u-s', 'v5k', 'v5k-s', 'v5g', 'v5s', 'v5t', 'v5n', 'v5b', 'v5m',
  'v5r', 'v5r-i', 'v5aru', 'v1', 'v1-s', 'vk',
] satisfies VerbClass[])

/**
 * Verb-like classes the engine can't conjugate (archaic 二段/四段, す-verbs…).
 * They still deserve dictionary entries, so they land in vocab as pos 'verb'.
 */
export const UNSUPPORTED_VERB_CLASSES: ReadonlySet<string> = new Set([
  'vs-s', 'vs-c', 'vn', 'vr', 'vz', 'v5uru', 'v-unspec',
  'v4r', 'v4h', 'v4k', 'v4s', 'v4t', 'v4b', 'v4m', 'v4g', 'v4n',
  'v2a-s', 'v2b-k', 'v2b-s', 'v2d-k', 'v2d-s', 'v2g-k', 'v2g-s', 'v2h-k',
  'v2h-s', 'v2k-k', 'v2k-s', 'v2m-k', 'v2m-s', 'v2n-s', 'v2r-k', 'v2r-s',
  'v2s-s', 'v2t-k', 'v2t-s', 'v2w-s', 'v2y-k', 'v2y-s', 'v2z-s',
])

/** JMdict PoS tag → our vocab category. Supported verb classes are absent on purpose. */
export const POS_MAP = new Map<string, VocabPos>([
  ['adj-i', 'adj-i'],
  ['adj-ix', 'adj-i'], // よい/いい special class
  ['adj-na', 'adj-na'],
  ['n', 'noun'],
  ['n-t', 'noun'], // temporal nouns (今日, 毎朝…)
  ['n-adv', 'noun'],
  ['adj-no', 'noun'], // の-adjectives are grammatically nouns
  ['adv', 'adverb'],
  ['adv-to', 'adverb'],
  ['exp', 'expression'],
  ['int', 'interjection'],
  ['pn', 'pronoun'],
  ['prt', 'particle'],
  ['conj', 'conjunction'],
  ['ctr', 'counter'],
  ['num', 'counter'],
  ['pref', 'prefix'],
  ['n-pref', 'prefix'],
  ['suf', 'suffix'],
  ['n-suf', 'suffix'],
  ['adj-pn', 'other'], // pre-noun adnominals (この, 大きな)
  ['adj-t', 'other'], // タル-adjectives (堂々) — no な-inflection
  ['adj-nari', 'other'],
  ['adj-f', 'other'],
  ['aux', 'other'],
  ['aux-v', 'other'],
  ['aux-adj', 'other'],
  ['cop', 'other'],
  ['unc', 'other'],
])

/**
 * Picks the word's category from the first sense that has any mapped tag,
 * respecting THAT SENSE's own tag order — JMdict lists tags by significance,
 * so 黄色 ["n","adj-no","adj-na"] is a noun while 綺麗 ["adj-na"] is an
 * adjective. A fixed precedence over the map got 黄色/大人 wrong.
 * Unsupported verb classes classify as 'verb' so archaic verbs still exist
 * somewhere; supported classes return undefined (they live in the verbs
 * dataset instead).
 */
export function classifyPos(word: JmdictWord): VocabPos | undefined {
  for (const sense of word.sense) {
    for (const tag of sense.partOfSpeech) {
      const pos = POS_MAP.get(tag)
      if (pos) return pos
      if (UNSUPPORTED_VERB_CLASSES.has(tag)) return 'verb'
    }
  }
  return undefined
}

/** The JMdict tags that map to the given category (for sense filtering). */
export function tagsOfPos(pos: VocabPos): Set<string> {
  const tags = new Set([...POS_MAP.entries()].filter(([, cat]) => cat === pos).map(([tag]) => tag))
  if (pos === 'verb') {
    for (const t of UNSUPPORTED_VERB_CLASSES) tags.add(t)
  }
  return tags
}
