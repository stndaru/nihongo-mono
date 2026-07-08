/**
 * Kana generator for counter counting sequences (the cheatsheet's
 * per-counter expansions). Composes kango number readings with the
 * counter's sound-change class:
 *
 * - 'k' / 's' / 't':  gemination — いっ/はっ/じゅっ (+ろっ/ひゃっ for k)
 * - 'hb': h-row counter that hardens to p on 1/6/8/10/100 and softens
 *         to b on 3 (本 → さんぼん, 匹 → さんびき)
 * - 'hp': h-row counter that hardens to p after every ん or っ — 3 and 4
 *         included, never b (分 → さんぷん・よんぷん, 歩 → さんぽ)
 * - 'none': plain concatenation
 *
 * Counters whose everyday counting is wago (ひと皿, ひと口…) or
 * calendar-bound (日・月・時) don't get a rule — the UI simply offers no
 * expansion for them.
 */

export type SoundClass = 'k' | 's' | 't' | 'hb' | 'hp' | 'none'

export interface CounterRule {
  /** base counter reading, e.g. ほん */
  kana: string
  cls: SoundClass
  /** reading of 4 as a final unit (default よん; 人・時間・年 use よ) */
  four?: string
  /** reading of 7 as a final unit (default なな) */
  seven?: string
  /** reading of 9 as a final unit (default きゅう) */
  nine?: string
  /** full-reading overrides, e.g. 1人 → ひとり, 20歳 → はたち */
  special?: Record<number, string>
}

/** the numbers each expansion shows: 1–25, then 30, 50, 70, 100 */
export const COUNT_SEQUENCE: number[] = [
  ...Array.from({ length: 25 }, (_, i) => i + 1),
  30,
  50,
  70,
  100,
]

const P_MAP: Record<string, string> = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' }
const B_MAP: Record<string, string> = { は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' }

const toP = (kana: string) => (P_MAP[kana[0]] ?? kana[0]) + kana.slice(1)
const toB = (kana: string) => (B_MAP[kana[0]] ?? kana[0]) + kana.slice(1)

/** classes that geminate a numeral, per numeral */
const GEMINATES: Record<SoundClass, number[]> = {
  k: [1, 6, 8, 10, 100],
  s: [1, 8, 10],
  t: [1, 8, 10],
  hb: [1, 6, 8, 10, 100],
  hp: [1, 6, 8, 10, 100],
  none: [],
}

/** geminated readings of the finals that can geminate */
const GEMINATED: Record<number, string> = { 1: 'いっ', 6: 'ろっ', 8: 'はっ', 100: 'ひゃっ' }

function unitKana(n: number, rule: CounterRule): string {
  switch (n) {
    case 1: return 'いち'
    case 2: return 'に'
    case 3: return 'さん'
    case 4: return rule.four ?? 'よん'
    case 5: return 'ご'
    case 6: return 'ろく'
    case 7: return rule.seven ?? 'なな'
    case 8: return 'はち'
    case 9: return rule.nine ?? 'きゅう'
    default: return ''
  }
}

/** tens prefix always uses the standard readings (40 = よんじゅう) */
const TENS: Record<number, string> = {
  2: 'に', 3: 'さん', 4: 'よん', 5: 'ご', 6: 'ろく', 7: 'なな', 8: 'はち', 9: 'きゅう',
}

/**
 * Count `n` with the counter rule — returns the full kana reading,
 * e.g. countWith(HON, 21) → にじゅういっぽん.
 */
export function countWith(rule: CounterRule, n: number): string {
  const override = rule.special?.[n]
  if (override) return override

  if (n === 100) {
    const geminates = GEMINATES[rule.cls].includes(100)
    const counter = rule.cls === 'hb' || rule.cls === 'hp' ? (geminates ? toP(rule.kana) : rule.kana) : rule.kana
    return (geminates ? 'ひゃっ' : 'ひゃく') + counter
  }

  const tens = Math.floor(n / 10)
  const unit = n % 10
  const tensPrefix = tens > 0 ? (TENS[tens] ?? '') + 'じゅう' : ''

  if (unit === 0) {
    // final component is じゅう itself (10, 30, 50…)
    if (GEMINATES[rule.cls].includes(10)) {
      const counter = rule.cls === 'hb' || rule.cls === 'hp' ? toP(rule.kana) : rule.kana
      return tensPrefix.slice(0, -3) + 'じゅっ' + counter
    }
    return tensPrefix + rule.kana
  }

  let unitPart = unitKana(unit, rule)
  let counter = rule.kana
  if (GEMINATES[rule.cls].includes(unit)) {
    unitPart = GEMINATED[unit]
    if (rule.cls === 'hb' || rule.cls === 'hp') counter = toP(counter)
  } else if (rule.cls === 'hb' && unit === 3) {
    counter = toB(counter)
  } else if (rule.cls === 'hp' && unitPart.endsWith('ん')) {
    counter = toP(counter)
  }
  return tensPrefix + unitPart + counter
}
