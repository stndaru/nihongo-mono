import type { JlptLevel, KanjiEntry, VerbEntry, VocabEntry } from './types'

const verbCache = new Map<JlptLevel, Promise<VerbEntry[]>>()
const vocabCache = new Map<JlptLevel, Promise<VocabEntry[]>>()

/** Lazy-loads one JLPT level's verbs; each level is its own Vite chunk. */
export function loadVerbLevel(level: JlptLevel): Promise<VerbEntry[]> {
  let cached = verbCache.get(level)
  if (!cached) {
    cached = import(`../../data/verbs/n${level}.json`).then(
      (m: { default: VerbEntry[] }) => m.default,
    )
    verbCache.set(level, cached)
  }
  return cached
}

export function loadVocabLevel(level: JlptLevel): Promise<VocabEntry[]> {
  let cached = vocabCache.get(level)
  if (!cached) {
    cached = import(`../../data/vocab/n${level}.json`).then(
      (m: { default: VocabEntry[] }) => m.default,
    )
    vocabCache.set(level, cached)
  }
  return cached
}

/** Loads several levels, concatenated easiest-first (N5 → N1). */
export async function loadVerbLevels(levels: readonly JlptLevel[]): Promise<VerbEntry[]> {
  const sorted = [...levels].sort((a, b) => b - a)
  const lists = await Promise.all(sorted.map(loadVerbLevel))
  return lists.flat()
}

export async function loadVocabLevels(levels: readonly JlptLevel[]): Promise<VocabEntry[]> {
  const sorted = [...levels].sort((a, b) => b - a)
  const lists = await Promise.all(sorted.map(loadVocabLevel))
  return lists.flat()
}

let kanjiCache: Promise<Record<string, KanjiEntry>> | null = null

export function loadKanji(): Promise<Record<string, KanjiEntry>> {
  kanjiCache ??= import('../../data/kanji/kanji.json').then(
    (m) => m.default as Record<string, KanjiEntry>,
  )
  return kanjiCache
}

/** Finds one verb by id, searching easiest levels first. */
export async function findVerb(id: string): Promise<VerbEntry | undefined> {
  for (const level of [5, 4, 3, 2, 1] as const) {
    const verbs = await loadVerbLevel(level)
    const hit = verbs.find((v) => v.id === id)
    if (hit) return hit
  }
  return undefined
}

export async function findVocab(id: string): Promise<VocabEntry | undefined> {
  for (const level of [5, 4, 3, 2, 1] as const) {
    const words = await loadVocabLevel(level)
    const hit = words.find((v) => v.id === id)
    if (hit) return hit
  }
  return undefined
}
