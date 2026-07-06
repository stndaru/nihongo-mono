import {
  CONJUGATION_FORMS,
  type ClassGroup,
  type ConjugationForm,
} from '@/lib/conjugation'
import type { JlptLevel } from '@/lib/data/types'

export type QuizMode = 'input' | 'choice'

export interface QuizConfig {
  levels: JlptLevel[]
  forms: ConjugationForm[]
  groups: ClassGroup[]
  modes: QuizMode[]
  length: number
}

export const QUIZ_LENGTHS = [10, 25, 50] as const

export const ALL_GROUPS: ClassGroup[] = ['godan', 'ichidan', 'suru', 'kuru']

/** Forms preselected in the setup UI — the everyday core. */
export const DEFAULT_FORMS: ConjugationForm[] = [
  'non-past-polite',
  'negative',
  'past',
  'past-negative',
  'te',
]

export const DEFAULT_CONFIG: QuizConfig = {
  levels: [5],
  forms: DEFAULT_FORMS,
  groups: ALL_GROUPS,
  modes: ['input', 'choice'],
  length: 10,
}

/** Compact query-string shape: /quiz/session?levels=5,4&forms=te,past&… */
export interface QuizSearch {
  levels: string
  forms: string
  groups: string
  modes: string
  length: number
}

export function serializeConfig(config: QuizConfig): QuizSearch {
  return {
    levels: config.levels.join(','),
    forms: config.forms.join(','),
    groups: config.groups.join(','),
    modes: config.modes.join(','),
    length: config.length,
  }
}

function parseList<T extends string>(
  raw: unknown,
  valid: readonly T[],
  fallback: T[],
): T[] {
  if (typeof raw !== 'string') return fallback
  const items = raw.split(',').filter((x): x is T => valid.includes(x as T))
  return items.length > 0 ? [...new Set(items)] : fallback
}

export function parseConfig(search: Record<string, unknown>): QuizConfig {
  const levels =
    typeof search.levels === 'string' && /^[1-5](,[1-5])*$/.test(search.levels)
      ? ([...new Set(search.levels.split(',').map(Number))] as JlptLevel[])
      : DEFAULT_CONFIG.levels
  const length = Number(search.length)
  return {
    levels,
    forms: parseList(search.forms, CONJUGATION_FORMS, DEFAULT_CONFIG.forms),
    groups: parseList(search.groups, ALL_GROUPS, DEFAULT_CONFIG.groups),
    modes: parseList(search.modes, ['input', 'choice'] as const, DEFAULT_CONFIG.modes),
    length: Number.isInteger(length) && length >= 1 && length <= 100 ? length : 10,
  }
}

/** validateSearch helper: normalizes any raw search into the compact shape. */
export function sanitizeSearch(search: Record<string, unknown>): QuizSearch {
  return serializeConfig(parseConfig(search))
}

const LAST_CONFIG_KEY = 'nihongo-mono:last-quiz-config'

export function loadLastConfig(): QuizConfig {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY)
    if (!raw) return DEFAULT_CONFIG
    return parseConfig(JSON.parse(raw))
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveLastConfig(config: QuizConfig): void {
  localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(serializeConfig(config)))
}
