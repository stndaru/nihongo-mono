import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FuriganaSegment } from '../../src/lib/data/types'

interface FuriganaEntry {
  text: string
  reading: string
  furigana: { ruby: string; rt?: string }[]
}

export type FuriganaIndex = Map<string, FuriganaSegment[]>

export function loadFuriganaIndex(cacheDir: string): FuriganaIndex {
  // The release file starts with a UTF-8 BOM.
  const raw = readFileSync(join(cacheDir, 'furigana.json'), 'utf8').replace(/^﻿/, '')
  const entries: FuriganaEntry[] = JSON.parse(raw)
  const index: FuriganaIndex = new Map()
  for (const e of entries) {
    index.set(
      `${e.text}|${e.reading}`,
      e.furigana.map((f) => (f.rt ? { t: f.ruby, r: f.rt } : { t: f.ruby })),
    )
  }
  return index
}

/**
 * Look up per-segment furigana; fall back to whole-word ruby (and report the
 * miss) when the pair isn't in the index.
 */
export function furiganaFor(
  index: FuriganaIndex,
  kanji: string,
  kana: string,
  misses?: string[],
): FuriganaSegment[] {
  if (kanji === kana) return [{ t: kana }]
  const hit = index.get(`${kanji}|${kana}`)
  if (hit) return hit
  misses?.push(`${kanji}|${kana}`)
  return [{ t: kanji, r: kana }]
}
