/**
 * Integrity suite for the committed grammar dataset (src/data/grammar).
 * Lives in scripts/ because it reads the JSON via node:fs — never through
 * the JS module graph (decision 18) — and only this tsconfig project types
 * node. It validates the invariants every authoring/review pass must
 * uphold: stable well-formed slugs, resolvable relations, exactly 2
 * examples, and furigana that re-concatenates to its sentence (the
 * staleness tripwire that forces `bun run data:grammar` after any edit).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFurigana } from '../src/lib/data/furigana'
import type { GrammarEntry, JlptLevel } from '../src/lib/data/types'

const GRAMMAR_DIR = join(import.meta.dirname, '..', 'src', 'data', 'grammar')

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const KANJI_RE = /[㐀-䶿一-鿿]/

interface InventoryRow {
  slug: string
  resolution: string
}

// explicit filenames — inventory.json lives in the same dir and is not entries
const files: { level: JlptLevel; entries: GrammarEntry[] }[] = []
for (const level of [5, 4, 3, 2, 1] as const) {
  const path = join(GRAMMAR_DIR, `n${level}.json`)
  if (existsSync(path)) {
    files.push({ level, entries: JSON.parse(readFileSync(path, 'utf8')) })
  }
}
const all = files.flatMap((f) => f.entries)

// relations may point at slugs whose level isn't authored yet — the universe
// is authored slugs plus the reconciled inventory's kept rows
const inventoryPath = join(GRAMMAR_DIR, 'inventory.json')
const keptSlugs = new Set(all.map((e) => e.slug))
if (existsSync(inventoryPath)) {
  const rows: InventoryRow[] = JSON.parse(readFileSync(inventoryPath, 'utf8'))
  for (const row of rows) if (row.resolution === 'kept') keptSlugs.add(row.slug)
}

describe('grammar data integrity', () => {
  it('has at least one authored level file', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('slugs are well-formed and globally unique', () => {
    const seen = new Set<string>()
    const bad: string[] = []
    for (const e of all) {
      if (!SLUG_RE.test(e.slug)) bad.push(`malformed: ${e.slug}`)
      if (seen.has(e.slug)) bad.push(`duplicate: ${e.slug}`)
      seen.add(e.slug)
    }
    expect(bad).toEqual([])
  })

  it('jlpt level matches the file the entry lives in', () => {
    const bad = files.flatMap((f) =>
      f.entries
        .filter((e) => e.jlpt !== f.level)
        .map((e) => `${e.slug}: jlpt ${e.jlpt} in n${f.level}.json`),
    )
    expect(bad).toEqual([])
  })

  it('required fields are present and non-empty', () => {
    const bad: string[] = []
    for (const e of all) {
      for (const field of ['title', 'kana', 'romaji', 'meaning', 'summary'] as const) {
        if (!e[field]?.trim()) bad.push(`${e.slug}: empty ${field}`)
      }
      if (!Array.isArray(e.structure) || e.structure.length === 0)
        bad.push(`${e.slug}: empty structure`)
      if (!Array.isArray(e.sources) || e.sources.length === 0)
        bad.push(`${e.slug}: empty sources`)
      for (const list of ['pitfalls', 'synonyms', 'antonyms', 'related'] as const) {
        if (!Array.isArray(e[list])) bad.push(`${e.slug}: ${list} is not an array`)
      }
    }
    expect(bad).toEqual([])
  })

  it('structure lines keep brackets whole within each ＋-chip', () => {
    // GrammarStructure splits lines on ＋ at （…） depth 0 into boxed chips —
    // a （ or ［ that closes in a different chip renders as a cut-off bracket.
    const balanced = (str: string, open: string, close: string) => {
      let depth = 0
      for (const ch of str) {
        if (ch === open) depth++
        else if (ch === close) depth--
        if (depth < 0) return false
      }
      return depth === 0
    }
    const bad: string[] = []
    for (const e of all) {
      for (const line of e.structure) {
        if (!balanced(line, '（', '）') || !balanced(line, '［', '］')) {
          bad.push(`${e.slug}: unbalanced brackets in "${line}"`)
          continue
        }
        let depth = 0
        let token = ''
        const tokens: string[] = []
        for (const ch of line) {
          if (ch === '（') depth++
          else if (ch === '）') depth--
          if (ch === '＋' && depth === 0) {
            tokens.push(token)
            token = ''
          } else token += ch
        }
        tokens.push(token)
        for (const t of tokens) {
          if (t.trim() === '') bad.push(`${e.slug}: empty chip in "${line}"`)
          else if (!balanced(t, '［', '］'))
            bad.push(`${e.slug}: ［…］ split across chips in "${line}"`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('every entry has exactly 2 examples with ja and en', () => {
    const bad: string[] = []
    for (const e of all) {
      if (e.examples.length !== 2) bad.push(`${e.slug}: ${e.examples.length} examples`)
      for (const ex of e.examples) {
        if (!ex.ja?.trim() || !ex.en?.trim()) bad.push(`${e.slug}: example missing ja/en`)
      }
    }
    expect(bad).toEqual([])
  })

  it('every relation resolves to a kept slug and is not self-referential', () => {
    const bad: string[] = []
    for (const e of all) {
      for (const list of ['synonyms', 'antonyms', 'related'] as const) {
        for (const rel of e[list]) {
          if (rel.slug === e.slug) bad.push(`${e.slug}: self-reference in ${list}`)
          else if (!keptSlugs.has(rel.slug)) bad.push(`${e.slug}: dangling ${list} → ${rel.slug}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('furigana is present for kanji sentences and re-concatenates to ja', () => {
    const bad: string[] = []
    for (const e of all) {
      for (const ex of e.examples) {
        if (KANJI_RE.test(ex.ja) && !ex.f) {
          bad.push(`${e.slug}: kanji sentence without f — run: bun run data:grammar`)
          continue
        }
        if (!ex.f) continue
        const segs = parseFurigana(ex.f)
        if (!segs.some((s) => s.r)) bad.push(`${e.slug}: f has no ruby: ${ex.f}`)
        const joined = segs.map((s) => s.t).join('')
        if (joined !== ex.ja) {
          bad.push(`${e.slug}: stale f (ja edited?) — run: bun run data:grammar`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
