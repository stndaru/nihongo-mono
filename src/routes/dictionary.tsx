import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { DictionaryTable, type DictRow } from '@/components/dictionary/DictionaryTable'
import { Chip, ChipGroup } from '@/components/ui/chip'
import { SearchBox } from '@/components/verbs/SearchBox'
import { POS_LABELS } from '@/components/vocab/PosBadge'
import { searchVerbRows, searchVocabRows } from '@/lib/data/ext-search'
import {
  loadVerbExtIndex,
  loadVerbLevels,
  loadVocabExtIndex,
  loadVocabLevels,
} from '@/lib/data/loader'
import { filterVerbs, searchWordsScored, type VerbFilterState } from '@/lib/data/search'
import type {
  JlptLevel,
  VerbEntry,
  VerbIndexRow,
  VocabEntry,
  VocabIndexRow,
  VocabPos,
  WordLevel,
} from '@/lib/data/types'
import type { ClassGroup } from '@/lib/conjugation'

/**
 * The combined dictionary: every JLPT verb + vocabulary entry in one table
 * (plus the Beyond tier on demand), filtered by a two-layer system — top
 * word types with contextual sub-filters (verb class/ending/transitivity,
 * い/な adjectives) behind a "More Filters" toggle.
 */

const TYPES = ['verb', 'noun', 'adjective', 'adverb', 'other'] as const
type TopType = (typeof TYPES)[number]
const TYPE_LABELS: Record<TopType, string> = {
  verb: 'Verb',
  noun: 'Noun',
  adjective: 'Adjective',
  adverb: 'Adverb',
  other: 'Other',
}

const GROUPS: ClassGroup[] = ['godan', 'ichidan', 'suru', 'kuru']
const GROUP_LABELS: Record<ClassGroup, string> = {
  godan: 'Godan',
  ichidan: 'Ichidan',
  suru: 'する',
  kuru: '来る',
}
const ENDINGS = ['ru', 'other'] as const
const TRANS = ['vt', 'vi'] as const
const ADJ = ['i', 'na'] as const

/** POS bucketed under the "Other" top type (everything not noun/adj/adverb). */
const OTHER_POS: VocabPos[] = [
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

interface DictionarySearch {
  q?: string
  /** e.g. "5,4" — omitted means N5 only; 0 = beyond-JLPT; 'none' = all off */
  levels?: string
  /** csv multi-selects — omitted means no constraint */
  types?: string
  group?: string
  ending?: string
  trans?: string
  adj?: string
  /** "Other" sub-filter: specific POS within the Other bucket */
  pos?: string
  common?: boolean
}

function csvOf<T extends string>(raw: unknown, allowed: readonly T[]): string {
  return String(raw ?? '')
    .split(',')
    .filter((x): x is T => (allowed as readonly string[]).includes(x))
    .join(',')
}

function parseCsv<T extends string>(raw: string | undefined): T[] {
  return raw ? (raw.split(',') as T[]) : []
}

/** Beyond-JLPT matches materialized per query — keeps 228k rows off the heap. */
const EXT_LIMIT = 1000

export const Route = createFileRoute('/dictionary')({
  validateSearch: (search: Record<string, unknown>): DictionarySearch => {
    const out: DictionarySearch = {}
    if (typeof search.q === 'string' && search.q) out.q = search.q
    const levels = String(search.levels ?? '')
    if (levels === 'none' || /^[0-5](,[0-5])*$/.test(levels)) out.levels = levels
    const types = csvOf(search.types, TYPES)
    if (types) out.types = types
    const group = csvOf(search.group, GROUPS)
    if (group) out.group = group
    const ending = csvOf(search.ending, ENDINGS)
    if (ending) out.ending = ending
    const trans = csvOf(search.trans, TRANS)
    if (trans) out.trans = trans
    const adj = csvOf(search.adj, ADJ)
    if (adj) out.adj = adj
    const pos = csvOf(search.pos, OTHER_POS)
    if (pos) out.pos = pos
    if (search.common === true) out.common = true
    return out
  },
  component: DictionaryPage,
})

function parseLevels(levels: string | undefined): WordLevel[] {
  if (levels === 'none') return []
  if (!levels) return [5]
  return [...new Set(levels.split(',').map(Number))].sort((a, b) => b - a) as WordLevel[]
}

function DictionaryPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const levels = useMemo(() => parseLevels(search.levels), [search.levels])
  const types = useMemo(() => parseCsv<TopType>(search.types), [search.types])
  const groups = useMemo(() => parseCsv<ClassGroup>(search.group), [search.group])
  const endings = useMemo(() => parseCsv<'ru' | 'other'>(search.ending), [search.ending])
  const trans = useMemo(() => parseCsv<'vt' | 'vi'>(search.trans), [search.trans])
  const adj = useMemo(() => parseCsv<'i' | 'na'>(search.adj), [search.adj])
  const posSub = useMemo(() => parseCsv<VocabPos>(search.pos), [search.pos])

  const jlptLevels = useMemo(() => levels.filter((l): l is JlptLevel => l !== 0), [levels])
  const beyond = levels.includes(0)

  const [verbs, setVerbs] = useState<VerbEntry[] | null>(null)
  const [vocab, setVocab] = useState<VocabEntry[] | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([loadVerbLevels(jlptLevels), loadVocabLevels(jlptLevels)]).then(([v, w]) => {
      if (alive) {
        setVerbs(v)
        setVocab(w)
      }
    })
    return () => {
      alive = false
    }
  }, [jlptLevels])

  // the extended indexes load once, only when Beyond is on
  const [extVerbRows, setExtVerbRows] = useState<VerbIndexRow[] | null>(null)
  const [extVocabRows, setExtVocabRows] = useState<VocabIndexRow[] | null>(null)
  useEffect(() => {
    if (!beyond || (extVerbRows && extVocabRows)) return
    let alive = true
    Promise.all([loadVerbExtIndex(), loadVocabExtIndex()]).then(([v, w]) => {
      if (alive) {
        setExtVerbRows(v)
        setExtVocabRows(w)
      }
    })
    return () => {
      alive = false
    }
  }, [beyond, extVerbRows, extVocabRows])

  // sub-filters only apply while their parent type is selected (they're
  // hidden otherwise, so stale URL state must not silently filter)
  const verbSelected = types.length === 0 || types.includes('verb')
  const verbF: VerbFilterState = useMemo(
    () => ({
      groups: types.includes('verb') ? groups : [],
      endings: types.includes('verb') ? endings : [],
      trans: types.includes('verb') ? trans : [],
      commonOnly: search.common,
    }),
    [types, groups, endings, trans, search.common],
  )
  const adjPos = useMemo<VocabPos[]>(
    () =>
      types.includes('adjective') && adj.length > 0
        ? adj.map((a) => (a === 'i' ? 'adj-i' : 'adj-na'))
        : ['adj-i', 'adj-na'],
    [types, adj],
  )
  /** Vocab POS whitelist implied by the selected top types (undefined = all). */
  const vocabPos = useMemo<VocabPos[] | undefined>(() => {
    if (types.length === 0) return undefined
    const out: VocabPos[] = []
    if (types.includes('noun')) out.push('noun')
    if (types.includes('adjective')) out.push(...adjPos)
    if (types.includes('adverb')) out.push('adverb')
    if (types.includes('other')) out.push(...(posSub.length > 0 ? posSub : OTHER_POS))
    return out
  }, [types, adjPos, posSub])

  const results = useMemo(() => {
    if (!verbs || !vocab) return null
    const q = search.q ?? ''
    const collator = new Intl.Collator('ja')

    const verbPool = verbSelected ? filterVerbs(verbs, verbF) : []
    const vocabPool = vocab.filter((w) => {
      if (vocabPos && !vocabPos.includes(w.pos)) return false
      if (search.common && !w.common) return false
      return true
    })

    const ranked: (DictRow & { score: number })[] = [
      ...searchWordsScored(verbPool, q).map((s) => ({ word: s.word, isVerb: true, score: s.score })),
      ...searchWordsScored(vocabPool, q).map((s) => ({ word: s.word, isVerb: false, score: s.score })),
    ]
    ranked.sort(
      (a, b) =>
        a.score - b.score ||
        b.word.jlpt - a.word.jlpt ||
        Number(b.word.common) - Number(a.word.common) ||
        collator.compare(a.word.kana, b.word.kana),
    )

    if (!beyond) return { rows: ranked, total: ranked.length, extLoading: false }
    if (!extVerbRows || !extVocabRows)
      return { rows: ranked, total: ranked.length, extLoading: true }

    const extRows: DictRow[] = []
    let extTotal = 0
    if (verbSelected) {
      const ext = searchVerbRows(extVerbRows, q, verbF, EXT_LIMIT)
      extRows.push(...ext.entries.map((word) => ({ word, isVerb: true })))
      extTotal += ext.total
    }
    if (!vocabPos || vocabPos.length > 0) {
      const ext = searchVocabRows(
        extVocabRows,
        q,
        { pos: vocabPos, commonOnly: search.common },
        EXT_LIMIT,
      )
      extRows.push(...ext.entries.map((word) => ({ word, isVerb: false })))
      extTotal += ext.total
    }
    return {
      rows: [...ranked, ...extRows],
      total: ranked.length + extTotal,
      extLoading: false,
    }
  }, [verbs, vocab, search.q, search.common, verbSelected, verbF, vocabPos, beyond, extVerbRows, extVocabRows])

  const setSearch = (patch: Partial<DictionarySearch>) =>
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

  const toggleAllLevels = () => {
    const jlptAll: WordLevel[] = [5, 4, 3, 2, 1]
    const allOn = jlptAll.every((l) => levels.includes(l))
    const stayBeyond: WordLevel[] = levels.includes(0) ? [0] : []
    setLevels(allOn ? stayBeyond : [...jlptAll, ...stayBeyond])
  }

  const toggleCsv = <T extends string>(
    key: 'types' | 'group' | 'ending' | 'trans' | 'adj' | 'pos',
    list: T[],
    item: T,
  ) => {
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
    setSearch({ [key]: next.length > 0 ? next.join(',') : undefined })
  }
  const toggleAllCsv = <T extends string>(
    key: 'types' | 'group' | 'ending' | 'trans' | 'adj' | 'pos',
    list: T[],
    all: readonly T[],
  ) => {
    setSearch({
      [key]: all.every((x) => list.includes(x)) ? undefined : all.join(','),
    })
  }

  // default view shows Level + Type; everything else sits behind this toggle
  const [showMore, setShowMore] = useState(false)
  const hiddenActive =
    (types.includes('verb') ? groups.length + endings.length + trans.length : 0) +
    (types.includes('adjective') ? adj.length : 0) +
    (types.includes('other') ? posSub.length : 0) +
    (search.common ? 1 : 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Dictionary</h1>
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
            title="every other JMdict entry, beyond the JLPT lists"
          >
            Beyond
          </Chip>
        </ChipGroup>
        <ChipGroup
          label="Type"
          onLabelClick={() => toggleAllCsv('types', types, TYPES)}
          labelTitle="select/deselect all word types"
        >
          {TYPES.map((t) => (
            <Chip key={t} active={types.includes(t)} onClick={() => toggleCsv('types', types, t)}>
              {TYPE_LABELS[t]}
            </Chip>
          ))}
        </ChipGroup>
        <Chip active={showMore} onClick={() => setShowMore((v) => !v)}>
          More Filters{!showMore && hiddenActive > 0 ? ` (${hiddenActive})` : ''}
        </Chip>
      </div>
      {showMore && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2.5">
          {types.includes('verb') && (
            <>
              <ChipGroup
                label="Verb Type"
                onLabelClick={() => toggleAllCsv('group', groups, GROUPS)}
                labelTitle="select/deselect all verb types"
              >
                {GROUPS.map((g) => (
                  <Chip key={g} active={groups.includes(g)} onClick={() => toggleCsv('group', groups, g)}>
                    {GROUP_LABELS[g]}
                  </Chip>
                ))}
              </ChipGroup>
              <ChipGroup
                label="Ends"
                onLabelClick={() => toggleAllCsv('ending', endings, ENDINGS)}
                labelTitle="select/deselect all endings"
              >
                <Chip active={endings.includes('ru')} onClick={() => toggleCsv('ending', endings, 'ru')}>
                  〜る
                </Chip>
                <Chip active={endings.includes('other')} onClick={() => toggleCsv('ending', endings, 'other')}>
                  Other
                </Chip>
              </ChipGroup>
              <ChipGroup
                label="Trans."
                onLabelClick={() => toggleAllCsv('trans', trans, TRANS)}
                labelTitle="select/deselect both transitivities"
              >
                <Chip active={trans.includes('vt')} onClick={() => toggleCsv('trans', trans, 'vt')} title="transitive">
                  VT
                </Chip>
                <Chip active={trans.includes('vi')} onClick={() => toggleCsv('trans', trans, 'vi')} title="intransitive">
                  VI
                </Chip>
              </ChipGroup>
            </>
          )}
          {types.includes('adjective') && (
            <ChipGroup
              label="Adjective"
              onLabelClick={() => toggleAllCsv('adj', adj, ADJ)}
              labelTitle="select/deselect both adjective kinds"
            >
              <Chip active={adj.includes('i')} onClick={() => toggleCsv('adj', adj, 'i')}>
                い-adj
              </Chip>
              <Chip active={adj.includes('na')} onClick={() => toggleCsv('adj', adj, 'na')}>
                な-adj
              </Chip>
            </ChipGroup>
          )}
          {types.includes('other') && (
            <ChipGroup
              label="Other Types"
              onLabelClick={() => toggleAllCsv('pos', posSub, OTHER_POS)}
              labelTitle="select/deselect all other word types"
            >
              {OTHER_POS.map((p) => (
                <Chip key={p} active={posSub.includes(p)} onClick={() => toggleCsv('pos', posSub, p)}>
                  {POS_LABELS[p]}
                </Chip>
              ))}
            </ChipGroup>
          )}
          <Chip
            active={search.common === true}
            onClick={() => setSearch({ common: search.common ? undefined : true })}
          >
            Common Only
          </Chip>
          {!types.includes('verb') && !types.includes('adjective') && !types.includes('other') && (
            <span className="text-xs text-muted-foreground">
              Select the Verb, Adjective, or Other type for its specific filters.
            </span>
          )}
        </div>
      )}
      {results === null ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {results.extLoading && (
            <p className="text-xs text-muted-foreground">
              Loading the full dictionary… (a one-time download, cached afterwards)
            </p>
          )}
          {!results.extLoading && beyond && results.total > results.rows.length && (
            <p className="text-xs text-muted-foreground">
              Showing the {EXT_LIMIT.toLocaleString()} best beyond-JLPT matches per list —
              search to narrow the rest down.
            </p>
          )}
          <DictionaryTable rows={results.rows} />
        </>
      )}
    </div>
  )
}
