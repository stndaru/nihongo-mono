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
  group?: ClassGroup
  ending?: 'ru' | 'other'
  trans?: 'vt' | 'vi'
  common?: boolean
}

const GROUPS: ClassGroup[] = ['godan', 'ichidan', 'suru', 'kuru']

/** Beyond-JLPT matches materialized per query — keeps 24k rows off the heap. */
const EXT_LIMIT = 1000

export const Route = createFileRoute('/verbs/')({
  validateSearch: (search: Record<string, unknown>): VerbsSearch => {
    const out: VerbsSearch = {}
    if (typeof search.q === 'string' && search.q) out.q = search.q
    // ?levels=5 arrives as a number (router JSON-parses params) — normalize
    const levels = String(search.levels ?? '')
    if (/^[0-5](,[0-5])*$/.test(levels)) out.levels = levels
    if (GROUPS.includes(search.group as ClassGroup)) out.group = search.group as ClassGroup
    if (search.ending === 'ru' || search.ending === 'other') out.ending = search.ending
    if (search.trans === 'vt' || search.trans === 'vi') out.trans = search.trans
    if (search.common === true) out.common = true
    return out
  },
  component: VerbListPage,
})

function parseLevels(levels: string | undefined): WordLevel[] {
  if (!levels) return [5]
  return [...new Set(levels.split(',').map(Number))].sort((a, b) => b - a) as WordLevel[]
}

function VerbListPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const levels = useMemo(() => parseLevels(search.levels), [search.levels])
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
    const f = {
      group: search.group,
      ending: search.ending,
      trans: search.trans,
      commonOnly: search.common,
    }
    const ranked = searchWords(filterVerbs(verbs, f), search.q ?? '')
    if (!beyond) return { entries: ranked, total: ranked.length, extLoading: false }
    if (!extRows) return { entries: ranked, total: ranked.length, extLoading: true }
    const ext = searchVerbRows(extRows, search.q ?? '', f, EXT_LIMIT)
    return {
      entries: [...ranked, ...ext.entries],
      total: ranked.length + ext.total,
      extLoading: false,
    }
  }, [verbs, extRows, beyond, search.q, search.group, search.ending, search.trans, search.common])

  const filters: VerbListFilters = {
    levels,
    group: search.group,
    ending: search.ending,
    trans: search.trans,
    common: search.common,
  }

  const setFilters = (next: VerbListFilters) => {
    navigate({
      search: {
        ...search,
        levels:
          next.levels.length === 1 && next.levels[0] === 5
            ? undefined
            : next.levels.join(','),
        group: next.group,
        ending: next.ending,
        trans: next.trans,
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
