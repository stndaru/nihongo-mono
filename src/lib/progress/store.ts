import type { ConjugationForm } from '@/lib/conjugation'
import { bumpStreak, todayLocal, type StreakData } from './streak'

export interface VerbStat {
  seen: number
  correct: number
  wrong: number
  /** YYYY-MM-DD of the last quiz appearance */
  lastSeen: string
}

export interface SessionRecord {
  date: string
  total: number
  correct: number
  forms: ConjugationForm[]
  /** absent on records from before the vocabulary quiz existed → 'verb' */
  kind?: 'verb' | 'vocab'
}

export interface ProgressData {
  version: 1
  verbs: Record<string, VerbStat>
  sessions: SessionRecord[]
  streak: StreakData
}

const STORAGE_KEY = 'nihongo-mono:progress:v1'
const SESSION_CAP = 100

export function emptyProgress(): ProgressData {
  return {
    version: 1,
    verbs: {},
    sessions: [],
    streak: { current: 0, best: 0, lastActiveDay: null },
  }
}

/** Future schema bumps switch on `version` here. */
function migrate(raw: unknown): ProgressData {
  const data = raw as Partial<ProgressData> | null
  if (!data || typeof data !== 'object' || data.version !== 1) return emptyProgress()
  return {
    version: 1,
    verbs: data.verbs ?? {},
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    streak: data.streak ?? { current: 0, best: 0, lastActiveDay: null },
  }
}

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? migrate(JSON.parse(raw)) : emptyProgress()
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(data: ProgressData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export interface SessionResultInput {
  /** JMdict sequence id — verbs and vocabulary share the stat pool */
  answers: { verbId: string; correct: boolean }[]
  forms: ConjugationForm[]
  kind?: 'verb' | 'vocab'
}

/** Pure update — the context provider persists the returned object. */
export function applySession(data: ProgressData, input: SessionResultInput): ProgressData {
  const today = todayLocal()
  const verbs = { ...data.verbs }
  for (const a of input.answers) {
    const prev = verbs[a.verbId] ?? { seen: 0, correct: 0, wrong: 0, lastSeen: today }
    verbs[a.verbId] = {
      seen: prev.seen + 1,
      correct: prev.correct + (a.correct ? 1 : 0),
      wrong: prev.wrong + (a.correct ? 0 : 1),
      lastSeen: today,
    }
  }
  const record: SessionRecord = {
    date: today,
    total: input.answers.length,
    correct: input.answers.filter((a) => a.correct).length,
    forms: [...new Set(input.forms)],
    kind: input.kind ?? 'verb',
  }
  return {
    version: 1,
    verbs,
    sessions: [...data.sessions, record].slice(-SESSION_CAP),
    streak: bumpStreak(data.streak, today),
  }
}

/**
 * Validates an imported file. Throws with a readable message on bad input.
 */
export function parseImported(text: string): ProgressData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Not a JSON file.')
  }
  if (!raw || typeof raw !== 'object' || (raw as ProgressData).version !== 1) {
    throw new Error('Not a nihongo mono progress file (missing version: 1).')
  }
  const data = raw as ProgressData
  if (typeof data.verbs !== 'object' || !Array.isArray(data.sessions)) {
    throw new Error('Progress file is malformed.')
  }
  return migrate(data)
}

/** Merge for importing on a second browser: counts add, better streak wins. */
export function mergeProgress(a: ProgressData, b: ProgressData): ProgressData {
  const verbs = { ...a.verbs }
  for (const [id, stat] of Object.entries(b.verbs)) {
    const prev = verbs[id]
    verbs[id] = prev
      ? {
          seen: prev.seen + stat.seen,
          correct: prev.correct + stat.correct,
          wrong: prev.wrong + stat.wrong,
          lastSeen: prev.lastSeen > stat.lastSeen ? prev.lastSeen : stat.lastSeen,
        }
      : stat
  }
  const sessions = [...a.sessions, ...b.sessions]
    .sort((x, y) => x.date.localeCompare(y.date))
    .slice(-SESSION_CAP)
  const streak =
    (b.streak.lastActiveDay ?? '') > (a.streak.lastActiveDay ?? '') ? b.streak : a.streak
  return {
    version: 1,
    verbs,
    sessions,
    streak: { ...streak, best: Math.max(a.streak.best, b.streak.best) },
  }
}
