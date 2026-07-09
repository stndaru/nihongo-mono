import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { GrammarTable } from '@/components/grammar/GrammarTable'
import { Chip, ChipGroup } from '@/components/ui/chip'
import { SearchBox } from '@/components/verbs/SearchBox'
import { searchGrammar } from '@/lib/data/grammar-search'
import { loadGrammarLevels } from '@/lib/data/loader'
import type { GrammarEntry, JlptLevel } from '@/lib/data/types'

interface GrammarSearch {
  q?: string
  /** e.g. "5,4" — omitted means N5 only; 'none' = all deselected */
  levels?: string
}

export const Route = createFileRoute('/grammar/')({
  validateSearch: (search: Record<string, unknown>): GrammarSearch => {
    const out: GrammarSearch = {}
    if (typeof search.q === 'string' && search.q) out.q = search.q
    // ?levels=5 arrives as a number (router JSON-parses params) — normalize.
    const levels = String(search.levels ?? '')
    if (levels === 'none' || /^[1-5](,[1-5])*$/.test(levels)) out.levels = levels
    return out
  },
  component: GrammarListPage,
})

function parseLevels(levels: string | undefined): JlptLevel[] {
  if (levels === 'none') return []
  if (!levels) return [5]
  return [...new Set(levels.split(',').map(Number))].sort((a, b) => b - a) as JlptLevel[]
}

function GrammarListPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const levels = useMemo(() => parseLevels(search.levels), [search.levels])

  const [entries, setEntries] = useState<GrammarEntry[] | null>(null)
  useEffect(() => {
    let alive = true
    loadGrammarLevels(levels).then((list) => {
      if (alive) setEntries(list)
    })
    return () => {
      alive = false
    }
  }, [levels])

  const results = useMemo(
    () => (entries ? searchGrammar(entries, search.q ?? '') : null),
    [entries, search.q],
  )

  const setSearch = (patch: Partial<GrammarSearch>) =>
    navigate({ search: { ...search, ...patch }, replace: true })

  const setLevels = (next: JlptLevel[]) => {
    const sorted = [...next].sort((a, b) => b - a)
    setSearch({
      levels:
        sorted.length === 0
          ? 'none'
          : sorted.length === 1 && sorted[0] === 5
            ? undefined
            : sorted.join(','),
    })
  }

  const toggleLevel = (level: JlptLevel) => {
    const has = levels.includes(level)
    const next = has ? levels.filter((l) => l !== level) : [...levels, level]
    setLevels(next)
  }

  const toggleAllLevels = () => {
    const all: JlptLevel[] = [5, 4, 3, 2, 1]
    setLevels(all.every((l) => levels.includes(l)) ? [] : all)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Grammar Points</h1>
        {results && (
          <span className="text-xs text-muted-foreground">
            {results.length.toLocaleString()} point{results.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <SearchBox
        value={search.q ?? ''}
        onChange={(q) => setSearch({ q: q || undefined })}
        placeholder="Search grammar, kana, romaji, or English…"
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ChipGroup
          label="Level"
          onLabelClick={toggleAllLevels}
          labelTitle="select/deselect all JLPT levels"
        >
          {([5, 4, 3, 2, 1] as const).map((level) => (
            <Chip key={level} active={levels.includes(level)} onClick={() => toggleLevel(level)}>
              N{level}
            </Chip>
          ))}
        </ChipGroup>
      </div>
      {results === null ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <GrammarTable entries={results} />
      )}
    </div>
  )
}
