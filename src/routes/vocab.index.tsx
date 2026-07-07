import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Chip, ChipGroup } from '@/components/ui/chip'
import { SearchBox } from '@/components/verbs/SearchBox'
import { POS_LABELS } from '@/components/vocab/PosBadge'
import { VocabTable } from '@/components/vocab/VocabTable'
import { loadVocabLevels } from '@/lib/data/loader'
import { filterVocab, searchWords } from '@/lib/data/search'
import type { JlptLevel, VocabEntry, VocabPos } from '@/lib/data/types'

interface VocabSearch {
  q?: string
  /** e.g. "5,4" — omitted means N5 only */
  levels?: string
  pos?: VocabPos
  common?: boolean
}

const POS_VALUES: VocabPos[] = ['noun', 'adj-i', 'adj-na', 'adverb']

export const Route = createFileRoute('/vocab/')({
  validateSearch: (search: Record<string, unknown>): VocabSearch => {
    const out: VocabSearch = {}
    if (typeof search.q === 'string' && search.q) out.q = search.q
    if (typeof search.levels === 'string' && /^[1-5](,[1-5])*$/.test(search.levels))
      out.levels = search.levels
    if (POS_VALUES.includes(search.pos as VocabPos)) out.pos = search.pos as VocabPos
    if (search.common === true) out.common = true
    return out
  },
  component: VocabListPage,
})

function parseLevels(levels: string | undefined): JlptLevel[] {
  if (!levels) return [5]
  return [...new Set(levels.split(',').map(Number))].sort((a, b) => b - a) as JlptLevel[]
}

function VocabListPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const levels = useMemo(() => parseLevels(search.levels), [search.levels])

  const [words, setWords] = useState<VocabEntry[] | null>(null)
  useEffect(() => {
    let alive = true
    loadVocabLevels(levels).then((list) => {
      if (alive) setWords(list)
    })
    return () => {
      alive = false
    }
  }, [levels])

  const results = useMemo(() => {
    if (!words) return null
    const filtered = filterVocab(words, { pos: search.pos, commonOnly: search.common })
    return searchWords(filtered, search.q ?? '')
  }, [words, search.q, search.pos, search.common])

  const setSearch = (patch: Partial<VocabSearch>) =>
    navigate({ search: { ...search, ...patch }, replace: true })

  const toggleLevel = (level: JlptLevel) => {
    const has = levels.includes(level)
    const next = has ? levels.filter((l) => l !== level) : [...levels, level]
    if (next.length === 0) return
    const sorted = next.sort((a, b) => b - a)
    setSearch({
      levels: sorted.length === 1 && sorted[0] === 5 ? undefined : sorted.join(','),
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Vocabulary</h1>
        {results && (
          <span className="text-xs text-muted-foreground">
            {results.length} word{results.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <SearchBox
        value={search.q ?? ''}
        onChange={(q) => setSearch({ q: q || undefined })}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ChipGroup label="Level">
          {([5, 4, 3, 2, 1] as const).map((level) => (
            <Chip key={level} active={levels.includes(level)} onClick={() => toggleLevel(level)}>
              N{level}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label="Type">
          {POS_VALUES.map((pos) => (
            <Chip
              key={pos}
              active={search.pos === pos}
              onClick={() => setSearch({ pos: search.pos === pos ? undefined : pos })}
            >
              {POS_LABELS[pos]}
            </Chip>
          ))}
        </ChipGroup>
        <Chip
          active={search.common === true}
          onClick={() => setSearch({ common: search.common ? undefined : true })}
        >
          Common Only
        </Chip>
      </div>
      {results === null ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <VocabTable words={results} />
      )}
    </div>
  )
}
