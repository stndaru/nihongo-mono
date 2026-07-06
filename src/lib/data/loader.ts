import type { JlptLevel, KanjiEntry, VerbEntry } from './types'

const levelCache = new Map<JlptLevel, Promise<VerbEntry[]>>()

/** Lazy-loads one JLPT level's verbs; each level is its own Vite chunk. */
export function loadVerbLevel(level: JlptLevel): Promise<VerbEntry[]> {
  let cached = levelCache.get(level)
  if (!cached) {
    cached = import(`../../data/verbs/n${level}.json`).then(
      (m: { default: VerbEntry[] }) => m.default,
    )
    levelCache.set(level, cached)
  }
  return cached
}

/** Loads several levels, concatenated easiest-first (N5 → N1). */
export async function loadVerbLevels(levels: readonly JlptLevel[]): Promise<VerbEntry[]> {
  const sorted = [...levels].sort((a, b) => b - a)
  const lists = await Promise.all(sorted.map(loadVerbLevel))
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
