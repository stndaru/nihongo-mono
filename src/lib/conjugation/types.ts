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
}

export const FORM_LABELS: Record<ConjugationForm, FormLabel> = {
  'non-past': { label: 'Non-past', ja: '辞書形', hint: 'do / will do' },
  'non-past-polite': { label: 'Non-past polite', ja: 'ます形', hint: 'do (polite)' },
  negative: { label: 'Negative', ja: 'ない形', hint: "don't / won't" },
  'negative-polite': { label: 'Negative polite', ja: 'ません', hint: "don't (polite)" },
  past: { label: 'Past', ja: 'た形', hint: 'did' },
  'past-polite': { label: 'Past polite', ja: 'ました', hint: 'did (polite)' },
  'past-negative': { label: 'Past negative', ja: 'なかった', hint: "didn't" },
  'past-negative-polite': {
    label: 'Past negative polite',
    ja: 'ませんでした',
    hint: "didn't (polite)",
  },
  te: { label: 'Te form', ja: 'て形', hint: 'doing / and…' },
  'te-negative': { label: 'Negative te', ja: 'なくて', hint: 'not doing, so…' },
  stem: { label: 'Stem', ja: '連用形', hint: 'masu stem' },
  potential: { label: 'Potential', ja: '可能形', hint: 'can do' },
  passive: { label: 'Passive', ja: '受身形', hint: 'is done (to me)' },
  causative: { label: 'Causative', ja: '使役形', hint: 'make / let do' },
  'causative-passive': {
    label: 'Causative-passive',
    ja: '使役受身形',
    hint: 'is made to do',
  },
  volitional: { label: 'Volitional', ja: '意向形', hint: "let's / shall" },
  'volitional-polite': { label: 'Volitional polite', ja: 'ましょう', hint: "let's (polite)" },
  imperative: { label: 'Imperative', ja: '命令形', hint: 'do it!' },
  prohibitive: { label: 'Prohibitive', ja: '禁止形', hint: "don't do it!" },
  'conditional-ba': { label: 'Conditional ば', ja: 'ば形', hint: 'if one does' },
  'conditional-tara': { label: 'Conditional たら', ja: 'たら形', hint: 'if/when one does' },
  tai: { label: 'Desire', ja: 'たい形', hint: 'want to do' },
}

/** Display grouping used by the detail page's conjugation table and quiz setup. */
export const FORM_GROUPS: readonly { label: string; forms: readonly ConjugationForm[] }[] = [
  { label: 'Basic', forms: ['non-past', 'non-past-polite', 'negative', 'negative-polite'] },
  { label: 'Past', forms: ['past', 'past-polite', 'past-negative', 'past-negative-polite'] },
  { label: 'Te form & stem', forms: ['te', 'te-negative', 'stem'] },
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
