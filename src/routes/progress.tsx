import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useLocation, useNavigate } from '@tanstack/react-router'
import { toHiragana } from 'wanakana'
import { STATUS_LABELS, StatusBadge } from '@/components/progress/StatusBadge'
import { SyncStatusInline } from '@/components/sync/SyncStatusInline'
import { Button } from '@/components/ui/button'
import { Chip, ChipGroup } from '@/components/ui/chip'
import { Furigana } from '@/components/verbs/Furigana'
import { SearchBox } from '@/components/verbs/SearchBox'
import { FORM_LABELS } from '@/lib/conjugation'
import { loadVerbLevels, loadVocabLevels } from '@/lib/data/loader'
import type { VerbEntry, VocabEntry } from '@/lib/data/types'
import { accuracyOf, formBreakdown, wordStatus, type WordStatus } from '@/lib/progress/analytics'
import { useProgress } from '@/lib/progress/context'
import type { VerbStat } from '@/lib/progress/store'
import { rowClickGuard } from '@/lib/row-click'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/progress')({
  component: ProgressPage,
})

// same visible-row budget as the word lists (ruby is expensive to render)
const PAGE = 100
const TREND_SESSIONS = 30

interface WordRow {
  id: string
  stat: VerbStat
  word: VerbEntry | VocabEntry
  /** which detail route the row links to */
  isVerb: boolean
  accuracy: number
  status: WordStatus
}

type SortKey = 'weakest' | 'practiced' | 'recent'

function sortRows(rows: WordRow[], sort: SortKey): WordRow[] {
  const sorted = [...rows]
  switch (sort) {
    case 'weakest':
      return sorted.sort((a, b) => a.accuracy - b.accuracy || b.stat.seen - a.stat.seen)
    case 'practiced':
      return sorted.sort((a, b) => b.stat.seen - a.stat.seen || a.accuracy - b.accuracy)
    case 'recent':
      return sorted.sort(
        (a, b) => b.stat.lastSeen.localeCompare(a.stat.lastSeen) || b.stat.seen - a.stat.seen,
      )
  }
}

function matchesQuery(word: VerbEntry | VocabEntry, q: string): boolean {
  const query = q.trim().toLowerCase()
  if (!query) return true
  const kana = toHiragana(query)
  return (
    word.kanji.includes(query) ||
    word.kana.includes(query) ||
    toHiragana(word.kana).includes(kana) ||
    word.romaji.toLowerCase().includes(query) ||
    word.gloss.some((g) => g.toLowerCase().includes(query))
  )
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function AccuracyBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full', value < 0.6 ? 'bg-destructive/70' : 'bg-primary')}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  )
}

function ProgressPage() {
  const { progress } = useProgress()
  const navigate = useNavigate()

  const statIds = useMemo(() => Object.keys(progress.verbs), [progress.verbs])
  const hasStats = statIds.length > 0

  // resolve stat ids → entries; quizzes only draw from the JLPT levels, so
  // loading all ten level files covers every id that can appear here
  const [maps, setMaps] = useState<{
    verb: Map<string, VerbEntry>
    vocab: Map<string, VocabEntry>
  } | null>(null)
  useEffect(() => {
    if (!hasStats) return
    let alive = true
    Promise.all([loadVerbLevels([5, 4, 3, 2, 1]), loadVocabLevels([5, 4, 3, 2, 1])]).then(
      ([verbs, vocab]) => {
        if (!alive) return
        setMaps({
          verb: new Map(verbs.map((v) => [v.id, v])),
          vocab: new Map(vocab.map((w) => [w.id, w])),
        })
      },
    )
    return () => {
      alive = false
    }
  }, [hasStats])

  const resolved = useMemo(() => {
    if (!maps) return null
    const rows: WordRow[] = []
    let unresolved = 0
    for (const [id, stat] of Object.entries(progress.verbs)) {
      // the same id can exist in both datasets — the recorded kind picks
      const preferVerb = stat.kind !== 'vocab'
      const verb = maps.verb.get(id)
      const vocab = maps.vocab.get(id)
      const word = preferVerb ? (verb ?? vocab) : (vocab ?? verb)
      if (!word) {
        unresolved += 1
        continue
      }
      rows.push({
        id,
        stat,
        word,
        isVerb: word === verb,
        accuracy: accuracyOf(stat),
        status: wordStatus(stat),
      })
    }
    return { rows, unresolved }
  }, [maps, progress.verbs])

  // ---- word-table controls --------------------------------------------------
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('weakest')
  // multi-select filters; empty = no constraint (site-wide convention)
  const [kinds, setKinds] = useState<('verb' | 'vocab')[]>([])
  const [statuses, setStatuses] = useState<WordStatus[]>([])
  const [visible, setVisible] = useState(PAGE)

  const toggleIn = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

  const filtered = useMemo(() => {
    if (!resolved) return null
    let rows = resolved.rows
    if (kinds.length > 0) rows = rows.filter((r) => kinds.includes(r.isVerb ? 'verb' : 'vocab'))
    if (statuses.length > 0) rows = rows.filter((r) => statuses.includes(r.status))
    if (q) rows = rows.filter((r) => matchesQuery(r.word, q))
    return sortRows(rows, sort)
  }, [resolved, kinds, statuses, q, sort])

  // new filter/sort → back to one page
  useEffect(() => setVisible(PAGE), [q, sort, kinds, statuses])

  const forms = useMemo(() => formBreakdown(progress), [progress])
  const trend = useMemo(() => progress.sessions.slice(-TREND_SESSIONS), [progress.sessions])

  // dashboard cards deep-link to a section — scroll once the data is in
  const hash = useLocation({ select: (l) => l.hash.replace(/^#/, '') })
  const ready = filtered !== null
  useEffect(() => {
    if (hash && ready) document.getElementById(hash)?.scrollIntoView()
  }, [hash, ready])

  const totals = useMemo(() => {
    const rows = resolved?.rows ?? []
    const seen = rows.reduce((a, r) => a + r.stat.seen, 0)
    const correct = rows.reduce((a, r) => a + r.stat.correct, 0)
    return {
      words: rows.length,
      seen,
      correct,
      weak: rows.filter((r) => r.status === 'weak').length,
      solid: rows.filter((r) => r.status === 'solid').length,
    }
  }, [resolved])

  if (!hasStats) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-semibold">Progress</h1>
        <p className="mt-3 text-muted-foreground">
          Nothing to show yet — finish a quiz and every word you answer will be
          tracked here: how often you met it, how often you got it right, and
          where you're weakest.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button asChild>
            <Link to="/quiz">Conjugation Quiz</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/quiz/vocab">Vocabulary Quiz</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every quizzed word, tracked in this browser. Weakest first — that's
            what to review next.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button asChild>
            <Link to="/quiz">Start a Quiz</Link>
          </Button>
          <SyncStatusInline />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <SummaryCard label="Words practiced" value={String(totals.words)} />
        <SummaryCard
          label="Answer accuracy"
          value={totals.seen > 0 ? `${Math.round((totals.correct / totals.seen) * 100)}%` : '—'}
          sub={`${totals.correct}/${totals.seen} answers`}
        />
        <SummaryCard label="Weak words" value={String(totals.weak)} sub="review these" />
        <SummaryCard label="Solid words" value={String(totals.solid)} sub="keep it up" />
      </div>

      {trend.length > 1 && (
        <section id="sessions" className="scroll-mt-16">
          <h2 className="mb-2 text-lg font-semibold">Recent Sessions</h2>
          <div className="flex h-20 items-end gap-1 rounded-lg border p-3">
            {trend.map((s, i) => {
              const acc = s.total > 0 ? s.correct / s.total : 0
              return (
                <div
                  key={i}
                  className={cn(
                    'max-w-4 flex-1 rounded-sm',
                    acc < 0.6 ? 'bg-destructive/60' : 'bg-primary/70',
                  )}
                  style={{ height: `${Math.max(8, Math.round(acc * 100))}%` }}
                  title={`${s.date} · ${s.kind ?? 'verb'} quiz · ${s.correct}/${s.total}`}
                />
              )
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Accuracy per session, oldest to newest (last {trend.length} sessions).
          </p>
        </section>
      )}

      {forms.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Conjugation Forms</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Accuracy per asked form in the conjugation quiz, weakest first.
          </p>
          <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {forms.map((row) => (
              <div key={row.form}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    {FORM_LABELS[row.form].label}{' '}
                    <span lang="ja" className="text-xs text-muted-foreground">
                      {FORM_LABELS[row.form].ja}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(row.accuracy * 100)}% · {row.correct}/{row.seen}
                  </span>
                </div>
                <AccuracyBar value={row.accuracy} className="mt-1" />
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="words" className="scroll-mt-16 space-y-3">
        <h2 className="text-lg font-semibold">Words</h2>
        <SearchBox value={q} onChange={setQ} placeholder="Search your practiced words…" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ChipGroup label="Sort">
            <Chip active={sort === 'weakest'} onClick={() => setSort('weakest')}>
              Weakest
            </Chip>
            <Chip active={sort === 'practiced'} onClick={() => setSort('practiced')}>
              Most Practiced
            </Chip>
            <Chip active={sort === 'recent'} onClick={() => setSort('recent')}>
              Recent
            </Chip>
          </ChipGroup>
          <ChipGroup
            label="Type"
            onLabelClick={() =>
              setKinds(kinds.length === 2 ? [] : ['verb', 'vocab'])
            }
            labelTitle="select/deselect both types"
          >
            <Chip
              active={kinds.includes('verb')}
              onClick={() => setKinds(toggleIn(kinds, 'verb'))}
            >
              Verbs
            </Chip>
            <Chip
              active={kinds.includes('vocab')}
              onClick={() => setKinds(toggleIn(kinds, 'vocab'))}
            >
              Vocabulary
            </Chip>
          </ChipGroup>
          <ChipGroup
            label="Status"
            onLabelClick={() =>
              setStatuses(
                statuses.length === 4 ? [] : ['weak', 'learning', 'solid', 'new'],
              )
            }
            labelTitle="select/deselect all statuses"
          >
            {(['weak', 'learning', 'solid', 'new'] as const).map((s) => (
              <Chip key={s} active={statuses.includes(s)} onClick={() => setStatuses(toggleIn(statuses, s))}>
                {STATUS_LABELS[s]}
              </Chip>
            ))}
          </ChipGroup>
        </div>

        {filtered === null ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No practiced words match these filters.
          </div>
        ) : (
          <div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="sticky top-12 z-10 border-b bg-background text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Word</th>
                  <th className="hidden py-1.5 pr-2 font-medium sm:table-cell">Meaning</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Seen</th>
                  <th className="py-1.5 pr-2 font-medium">Accuracy</th>
                  <th className="py-1.5 pr-2 font-medium">Status</th>
                  <th className="hidden py-1.5 font-medium md:table-cell">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, visible).map((row) => (
                  <tr
                    key={`${row.isVerb ? 'v' : 'w'}${row.id}`}
                    className="group cursor-pointer border-b border-border/60 hover:bg-muted/50"
                    onClick={(e) => {
                      if (rowClickGuard(e)) return
                      if (row.isVerb) navigate({ to: '/verbs/$verbId', params: { verbId: row.id } })
                      else navigate({ to: '/vocab/$wordId', params: { wordId: row.id } })
                    }}
                  >
                    <td className="py-0 pr-2">
                      {row.isVerb ? (
                        <Link
                          to="/verbs/$verbId"
                          params={{ verbId: row.id }}
                          className="flex items-center py-1.5 text-base leading-snug"
                        >
                          <Furigana segments={row.word.furigana} />
                        </Link>
                      ) : (
                        <Link
                          to="/vocab/$wordId"
                          params={{ wordId: row.id }}
                          className="flex items-center py-1.5 text-base leading-snug"
                        >
                          <Furigana segments={row.word.furigana} />
                        </Link>
                      )}
                    </td>
                    <td className="hidden max-w-0 truncate py-1.5 pr-2 text-muted-foreground sm:table-cell" style={{ width: '35%' }}>
                      {row.word.gloss.join('; ')}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-muted-foreground tabular-nums">
                      {row.stat.seen}×
                    </td>
                    <td className="py-1.5 pr-2">
                      <div
                        className="flex items-center gap-2"
                        title={`${row.stat.correct} correct, ${row.stat.wrong} wrong`}
                      >
                        <span className="w-9 text-right text-muted-foreground tabular-nums">
                          {Math.round(row.accuracy * 100)}%
                        </span>
                        <AccuracyBar value={row.accuracy} className="hidden w-16 sm:block" />
                      </div>
                    </td>
                    <td className="py-1.5 pr-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="hidden py-1.5 text-muted-foreground tabular-nums md:table-cell">
                      {row.stat.lastSeen}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between py-3 text-xs text-muted-foreground">
              <span>
                {Math.min(visible, filtered.length)} of {filtered.length} words
              </span>
              {filtered.length > visible && (
                <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
                  Show More
                </Button>
              )}
            </div>
            {resolved && resolved.unresolved > 0 && (
              <p className="text-xs text-muted-foreground">
                {resolved.unresolved} practiced word
                {resolved.unresolved === 1 ? ' is' : 's are'} no longer in the current dataset
                and can't be shown.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
