import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SearchBox } from '@/components/verbs/SearchBox'
import { VerbFilters, type VerbListFilters } from '@/components/verbs/VerbFilters'
import { VerbTable } from '@/components/verbs/VerbTable'
import type { ClassGroup } from '@/lib/conjugation'
import { loadVerbLevels } from '@/lib/data/loader'
import { filterVerbs, searchVerbs } from '@/lib/data/search'
import type { JlptLevel, VerbEntry } from '@/lib/data/types'

interface VerbsSearch {
  q?: string
  /** e.g. "5,4" — omitted means N5 only */
  levels?: string
  group?: ClassGroup
  ending?: 'ru' | 'other'
  trans?: 'vt' | 'vi'
  common?: boolean
}

const GROUPS: ClassGroup[] = ['godan', 'ichidan', 'suru', 'kuru']

export const Route = createFileRoute('/verbs/')({
  validateSearch: (search: Record<string, unknown>): VerbsSearch => {
    const out: VerbsSearch = {}
    if (typeof search.q === 'string' && search.q) out.q = search.q
    if (typeof search.levels === 'string' && /^[1-5](,[1-5])*$/.test(search.levels))
      out.levels = search.levels
    if (GROUPS.includes(search.group as ClassGroup)) out.group = search.group as ClassGroup
    if (search.ending === 'ru' || search.ending === 'other') out.ending = search.ending
    if (search.trans === 'vt' || search.trans === 'vi') out.trans = search.trans
    if (search.common === true) out.common = true
    return out
  },
  component: VerbListPage,
})

function parseLevels(levels: string | undefined): JlptLevel[] {
  if (!levels) return [5]
  return [...new Set(levels.split(',').map(Number))].sort((a, b) => b - a) as JlptLevel[]
}

function VerbListPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const levels = useMemo(() => parseLevels(search.levels), [search.levels])

  const [verbs, setVerbs] = useState<VerbEntry[] | null>(null)
  useEffect(() => {
    let alive = true
    loadVerbLevels(levels).then((list) => {
      if (alive) setVerbs(list)
    })
    return () => {
      alive = false
    }
  }, [levels])

  const results = useMemo(() => {
    if (!verbs) return null
    const filtered = filterVerbs(verbs, {
      group: search.group,
      ending: search.ending,
      trans: search.trans,
      commonOnly: search.common,
    })
    return searchVerbs(filtered, search.q ?? '')
  }, [verbs, search.q, search.group, search.ending, search.trans, search.common])

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
            {results.length} verb{results.length === 1 ? '' : 's'}
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
        <VerbTable verbs={results} />
      )}
    </div>
  )
}
