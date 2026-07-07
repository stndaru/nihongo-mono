import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface JlptRow {
  expression: string
  reading: string
  level: 1 | 2 | 3 | 4 | 5
  /** exact JMdict sequence id when the source provides one (yomitan lists) */
  seq?: string
}

/** Tiny CSV parser handling double-quoted fields (the lists use no escapes beyond that). */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

/**
 * Loads and unions the word lists. A word appearing in several lists keeps
 * its easiest level (N5 wins over N4), matching how the lists overlap.
 *
 * Sources: elzup CSVs (expression,reading,…), yomitan CSVs with exact JMdict
 * sequence ids (jmdict_seq,kana,kanji,…), and the hand-curated
 * extra-words.json supplement for words the public lists lack (小説家 etc.).
 */
export function loadJlptRows(cacheDir: string): JlptRow[] {
  const byKey = new Map<string, JlptRow>()
  const add = (row: JlptRow) => {
    const key = `${row.expression}|${row.reading}`
    if (!byKey.has(key)) byKey.set(key, row)
  }
  // easiest first so harder duplicates don't overwrite; within a level the
  // yomitan rows go first — their exact seq beats text matching
  for (const level of [5, 4, 3, 2, 1] as const) {
    const yomitan = readFileSync(join(cacheDir, `yomitan-n${level}.csv`), 'utf8')
    for (const line of yomitan.split(/\r?\n/).slice(1)) {
      if (!line.trim()) continue
      const [seq, kana, kanji] = parseCsvLine(line)
      if (!seq || !kana) continue
      add({ expression: kanji || kana, reading: kana, level, seq })
    }
    const csv = readFileSync(join(cacheDir, `jlpt-n${level}.csv`), 'utf8')
    for (const line of csv.split(/\r?\n/).slice(1)) {
      if (!line.trim()) continue
      const [expression, reading] = parseCsvLine(line)
      if (!expression) continue
      add({ expression, reading: reading || expression, level })
    }
  }
  const extra: { words: [string, string, number][] } = JSON.parse(
    readFileSync(join(cacheDir, '..', 'extra-words.json'), 'utf8'),
  )
  for (const [expression, reading, level] of extra.words) {
    add({ expression, reading, level: level as JlptRow['level'] })
  }
  return [...byKey.values()]
}
