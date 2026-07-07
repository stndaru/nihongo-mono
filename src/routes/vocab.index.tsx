import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Chip, ChipGroup } from '@/components/ui/chip'
import { SearchBox } from '@/components/verbs/SearchBox'
import { POS_LABELS } from '@/components/vocab/PosBadge'
import { VocabTable } from '@/components/vocab/VocabTable'
import { searchVocabRows } from '@/lib/data/ext-search'
import { loadVocabExtIndex, loadVocabLevels } from '@/lib/data/loader'
import { filterVocab, searchWords } from '@/lib/data/search'
import type { JlptLevel, VocabEntry, VocabIndexRow, VocabPos, WordLevel } from '@/lib/data/types'

interface VocabSearch {
  q?: string
  /** e.g. "5,4" — omitted means N5 only; 0 = beyond-JLPT (full JMdict) */
  levels?: string
  pos?: VocabPos
  common?: boolean
}

const POS_VALUES: VocabPos[] = [
  'noun',
  'adj-i',
  'adj-na',
  'adverb',
  'expression',
  'interjection',
  'pronoun',
  'particle',
  'conjunction',
  'counter',
  'prefix',
  'suffix',
  'verb',
  'other',
]

/** Beyond-JLPT matches materialized per query — keeps 204k rows off the heap. */
const EXT_LIMIT = 1000

export const Route = createFileRoute('/vocab/')({
  validateSearch: (search: Record<string, unknown>): VocabSearch => {
    const out: VocabSearch = {}
    if (typeof search.q === 'string' && search.q) out.q = search.q
    // ?levels=5 arrives as a number (router JSON-parses params) — normalize.
    // 'none' = all levels deselected via the Level label toggle.
    const levels = String(search.levels ?? '')
    if (levels === 'none' || /^[0-5](,[0-5])*$/.test(levels)) out.levels = levels
    if (POS_VALUES.includes(search.pos as VocabPos)) out.pos = search.pos as VocabPos
    if (search.common === true) out.common = true
    return out
  },
  component: VocabListPage,
})

function parseLevels(levels: string | undefined): WordLevel[] {
  if (levels === 'none') return []
  if (!levels) return [5]
  return [...new Set(levels.split(',').map(Number))].sort((a, b) => b - a) as WordLevel[]
}

function VocabListPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const levels = useMemo(() => parseLevels(search.levels), [search.levels])
  const jlptLevels = useMemo(
    () => levels.filter((l): l is JlptLevel => l !== 0),
    [levels],
  )
  const beyond = levels.includes(0)

  const [words, setWords] = useState<VocabEntry[] | null>(null)
  useEffect(() => {
    let alive = true
    loadVocabLevels(jlptLevels).then((list) => {
      if (alive) setWords(list)
    })
    return () => {
      alive = false
    }
  }, [jlptLevels])

  // the extended index (~200k rows) loads once, only when Beyond is on
  const [extRows, setExtRows] = useState<VocabIndexRow[] | null>(null)
  useEffect(() => {
    if (!beyond || extRows) return
    let alive = true
    loadVocabExtIndex().then((rows) => {
      if (alive) setExtRows(rows)
    })
    return () => {
      alive = false
    }
  }, [beyond, extRows])

  const results = useMemo(() => {
    if (!words) return null
    const f = { pos: search.pos, commonOnly: search.common }
    const ranked = searchWords(filterVocab(words, f), search.q ?? '')
    if (!beyond) return { entries: ranked, total: ranked.length, extLoading: false }
    if (!extRows) return { entries: ranked, total: ranked.length, extLoading: true }
    const ext = searchVocabRows(extRows, search.q ?? '', f, EXT_LIMIT)
    return {
      entries: [...ranked, ...ext.entries],
      total: ranked.length + ext.total,
      extLoading: false,
    }
  }, [words, extRows, beyond, search.q, search.pos, search.common])

  const setSearch = (patch: Partial<VocabSearch>) =>
    navigate({ search: { ...search, ...patch }, replace: true })

  const setLevels = (next: WordLevel[]) => {
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

  const toggleLevel = (level: WordLevel) => {
    const has = levels.includes(level)
    const next = has ? levels.filter((l) => l !== level) : [...levels, level]
    if (next.length === 0) return
    setLevels(next)
  }

  // label click: select/deselect all JLPT levels; Beyond keeps its state
  const toggleAllLevels = () => {
    const jlptAll: WordLevel[] = [5, 4, 3, 2, 1]
    const allOn = jlptAll.every((l) => levels.includes(l))
    const beyond: WordLevel[] = levels.includes(0) ? [0] : []
    setLevels(allOn ? beyond : [...jlptAll, ...beyond])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Vocabulary</h1>
        {results && (
          <span className="text-xs text-muted-foreground">
            {results.total.toLocaleString()} word{results.total === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <SearchBox
        value={search.q ?? ''}
        onChange={(q) => setSearch({ q: q || undefined })}
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
          <Chip
            active={levels.includes(0)}
            onClick={() => toggleLevel(0)}
            title="every other JMdict word, beyond the JLPT lists"
          >
            Beyond
          </Chip>
        </ChipGroup>
        <ChipGroup
          label="Type"
          onLabelClick={() => setSearch({ pos: undefined })}
          labelTitle="show all word types"
        >
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
          <VocabTable words={results.entries} />
        </>
      )}
    </div>
  )
}
