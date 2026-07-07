import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SearchBox } from '@/components/verbs/SearchBox'
import { VerbFilters, type VerbListFilters } from '@/components/verbs/VerbFilters'
import { VerbTable } from '@/components/verbs/VerbTable'
import type { ClassGroup } from '@/lib/conjugation'
import { searchVerbRows } from '@/lib/data/ext-search'
import { loadVerbExtIndex, loadVerbLevels } from '@/lib/data/loader'
import { filterVerbs, searchWords } from '@/lib/data/search'
import type { JlptLevel, VerbEntry, VerbIndexRow, WordLevel } from '@/lib/data/types'

interface VerbsSearch {
  q?: string
  /** e.g. "5,4" — omitted means N5 only; 0 = beyond-JLPT (full JMdict) */
  levels?: string
  /** csv multi-selects — omitted means no constraint (all shown) */
  group?: string
  ending?: string
  trans?: string
  common?: boolean
}

const GROUPS: ClassGroup[] = ['godan', 'ichidan', 'suru', 'kuru']
const ENDINGS = ['ru', 'other'] as const
const TRANS = ['vt', 'vi'] as const

/** "godan,suru" → ['godan','suru']; drops unknown values, '' on none left. */
function csvOf<T extends string>(raw: unknown, allowed: readonly T[]): string {
  return String(raw ?? '')
    .split(',')
    .filter((x): x is T => (allowed as readonly string[]).includes(x))
    .join(',')
}

/** Beyond-JLPT matches materialized per query — keeps 24k rows off the heap. */
const EXT_LIMIT = 1000

export const Route = createFileRoute('/verbs/')({
  validateSearch: (search: Record<string, unknown>): VerbsSearch => {
    const out: VerbsSearch = {}
    if (typeof search.q === 'string' && search.q) out.q = search.q
    // ?levels=5 arrives as a number (router JSON-parses params) — normalize.
    // 'none' = all levels deselected via the Level label toggle.
    const levels = String(search.levels ?? '')
    if (levels === 'none' || /^[0-5](,[0-5])*$/.test(levels)) out.levels = levels
    const group = csvOf(search.group, GROUPS)
    if (group) out.group = group
    const ending = csvOf(search.ending, ENDINGS)
    if (ending) out.ending = ending
    const trans = csvOf(search.trans, TRANS)
    if (trans) out.trans = trans
    if (search.common === true) out.common = true
    return out
  },
  component: VerbListPage,
})

function parseLevels(levels: string | undefined): WordLevel[] {
  if (levels === 'none') return []
  if (!levels) return [5]
  return [...new Set(levels.split(',').map(Number))].sort((a, b) => b - a) as WordLevel[]
}

function parseCsv<T extends string>(raw: string | undefined): T[] {
  return raw ? (raw.split(',') as T[]) : []
}

function VerbListPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const levels = useMemo(() => parseLevels(search.levels), [search.levels])
  const groups = useMemo(() => parseCsv<ClassGroup>(search.group), [search.group])
  const endings = useMemo(() => parseCsv<'ru' | 'other'>(search.ending), [search.ending])
  const trans = useMemo(() => parseCsv<'vt' | 'vi'>(search.trans), [search.trans])
  const jlptLevels = useMemo(
    () => levels.filter((l): l is JlptLevel => l !== 0),
    [levels],
  )
  const beyond = levels.includes(0)

  const [verbs, setVerbs] = useState<VerbEntry[] | null>(null)
  useEffect(() => {
    let alive = true
    loadVerbLevels(jlptLevels).then((list) => {
      if (alive) setVerbs(list)
    })
    return () => {
      alive = false
    }
  }, [jlptLevels])

  // the extended index loads once, only when Beyond is on
  const [extRows, setExtRows] = useState<VerbIndexRow[] | null>(null)
  useEffect(() => {
    if (!beyond || extRows) return
    let alive = true
    loadVerbExtIndex().then((rows) => {
      if (alive) setExtRows(rows)
    })
    return () => {
      alive = false
    }
  }, [beyond, extRows])

  const results = useMemo(() => {
    if (!verbs) return null
    const f = { groups, endings, trans, commonOnly: search.common }
    const ranked = searchWords(filterVerbs(verbs, f), search.q ?? '')
    if (!beyond) return { entries: ranked, total: ranked.length, extLoading: false }
    if (!extRows) return { entries: ranked, total: ranked.length, extLoading: true }
    const ext = searchVerbRows(extRows, search.q ?? '', f, EXT_LIMIT)
    return {
      entries: [...ranked, ...ext.entries],
      total: ranked.length + ext.total,
      extLoading: false,
    }
  }, [verbs, extRows, beyond, search.q, groups, endings, trans, search.common])

  const filters: VerbListFilters = {
    levels,
    groups,
    endings,
    trans,
    common: search.common,
  }

  const setFilters = (next: VerbListFilters) => {
    navigate({
      search: {
        ...search,
        levels:
          next.levels.length === 0
            ? 'none'
            : next.levels.length === 1 && next.levels[0] === 5
              ? undefined
              : next.levels.join(','),
        group: next.groups.length > 0 ? next.groups.join(',') : undefined,
        ending: next.endings.length > 0 ? next.endings.join(',') : undefined,
        trans: next.trans.length > 0 ? next.trans.join(',') : undefined,
        common: next.common,
      },
      replace: true,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Verbs</h1>
        {results && (
          <span className="text-xs text-muted-foreground">
            {results.total.toLocaleString()} verb{results.total === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <SearchBox
        value={search.q ?? ''}
        onChange={(q) => navigate({ search: { ...search, q: q || undefined }, replace: true })}
      />
      <VerbFilters filters={filters} onChange={setFilters} />
      {results === null ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {results.extLoading && (
            <p className="text-xs text-muted-foreground">
              Loading the full dictionary… (a one-time download, cached afterwards)
            </p>
          )}
          {!results.extLoading && beyond && results.total > results.entries.length && (
            <p className="text-xs text-muted-foreground">
              Showing the {EXT_LIMIT.toLocaleString()} best beyond-JLPT matches —
              search to narrow the rest down.
            </p>
          )}
          <VerbTable verbs={results.entries} />
        </>
      )}
    </div>
  )
}
