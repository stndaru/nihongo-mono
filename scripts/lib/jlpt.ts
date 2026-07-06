import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface JlptRow {
  expression: string
  reading: string
  level: 1 | 2 | 3 | 4 | 5
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
 * Loads all five JLPT word lists. A word appearing in several lists keeps
 * its easiest level (N5 wins over N4), matching how the lists overlap.
 */
export function loadJlptRows(cacheDir: string): JlptRow[] {
  const byKey = new Map<string, JlptRow>()
  // easiest first so harder duplicates don't overwrite
  for (const level of [5, 4, 3, 2, 1] as const) {
    const csv = readFileSync(join(cacheDir, `jlpt-n${level}.csv`), 'utf8')
    const lines = csv.split(/\r?\n/).slice(1)
    for (const line of lines) {
      if (!line.trim()) continue
      const [expression, reading] = parseCsvLine(line)
      if (!expression) continue
      const key = `${expression}|${reading}`
      if (!byKey.has(key)) {
        byKey.set(key, { expression, reading: reading || expression, level })
      }
    }
  }
  return [...byKey.values()]
}
