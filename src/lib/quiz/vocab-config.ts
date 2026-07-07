import type { JlptLevel, VocabPos } from '@/lib/data/types'
import type { QuizMode } from './config'

export interface VocabQuizConfig {
  levels: JlptLevel[]
  pos: VocabPos[]
  modes: QuizMode[]
  length: number
}

export const ALL_POS: VocabPos[] = ['noun', 'adj-i', 'adj-na', 'adverb']

export const DEFAULT_VOCAB_CONFIG: VocabQuizConfig = {
  levels: [5],
  pos: ALL_POS,
  modes: ['input', 'choice'],
  length: 10,
}

/** Compact query-string shape: /quiz/vocab/session?levels=5&pos=noun&… */
export interface VocabQuizSearch {
  levels: string
  pos: string
  modes: string
  length: number
}

export function serializeVocabConfig(config: VocabQuizConfig): VocabQuizSearch {
  return {
    levels: config.levels.join(','),
    pos: config.pos.join(','),
    modes: config.modes.join(','),
    length: config.length,
  }
}

function parseList<T extends string>(raw: unknown, valid: readonly T[], fallback: T[]): T[] {
  if (typeof raw !== 'string') return fallback
  const items = raw.split(',').filter((x): x is T => valid.includes(x as T))
  return items.length > 0 ? [...new Set(items)] : fallback
}

export function parseVocabConfig(search: Record<string, unknown>): VocabQuizConfig {
  const levels =
    typeof search.levels === 'string' && /^[1-5](,[1-5])*$/.test(search.levels)
      ? ([...new Set(search.levels.split(',').map(Number))] as JlptLevel[])
      : DEFAULT_VOCAB_CONFIG.levels
  const length = Number(search.length)
  return {
    levels,
    pos: parseList(search.pos, ALL_POS, DEFAULT_VOCAB_CONFIG.pos),
    modes: parseList(search.modes, ['input', 'choice'] as const, DEFAULT_VOCAB_CONFIG.modes),
    length: Number.isInteger(length) && length >= 1 && length <= 100 ? length : 10,
  }
}

export function sanitizeVocabSearch(search: Record<string, unknown>): VocabQuizSearch {
  return serializeVocabConfig(parseVocabConfig(search))
}

const LAST_CONFIG_KEY = 'nihongo-mono:last-vocab-quiz-config'

export function loadLastVocabConfig(): VocabQuizConfig {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY)
    if (!raw) return DEFAULT_VOCAB_CONFIG
    return parseVocabConfig(JSON.parse(raw))
  } catch {
    return DEFAULT_VOCAB_CONFIG
  }
}

export function saveLastVocabConfig(config: VocabQuizConfig): void {
  localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(serializeVocabConfig(config)))
}
