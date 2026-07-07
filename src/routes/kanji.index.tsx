import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { toHiragana, toKatakana } from 'wanakana'
import { Button } from '@/components/ui/button'
import { Chip, ChipGroup } from '@/components/ui/chip'
import { SearchBox } from '@/components/verbs/SearchBox'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import { loadKanjiCore, loadKanjiExt } from '@/lib/data/loader'
import type { KanjiEntry, WordLevel } from '@/lib/data/types'
import { rowClickGuard } from '@/lib/row-click'

interface KanjiSearch {
  q?: string
  /** e.g. "5,4" — omitted means N5 only; 0 = kanji outside the JLPT lists */
  levels?: string
}

export const Route = createFileRoute('/kanji/')({
  validateSearch: (search: Record<string, unknown>): KanjiSearch => {
    const out: KanjiSearch = {}
    if (typeof search.q === 'string' && search.q) out.q = search.q
    // ?levels=5 arrives as a number (router JSON-parses params) — normalize.
    // 'none' = all levels deselected via the Level label toggle.
    const levels = String(search.levels ?? '')
    if (levels === 'none' || /^[0-5](,[0-5])*$/.test(levels)) out.levels = levels
    return out
  },
  component: KanjiListPage,
})

const PAGE = 100

function parseLevels(levels: string | undefined): WordLevel[] {
  if (levels === 'none') return []
  if (!levels) return [5]
  return [...new Set(levels.split(',').map(Number))].sort((a, b) => b - a) as WordLevel[]
}

/** Okurigana dots (た.べる) split stem from ending — drop them for matching. */
function bare(reading: string): string {
  return reading.replace(/[.-]/g, '')
}

/**
 * Rank a kanji against a query; lower is better, null = no match. Queries
 * can be the character itself, a reading (kana or romaji), or English.
 */
function scoreKanji(entry: KanjiEntry, q: string, hira: string, kata: string): number | null {
  if (entry.char === q) return 0
  for (const r of entry.kun) {
    const k = bare(r)
    if (k === hira) return 1
    if (k.startsWith(hira)) return 2
  }
  for (const r of entry.on) {
    if (r === kata) return 1
    if (r.startsWith(kata)) return 2
  }
  const lower = q.toLowerCase()
  for (const m of entry.meanings) {
    const ml = m.toLowerCase()
    if (ml === lower) return 3
    if (ml.startsWith(lower)) return 4
    if (ml.includes(lower)) return 5
  }
  return null
}

/** Default order: easiest JLPT level first, then most frequent in print. */
function compareKanji(a: KanjiEntry, b: KanjiEntry): number {
  const la = a.jlpt ?? 0
  const lb = b.jlpt ?? 0
  if (la !== lb) return lb - la
  if (a.freq !== b.freq) return (a.freq ?? Infinity) - (b.freq ?? Infinity)
  return a.strokes - b.strokes
}

function KanjiListPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const levels = useMemo(() => parseLevels(search.levels), [search.levels])

  // the core file (JLPT + frequency-ranked) is always enough for N5–N1;
  // the ~7.8k rarest characters load from shards only when Beyond is on
  const [core, setCore] = useState<KanjiEntry[] | null>(null)
  useEffect(() => {
    let alive = true
    loadKanjiCore().then((map) => {
      if (alive) setCore(Object.values(map))
    })
    return () => {
      alive = false
    }
  }, [])

  const beyond = levels.includes(0)
  const [ext, setExt] = useState<KanjiEntry[] | null>(null)
  useEffect(() => {
    if (!beyond || ext) return
    let alive = true
    loadKanjiExt().then((list) => {
      if (alive) setExt(list)
    })
    return () => {
      alive = false
    }
  }, [beyond, ext])

  const extLoading = beyond && !ext

  const results = useMemo(() => {
    if (!core) return null
    const wanted = new Set(levels)
    const all = beyond && ext ? [...core, ...ext] : core
    const pool = all.filter((e) => wanted.has((e.jlpt ?? 0) as WordLevel))
    const q = (search.q ?? '').normalize('NFKC').trim()
    if (!q) return pool.sort(compareKanji)
    const hira = toHiragana(q)
    const kata = toKatakana(q)
    return pool
      .map((e) => ({ e, score: scoreKanji(e, q, hira, kata) }))
      .filter((x): x is { e: KanjiEntry; score: number } => x.score !== null)
      .sort((a, b) => a.score - b.score || compareKanji(a.e, b.e))
      .map((x) => x.e)
  }, [core, ext, beyond, levels, search.q])

  const [visible, setVisible] = useState(PAGE)
  useEffect(() => setVisible(PAGE), [results])

  const setSearch = (patch: Partial<KanjiSearch>) =>
    navigate({ to: '/kanji', search: { ...search, ...patch }, replace: true })

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
        <h1 className="text-2xl font-semibold">Kanji</h1>
        {results && (
          <span className="text-xs text-muted-foreground">
            {results.length.toLocaleString()} kanji
          </span>
        )}
      </div>
      <SearchBox
        value={search.q ?? ''}
        onChange={(q) => setSearch({ q: q || undefined })}
        placeholder="Search a kanji, reading, or meaning…"
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ChipGroup
          label="Level"
          onLabelClick={toggleAllLevels}
          labelTitle="select/deselect all JLPT levels"
        >
          {([5, 4, 3, 2, 1] as const).map((level) => (
            <Chip
              key={level}
              active={levels.includes(level)}
              onClick={() => toggleLevel(level)}
              title="community JLPT kanji lists (post-2010 five-level scale)"
            >
              N{level}
            </Chip>
          ))}
          <Chip
            active={levels.includes(0)}
            onClick={() => toggleLevel(0)}
            title="every other KANJIDIC2 character, beyond the JLPT lists"
          >
            Beyond
          </Chip>
        </ChipGroup>
      </div>
      {extLoading && (
        <p className="text-xs text-muted-foreground">
          Loading the rare kanji… (a one-time download, cached afterwards)
        </p>
      )}
      {results === null ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : results.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No kanji match — try widening the level filter or changing the search.
        </div>
      ) : (
        <div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="sticky top-12 z-10 border-b bg-background text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">Kanji</th>
                <th className="py-1.5 pr-2 font-medium">Meaning</th>
                <th className="hidden py-1.5 pr-2 font-medium md:table-cell">On</th>
                <th className="hidden py-1.5 pr-2 font-medium md:table-cell">Kun</th>
                <th className="hidden py-1.5 pr-2 text-right font-medium sm:table-cell">Strokes</th>
                <th className="py-1.5 pr-2 font-medium">Level</th>
                <th className="py-1.5 font-medium" title="frequency-ranked in newspapers">
                  <span className="sr-only">Common</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, visible).map((entry) => (
                <tr
                  key={entry.char}
                  className="group cursor-pointer border-b border-border/60 hover:bg-muted/50"
                  onClick={(e) => {
                    if (rowClickGuard(e)) return
                    navigate({ to: '/kanji/$char', params: { char: entry.char } })
                  }}
                >
                  <td className="py-0 pr-2">
                    <Link
                      to="/kanji/$char"
                      params={{ char: entry.char }}
                      lang="ja"
                      className="flex items-center py-1 text-2xl leading-snug"
                    >
                      {entry.char}
                    </Link>
                  </td>
                  <td className="max-w-0 truncate py-1.5 pr-2 text-muted-foreground" style={{ width: '30%' }}>
                    {entry.meanings.join(', ')}
                  </td>
                  <td lang="ja" className="hidden max-w-0 truncate py-1.5 pr-2 text-muted-foreground md:table-cell" style={{ width: '15%' }}>
                    {entry.on.join('、')}
                  </td>
                  <td lang="ja" className="hidden max-w-0 truncate py-1.5 pr-2 text-muted-foreground md:table-cell" style={{ width: '20%' }}>
                    {entry.kun.join('、')}
                  </td>
                  <td className="hidden py-1.5 pr-2 text-right text-muted-foreground tabular-nums sm:table-cell">
                    {entry.strokes}
                  </td>
                  <td className="py-1.5 pr-2">
                    <LevelBadge level={(entry.jlpt ?? 0) as WordLevel} />
                  </td>
                  <td className="w-4 py-1.5">
                    {entry.freq !== null && (
                      <span
                        className="block size-1.5 rounded-full bg-primary/60"
                        title={`common — frequency rank #${entry.freq} of 2,501`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between py-3 text-xs text-muted-foreground">
            <span>
              {Math.min(visible, results.length)} of {results.length.toLocaleString()} kanji
            </span>
            {results.length > visible && (
              <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
                Show More
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
