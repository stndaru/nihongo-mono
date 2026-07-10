/**
 * Verb classes, matching JMdict part-of-speech tags verbatim so the data
 * pipeline needs no mapping table.
 */
export type GodanClass =
  | 'v5u' // 買う
  | 'v5u-s' // 問う・請う (te/ta: 問うて・問うた)
  | 'v5k' // 書く
  | 'v5k-s' // 行く (te/ta: 行って・行った)
  | 'v5g' // 泳ぐ
  | 'v5s' // 話す
  | 'v5t' // 待つ
  | 'v5n' // 死ぬ
  | 'v5b' // 遊ぶ
  | 'v5m' // 読む
  | 'v5r' // 帰る
  | 'v5r-i' // ある (negative: ない)
  | 'v5aru' // くださる・なさる etc. (stem: ください)

export type VerbClass =
  | GodanClass
  | 'v1' // 食べる
  | 'v1-s' // くれる (imperative: くれ)
  | 'vs' // する / N+する
  | 'vk' // 来る

export type ClassGroup = 'godan' | 'ichidan' | 'suru' | 'kuru'

export function classGroup(cls: VerbClass): ClassGroup {
  if (cls === 'vs') return 'suru'
  if (cls === 'vk') return 'kuru'
  if (cls === 'v1' || cls === 'v1-s') return 'ichidan'
  return 'godan'
}

export type ConjugationForm =
  | 'non-past'
  | 'non-past-polite'
  | 'negative'
  | 'negative-polite'
  | 'past'
  | 'past-polite'
  | 'past-negative'
  | 'past-negative-polite'
  | 'te'
  | 'te-negative'
  | 'te-negative-naide'
  | 'stem'
  | 'potential'
  | 'passive'
  | 'causative'
  | 'causative-passive'
  | 'volitional'
  | 'volitional-polite'
  | 'imperative'
  | 'prohibitive'
  | 'conditional-ba'
  | 'conditional-tara'
  | 'tai'

/** Minimum shape the engine needs; VerbEntry from the dataset satisfies it. */
export interface ConjugatableVerb {
  kanji: string
  kana: string
  class: VerbClass
}

export interface ConjugatedForm {
  kanji: string
  kana: string
}

export const CONJUGATION_FORMS: readonly ConjugationForm[] = [
  'non-past',
  'non-past-polite',
  'negative',
  'negative-polite',
  'past',
  'past-polite',
  'past-negative',
  'past-negative-polite',
  'te',
  'te-negative',
  'te-negative-naide',
  'stem',
  'potential',
  'passive',
  'causative',
  'causative-passive',
  'volitional',
  'volitional-polite',
  'imperative',
  'prohibitive',
  'conditional-ba',
  'conditional-tara',
  'tai',
] as const

export interface FormLabel {
  /** English label, e.g. "Negative" */
  label: string
  /** Japanese grammar name, e.g. ない形 */
  ja: string
  /** Short hint of the meaning, e.g. "don't / won't" */
  hint: string
  /** A sentence on when/why the form is used. */
  usage: string
}

export const FORM_LABELS: Record<ConjugationForm, FormLabel> = {
  'non-past': {
    label: 'Non-past',
    ja: '辞書形',
    hint: 'do / will do',
    usage:
      'The plain present/future tense — "I eat", "I will eat". Also the form found in dictionaries and used before nouns (食べる人).',
  },
  'non-past-polite': {
    label: 'Non-past polite',
    ja: 'ます形',
    hint: 'do (polite)',
    usage:
      'The standard polite present/future, used with strangers, colleagues, and in most everyday adult conversation.',
  },
  negative: {
    label: 'Negative',
    ja: 'ない形',
    hint: "don't / won't",
    usage:
      'Plain "don\'t / won\'t" for casual speech. Also the base for many patterns such as 〜ないで and 〜なければならない.',
  },
  'negative-polite': {
    label: 'Negative polite',
    ja: 'ません',
    hint: "don't (polite)",
    usage: 'Polite "don\'t / won\'t" — the ます-form counterpart of ない.',
  },
  past: {
    label: 'Past',
    ja: 'た形',
    hint: 'did',
    usage:
      'Plain past — "ate", "went". Casual speech, and the base for たら conditionals and 〜たことがある (have done before).',
  },
  'past-polite': {
    label: 'Past polite',
    ja: 'ました',
    hint: 'did (polite)',
    usage: 'Polite past for everyday adult conversation.',
  },
  'past-negative': {
    label: 'Past negative',
    ja: 'なかった',
    hint: "didn't",
    usage: 'Plain "didn\'t". Conjugates like an い-adjective in the past (〜なかった).',
  },
  'past-negative-polite': {
    label: 'Past negative polite',
    ja: 'ませんでした',
    hint: "didn't (polite)",
    usage: 'Polite "didn\'t" — ません plus でした.',
  },
  te: {
    label: 'Te form',
    ja: 'て形',
    hint: 'doing / and…',
    usage:
      'The connector form: linking actions (食べて行く), requests (〜てください), ongoing states (〜ている), and permission (〜てもいい). Probably the most useful form to master.',
  },
  // The two negative te connectors are separate forms so the whole app —
  // detail tables, cheatsheets, quiz — teaches the なくて/ないで split the
  // same way. The id 'te-negative' keeps meaning なくて: stored progress
  // and shared quiz URLs predate the split and must stay valid.
  'te-negative': {
    label: 'Negative te なくて',
    ja: 'なくて',
    hint: 'not doing, so…',
    usage:
      '"Not doing so, (so)…" — links a negative clause as a cause or contrast: 朝ご飯を食べなくて、お腹が空いた ("didn\'t eat, so I\'m hungry"). For "without doing so", use the ないで form.',
  },
  'te-negative-naide': {
    label: 'Negative te ないで',
    ja: 'ないで',
    hint: 'without doing so',
    usage:
      '"Without doing so" — the skipped action accompanies the main verb: 朝ご飯を食べないで出かけた ("went out without eating"). Also the base of negative requests (〜ないでください). For a cause or contrast, use なくて.',
  },
  stem: {
    label: 'Stem',
    ja: '連用形',
    hint: 'masu stem',
    usage:
      'The base that ます attaches to. Also combines with other verbs (食べに行く, 書き始める) and stands alone in formal writing.',
  },
  potential: {
    label: 'Potential',
    ja: '可能形',
    hint: 'can do',
    usage:
      'Expresses ability or possibility — "can eat", "can go". The object usually takes が rather than を (寿司が食べられる).',
  },
  passive: {
    label: 'Passive',
    ja: '受身形',
    hint: 'is done (to me)',
    usage:
      '"Was done (to someone)" — often with a nuance of being affected (雨に降られた). The same shape is also used as respectful language.',
  },
  causative: {
    label: 'Causative',
    ja: '使役形',
    hint: 'make / let do',
    usage:
      '"Make or let someone do" — 食べさせる can mean forcing or permitting; context and particles (に/を) decide.',
  },
  'causative-passive': {
    label: 'Causative-passive',
    ja: '使役受身形',
    hint: 'is made to do',
    usage:
      '"Was made to do" — being forced against one\'s will: 野菜を食べさせられた "I was made to eat vegetables".',
  },
  volitional: {
    label: 'Volitional',
    ja: '意向形',
    hint: "let's / shall",
    usage:
      '"Let\'s…" in casual speech (行こう), or intention when paired with と思う (行こうと思う "I think I\'ll go").',
  },
  'volitional-polite': {
    label: 'Volitional polite',
    ja: 'ましょう',
    hint: "let's (polite)",
    usage: 'The polite "let\'s…" — 行きましょう. Also offers help: 手伝いましょうか.',
  },
  imperative: {
    label: 'Imperative',
    ja: '命令形',
    hint: 'do it!',
    usage:
      'For blunt, direct commands — sports coaching (頑張れ), drill sergeants, warning signs, or shouted in anger. Too abrupt for daily use; for polite requests, use 〜てください (built from the te-form) instead.',
  },
  prohibitive: {
    label: 'Prohibitive',
    ja: '禁止形',
    hint: "don't do it!",
    usage:
      'A blunt "don\'t do that!" — 行くな. Strong language, mostly heard in fiction, from angry speakers, or on warning signs.',
  },
  'conditional-ba': {
    label: 'Conditional ば',
    ja: 'ば形',
    hint: 'if one does',
    usage:
      '"If X, then Y" — a neutral, logical condition: 食べれば "if (you) eat". Common in proverbs and general truths.',
  },
  'conditional-tara': {
    label: 'Conditional たら',
    ja: 'たら形',
    hint: 'if/when one does',
    usage:
      'The most conversational "if/when": 食べたら "if/when (you) eat". Also sequences events — "after doing X".',
  },
  tai: {
    label: 'Desire',
    ja: 'たい形',
    hint: 'want to do',
    usage:
      '"Want to do" — 食べたい. Conjugates like an い-adjective; for someone else\'s desires use 〜たがる.',
  },
}

/** Forms built on ます (formal register). */
export const POLITE_FORMS: ReadonlySet<ConjugationForm> = new Set([
  'non-past-polite',
  'negative-polite',
  'past-polite',
  'past-negative-polite',
  'volitional-polite',
])

/** Forms expressing negation (ない/ません family). */
export const NEGATIVE_FORMS: ReadonlySet<ConjugationForm> = new Set([
  'negative',
  'negative-polite',
  'past-negative',
  'past-negative-polite',
  'te-negative',
  'te-negative-naide',
])

/** Display grouping used by the detail page's conjugation table and quiz setup. */
export const FORM_GROUPS: readonly { label: string; forms: readonly ConjugationForm[] }[] = [
  { label: 'Basic', forms: ['non-past', 'non-past-polite', 'negative', 'negative-polite'] },
  { label: 'Past', forms: ['past', 'past-polite', 'past-negative', 'past-negative-polite'] },
  { label: 'Te form & stem', forms: ['te', 'te-negative', 'te-negative-naide', 'stem'] },
  {
    label: 'Potential, passive & causative',
    forms: ['potential', 'passive', 'causative', 'causative-passive'],
  },
  {
    label: 'Volitional & commands',
    forms: ['volitional', 'volitional-polite', 'imperative', 'prohibitive'],
  },
  { label: 'Conditional & desire', forms: ['conditional-ba', 'conditional-tara', 'tai'] },
] as const

export const CLASS_LABELS: Record<VerbClass, string> = {
  v5u: 'Godan -u',
  'v5u-s': 'Godan -u (問う)',
  v5k: 'Godan -ku',
  'v5k-s': 'Godan -ku (行く)',
  v5g: 'Godan -gu',
  v5s: 'Godan -su',
  v5t: 'Godan -tsu',
  v5n: 'Godan -nu',
  v5b: 'Godan -bu',
  v5m: 'Godan -mu',
  v5r: 'Godan -ru',
  'v5r-i': 'Godan -ru (ある)',
  v5aru: 'Godan honorific',
  v1: 'Ichidan',
  'v1-s': 'Ichidan (くれる)',
  vs: 'する verb',
  vk: '来る verb',
}
