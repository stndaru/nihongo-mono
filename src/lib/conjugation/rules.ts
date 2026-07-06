import { GODAN_ENDINGS, godanSuffix } from './godan'
import {
  classGroup,
  FORM_LABELS,
  type ClassGroup,
  type ConjugationForm,
  type GodanClass,
  type VerbClass,
} from './types'

export interface RuleCard {
  form: ConjugationForm
  group: ClassGroup
  /** e.g. "Negative — Godan verbs" */
  title: string
  /** e.g. "〜く → 〜かない" */
  pattern: string
  explanation: string
  exceptions?: string
}

const GROUP_TITLES: Record<ClassGroup, string> = {
  godan: 'Godan (u-verbs)',
  ichidan: 'Ichidan (ru-verbs)',
  suru: 'する verbs',
  kuru: '来る',
}

/** How to build the form, phrased for the whole class group. */
const EXPLANATIONS: Record<ConjugationForm, Record<ClassGroup, string>> = {
  'non-past': {
    godan: 'The dictionary form itself — used for present and future in plain speech.',
    ichidan: 'The dictionary form itself — used for present and future in plain speech.',
    suru: 'The dictionary form itself — used for present and future in plain speech.',
    kuru: 'The dictionary form itself — used for present and future in plain speech.',
  },
  'non-past-polite': {
    godan: 'Change the final -u sound to its -i row sound, then add ます.',
    ichidan: 'Drop る and add ます.',
    suru: 'する becomes します (stem し + ます).',
    kuru: '来る becomes 来ます, read きます (stem き + ます).',
  },
  negative: {
    godan: 'Change the final -u sound to its -a row sound, then add ない. Verbs ending in う take わ, not あ.',
    ichidan: 'Drop る and add ない.',
    suru: 'する becomes しない.',
    kuru: '来る becomes 来ない, read こない — the stem reading shifts to こ.',
  },
  'negative-polite': {
    godan: 'Make the masu stem (-i row sound) and add ません.',
    ichidan: 'Drop る and add ません.',
    suru: 'する becomes しません.',
    kuru: '来る becomes 来ません, read きません.',
  },
  past: {
    godan:
      'Use the euphonic (onbin) ending: う・つ・る → った / ぬ・ぶ・む → んだ / く → いた / ぐ → いだ / す → した.',
    ichidan: 'Drop る and add た.',
    suru: 'する becomes した.',
    kuru: '来る becomes 来た, read きた.',
  },
  'past-polite': {
    godan: 'Make the masu stem and add ました.',
    ichidan: 'Drop る and add ました.',
    suru: 'する becomes しました.',
    kuru: '来る becomes 来ました, read きました.',
  },
  'past-negative': {
    godan: 'Make the negative (-a row + ない), then replace ない with なかった.',
    ichidan: 'Drop る and add なかった.',
    suru: 'する becomes しなかった.',
    kuru: '来る becomes 来なかった, read こなかった.',
  },
  'past-negative-polite': {
    godan: 'Make the masu stem and add ませんでした.',
    ichidan: 'Drop る and add ませんでした.',
    suru: 'する becomes しませんでした.',
    kuru: '来る becomes 来ませんでした, read きませんでした.',
  },
  te: {
    godan:
      'Same sound changes as the past tense, ending in て/で instead of た/だ: う・つ・る → って / ぬ・ぶ・む → んで / く → いて / ぐ → いで / す → して.',
    ichidan: 'Drop る and add て.',
    suru: 'する becomes して.',
    kuru: '来る becomes 来て, read きて.',
  },
  'te-negative': {
    godan: 'Make the negative, then replace ない with なくて.',
    ichidan: 'Drop る and add なくて.',
    suru: 'する becomes しなくて.',
    kuru: '来る becomes 来なくて, read こなくて.',
  },
  stem: {
    godan: 'Change the final -u sound to its -i row sound. This is the stem ます attaches to.',
    ichidan: 'Just drop る.',
    suru: 'The stem of する is し.',
    kuru: 'The stem of 来る is 来, read き.',
  },
  potential: {
    godan: 'Change the final -u sound to its -e row sound and add る. Potential verbs conjugate as ichidan.',
    ichidan: 'Drop る and add られる.',
    suru: 'する has no regular potential — use the separate verb できる.',
    kuru: '来る becomes 来られる, read こられる.',
  },
  passive: {
    godan: 'Change the final -u sound to its -a row sound and add れる.',
    ichidan: 'Drop る and add られる — identical to the potential; context disambiguates.',
    suru: 'する becomes される.',
    kuru: '来る becomes 来られる, read こられる.',
  },
  causative: {
    godan: 'Change the final -u sound to its -a row sound and add せる.',
    ichidan: 'Drop る and add させる.',
    suru: 'する becomes させる.',
    kuru: '来る becomes 来させる, read こさせる.',
  },
  'causative-passive': {
    godan: 'Change the final -u sound to its -a row sound and add せられる.',
    ichidan: 'Drop る and add させられる.',
    suru: 'する becomes させられる.',
    kuru: '来る becomes 来させられる, read こさせられる.',
  },
  volitional: {
    godan: 'Change the final -u sound to its -o row sound and add う.',
    ichidan: 'Drop る and add よう.',
    suru: 'する becomes しよう.',
    kuru: '来る becomes 来よう, read こよう.',
  },
  'volitional-polite': {
    godan: 'Make the masu stem and add ましょう.',
    ichidan: 'Drop る and add ましょう.',
    suru: 'する becomes しましょう.',
    kuru: '来る becomes 来ましょう, read きましょう.',
  },
  imperative: {
    godan: 'Change the final -u sound to its -e row sound. Blunt — used in commands, signs, and set phrases.',
    ichidan: 'Drop る and add ろ.',
    suru: 'する becomes しろ.',
    kuru: '来る becomes 来い, read こい.',
  },
  prohibitive: {
    godan: 'Add な directly after the dictionary form.',
    ichidan: 'Add な directly after the dictionary form.',
    suru: 'する becomes するな.',
    kuru: '来る becomes 来るな, read くるな.',
  },
  'conditional-ba': {
    godan: 'Change the final -u sound to its -e row sound and add ば.',
    ichidan: 'Drop る and add れば.',
    suru: 'する becomes すれば.',
    kuru: '来る becomes 来れば, read くれば.',
  },
  'conditional-tara': {
    godan: 'Make the past tense and add ら.',
    ichidan: 'Drop る and add たら.',
    suru: 'する becomes したら.',
    kuru: '来る becomes 来たら, read きたら.',
  },
  tai: {
    godan: 'Make the masu stem and add たい. たい forms conjugate like i-adjectives.',
    ichidan: 'Drop る and add たい.',
    suru: 'する becomes したい.',
    kuru: '来る becomes 来たい, read きたい.',
  },
}

const EXCEPTIONS: Partial<Record<ConjugationForm, Partial<Record<ClassGroup, string>>>> = {
  negative: {
    godan: 'ある → ない (never あらない).',
  },
  'past-negative': {
    godan: 'ある → なかった.',
  },
  te: {
    godan: '行く → 行って (not 行いて). 問う・請う → 問うて・請うて.',
  },
  past: {
    godan: '行く → 行った (not 行いた). 問う・請う → 問うた・請うた.',
  },
  'te-negative': {
    godan:
      'ある → なくて. Use 〜ないで instead of 〜なくて for "without doing" and requests (行かないで).',
    ichidan: 'Use 〜ないで instead of 〜なくて for "without doing" and requests (食べないで).',
    suru: 'Use 〜ないで instead of 〜なくて for "without doing" and requests (しないで).',
    kuru: 'Use 〜ないで instead of 〜なくて for "without doing" and requests (来ないで).',
  },
  potential: {
    ichidan: 'Colloquial speech often drops ら (ら抜き): 食べれる — the standard form is 食べられる.',
    godan: 'ある has no potential form.',
  },
  'causative-passive': {
    godan: 'A shorter される form is common in speech (書かされる) — but never for verbs ending in す.',
  },
  imperative: {
    ichidan: 'くれる → くれ.',
    godan: 'Honorific verbs use the い-stem instead: くださる → ください, なさる → なさい.',
  },
  'non-past-polite': {
    godan: 'Honorific verbs take an い-stem: くださる → くださいます, いらっしゃる → いらっしゃいます.',
  },
}

/** "〜く → 〜かない" for the specific godan row of this verb class. */
function godanPattern(cls: GodanClass, form: ConjugationForm): string {
  const suffix = godanSuffix(cls, form)
  if (suffix === null) return '—'
  return `〜${GODAN_ENDINGS[cls].dict} → 〜${suffix || '(stem)'}`
}

const ICHIDAN_PATTERNS: Record<ConjugationForm, string> = {
  'non-past': '〜る (unchanged)',
  'non-past-polite': '〜る → 〜ます',
  negative: '〜る → 〜ない',
  'negative-polite': '〜る → 〜ません',
  past: '〜る → 〜た',
  'past-polite': '〜る → 〜ました',
  'past-negative': '〜る → 〜なかった',
  'past-negative-polite': '〜る → 〜ませんでした',
  te: '〜る → 〜て',
  'te-negative': '〜る → 〜なくて',
  stem: '〜る → 〜',
  potential: '〜る → 〜られる',
  passive: '〜る → 〜られる',
  causative: '〜る → 〜させる',
  'causative-passive': '〜る → 〜させられる',
  volitional: '〜る → 〜よう',
  'volitional-polite': '〜る → 〜ましょう',
  imperative: '〜る → 〜ろ',
  prohibitive: '〜る → 〜るな',
  'conditional-ba': '〜る → 〜れば',
  'conditional-tara': '〜る → 〜たら',
  tai: '〜る → 〜たい',
}

const SURU_PATTERNS: Record<ConjugationForm, string> = {
  'non-past': 'する (unchanged)',
  'non-past-polite': 'する → します',
  negative: 'する → しない',
  'negative-polite': 'する → しません',
  past: 'する → した',
  'past-polite': 'する → しました',
  'past-negative': 'する → しなかった',
  'past-negative-polite': 'する → しませんでした',
  te: 'する → して',
  'te-negative': 'する → しなくて',
  stem: 'する → し',
  potential: 'する → できる',
  passive: 'する → される',
  causative: 'する → させる',
  'causative-passive': 'する → させられる',
  volitional: 'する → しよう',
  'volitional-polite': 'する → しましょう',
  imperative: 'する → しろ',
  prohibitive: 'する → するな',
  'conditional-ba': 'する → すれば',
  'conditional-tara': 'する → したら',
  tai: 'する → したい',
}

const KURU_PATTERNS: Record<ConjugationForm, string> = {
  'non-past': '来る（くる） (unchanged)',
  'non-past-polite': '来る → 来ます（きます）',
  negative: '来る → 来ない（こない）',
  'negative-polite': '来る → 来ません（きません）',
  past: '来る → 来た（きた）',
  'past-polite': '来る → 来ました（きました）',
  'past-negative': '来る → 来なかった（こなかった）',
  'past-negative-polite': '来る → 来ませんでした（きませんでした）',
  te: '来る → 来て（きて）',
  'te-negative': '来る → 来なくて（こなくて）',
  stem: '来る → 来（き）',
  potential: '来る → 来られる（こられる）',
  passive: '来る → 来られる（こられる）',
  causative: '来る → 来させる（こさせる）',
  'causative-passive': '来る → 来させられる（こさせられる）',
  volitional: '来る → 来よう（こよう）',
  'volitional-polite': '来る → 来ましょう（きましょう）',
  imperative: '来る → 来い（こい）',
  prohibitive: '来る → 来るな（くるな）',
  'conditional-ba': '来る → 来れば（くれば）',
  'conditional-tara': '来る → 来たら（きたら）',
  tai: '来る → 来たい（きたい）',
}

export function getRule(form: ConjugationForm, verbClass: VerbClass): RuleCard {
  const group = classGroup(verbClass)
  let pattern: string
  switch (group) {
    case 'godan':
      pattern = godanPattern(verbClass as GodanClass, form)
      break
    case 'ichidan':
      pattern = ICHIDAN_PATTERNS[form]
      break
    case 'suru':
      pattern = SURU_PATTERNS[form]
      break
    case 'kuru':
      pattern = KURU_PATTERNS[form]
      break
  }
  return {
    form,
    group,
    title: `${FORM_LABELS[form].label} — ${GROUP_TITLES[group]}`,
    pattern,
    explanation: EXPLANATIONS[form][group],
    exceptions: EXCEPTIONS[form]?.[group],
  }
}
