import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Chip, ChipGroup } from '@/components/ui/chip'
import { Furigana } from '@/components/verbs/Furigana'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import { loadVocabLevels } from '@/lib/data/loader'
import type { JlptLevel, VocabEntry } from '@/lib/data/types'

interface AntonymsSearch {
  /** e.g. "5,4" — omitted means all levels, so no pair is hidden by level */
  levels?: string
}

const UNPAIRED_PAGE = 100

const isAdjective = (w: VocabEntry) => w.pos === 'adj-i' || w.pos === 'adj-na'

export const Route = createFileRoute('/vocab/antonyms')({
  validateSearch: (search: Record<string, unknown>): AntonymsSearch => {
    const out: AntonymsSearch = {}
    // ?levels=5 arrives as a number (router JSON-parses params) — normalize
    const levels = String(search.levels ?? '')
    if (/^[1-5](,[1-5])*$/.test(levels)) out.levels = levels
    return out
  },
  component: AntonymsPage,
})

function parseLevels(levels: string | undefined): JlptLevel[] {
  if (!levels) return [5, 4, 3, 2, 1]
  return [...new Set(levels.split(',').map(Number))].sort((a, b) => b - a) as JlptLevel[]
}

function AntonymCell({ word }: { word: VocabEntry | null }) {
  if (!word) {
    return <div className="p-3 text-center text-muted-foreground/50">—</div>
  }
  return (
    <Link
      to="/vocab/$wordId"
      params={{ wordId: word.id }}
      className="flex items-baseline gap-2.5 p-3 transition-colors duration-100 hover:bg-primary/5"
    >
      <Furigana segments={word.furigana} className="text-lg" />
      <span className="min-w-0 truncate text-xs text-muted-foreground">
        {word.gloss[0]}
      </span>
      <LevelBadge level={word.jlpt} className="ml-auto shrink-0" />
    </Link>
  )
}

function AntonymsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const levels = useMemo(() => parseLevels(search.levels), [search.levels])
  const [unpairedShown, setUnpairedShown] = useState(UNPAIRED_PAGE)

  // all levels load so a partner from a harder level still shows up
  const [all, setAll] = useState<VocabEntry[] | null>(null)
  useEffect(() => {
    let alive = true
    loadVocabLevels([5, 4, 3, 2, 1]).then((list) => {
      if (alive) setAll(list)
    })
    return () => {
      alive = false
    }
  }, [])

  const pairs = useMemo(() => {
    if (!all) return null
    const byId = new Map(all.map((w) => [w.id, w]))
    // strictly adjectives — both columns (this page only loads JLPT tiers)
    const rows = all.filter(
      (w) => isAdjective(w) && levels.includes(w.jlpt as JlptLevel),
    )
    const used = new Set<string>()
    const paired: [VocabEntry, VocabEntry][] = []
    const alone: VocabEntry[] = []
    for (const word of rows) {
      if (used.has(word.id)) continue
      used.add(word.id)
      const partner = (word.antonyms ?? [])
        .map((id) => byId.get(id))
        .find((w): w is VocabEntry => Boolean(w && isAdjective(w)))
      if (partner) {
        used.add(partner.id)
        paired.push([word, partner])
      } else {
        alone.push(word)
      }
    }
    return { paired, alone }
  }, [all, levels])

  const setSearch = (patch: Partial<AntonymsSearch>) => {
    setUnpairedShown(UNPAIRED_PAGE)
    navigate({ search: { ...search, ...patch }, replace: true })
  }

  const toggleLevel = (level: JlptLevel) => {
    const has = levels.includes(level)
    const next = has ? levels.filter((l) => l !== level) : [...levels, level]
    if (next.length === 0) return
    const sorted = next.sort((a, b) => b - a)
    setSearch({ levels: sorted.length === 5 ? undefined : sorted.join(',') })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Adjective antonyms</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Learning adjectives in opposite pairs makes both stick. Click a word for
          its detail page.
        </p>
      </div>
      <ChipGroup label="Level">
        {([5, 4, 3, 2, 1] as const).map((level) => (
          <Chip key={level} active={levels.includes(level)} onClick={() => toggleLevel(level)}>
            N{level}
          </Chip>
        ))}
      </ChipGroup>

      {pairs === null ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-2 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              <div className="p-2 pl-3">Adjective</div>
              <div className="border-l p-2 pl-3">Antonym</div>
            </div>
            {pairs.paired.map(([left, right]) => (
              <div
                key={left.id}
                className="grid grid-cols-2 border-b border-border/60 last:border-b-0"
              >
                <AntonymCell word={left} />
                <div className="border-l border-border/60">
                  <AntonymCell word={right} />
                </div>
              </div>
            ))}
            {pairs.alone.slice(0, unpairedShown).map((word) => (
              <div
                key={word.id}
                className="grid grid-cols-2 border-b border-border/60 last:border-b-0"
              >
                <AntonymCell word={word} />
                <div className="border-l border-border/60">
                  <AntonymCell word={null} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {pairs.paired.length} antonym pair{pairs.paired.length === 1 ? '' : 's'} ·{' '}
              {pairs.alone.length} without a known antonym
              {pairs.alone.length > unpairedShown &&
                ` (showing ${unpairedShown})`}
            </span>
            {pairs.alone.length > unpairedShown && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUnpairedShown((v) => v + UNPAIRED_PAGE)}
              >
                Show More
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
