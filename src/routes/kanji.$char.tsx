import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/layout/BackButton'
import { StrokeOrder } from '@/components/kanji/StrokeOrder'
import { Furigana } from '@/components/verbs/Furigana'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import { findKanjiChars, findKanjiWords } from '@/lib/data/loader'
import type { KanjiEntry, KanjiWordRow, WordLevel } from '@/lib/data/types'
import { rowClickGuard } from '@/lib/row-click'

export const Route = createFileRoute('/kanji/$char')({
  loader: async ({ params }) => {
    const found = await findKanjiChars([params.char])
    const entry = found[params.char]
    if (!entry) throw notFound()
    // components resolved here so the section renders without a second load
    const compChars = (entry.components ?? []).filter((c) => c !== entry.char)
    const compMap = compChars.length > 0 ? await findKanjiChars(compChars) : {}
    const components = compChars.map((c) => ({
      char: c,
      entry: compMap[c] as KanjiEntry | undefined,
    }))
    return { entry, components }
  },
  component: KanjiDetailPage,
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-muted-foreground">This kanji isn&apos;t in the dataset.</p>
      <Link
        to="/kanji"
        className="mt-3 inline-block text-primary underline-offset-2 hover:underline"
      >
        Back to the kanji list
      </Link>
    </div>
  ),
})

function gradeLabel(grade: number | null): string | null {
  if (grade === null) return null
  if (grade <= 6) return `taught in grade ${grade} (kyōiku)`
  if (grade === 8) return 'taught in secondary school (jōyō)'
  return 'name-use kanji (jinmeiyō)'
}

const WORDS_PAGE = 50

function KanjiDetailPage() {
  const { entry, components } = Route.useLoaderData()
  const navigate = useNavigate()

  // precomputed at pack time (one small codepoint shard, pre-sorted) — the
  // page used to fetch all ten JLPT level files just to filter them here
  const [words, setWords] = useState<KanjiWordRow[] | null>(null)
  useEffect(() => {
    let alive = true
    findKanjiWords(entry.char).then((rows) => {
      if (alive) setWords(rows)
    })
    return () => {
      alive = false
    }
  }, [entry.char])

  const [visible, setVisible] = useState(WORDS_PAGE)
  useEffect(() => setVisible(WORDS_PAGE), [entry.char])

  const grade = gradeLabel(entry.grade)
  const linkedComponents = useMemo(
    () => components.filter((c) => c.entry),
    [components],
  )

  return (
    <div className="space-y-8">
      <header>
        <div className="mb-2">
          <BackButton fallback="/kanji" label="Kanji" />
        </div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <span lang="ja" className="text-8xl leading-none">
            {entry.char}
          </span>
          <div className="min-w-0">
            <p className="text-xl">{entry.meanings.join(', ')}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <LevelBadge level={(entry.jlpt ?? 0) as WordLevel} />
              <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
                {entry.strokes} strokes
              </Badge>
              {entry.freq !== null && (
                <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
                  freq #{entry.freq}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {entry.freq !== null
                ? `Common — the #${entry.freq} most frequent of the 2,501 newspaper-ranked kanji`
                : 'Not among the 2,501 frequency-ranked kanji'}
              {grade ? ` · ${grade}` : ''}
              {entry.jlpt === null ? ' · beyond the JLPT kanji lists' : ''}
            </p>
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Readings</h2>
        <dl className="space-y-2 text-base">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <dt className="w-24 shrink-0 text-sm text-muted-foreground">
              On&apos;yomi <span lang="ja">音</span>
            </dt>
            <dd lang="ja">{entry.on.length > 0 ? entry.on.join('、') : '—'}</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <dt className="w-24 shrink-0 text-sm text-muted-foreground">
              Kun&apos;yomi <span lang="ja">訓</span>
            </dt>
            <dd lang="ja">{entry.kun.length > 0 ? entry.kun.join('、') : '—'}</dd>
          </div>
        </dl>
        {entry.kun.some((r) => r.includes('.')) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Dots split a kun reading from its okurigana: た.べる → 食べる.
          </p>
        )}
      </section>

      <StrokeOrder char={entry.char} heading="Stroke Order" frameClass="size-14" />

      {components.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Components</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            The visual parts this character is built from (KRADFILE decomposition).
          </p>
          <div className="flex flex-wrap gap-2">
            {components.map(({ char, entry: comp }) =>
              comp ? (
                <Link
                  key={char}
                  to="/kanji/$char"
                  params={{ char }}
                  className="flex items-center gap-2.5 rounded-md border p-2.5 transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
                >
                  <span lang="ja" className="text-3xl leading-none">
                    {char}
                  </span>
                  <span className="max-w-40 text-sm text-muted-foreground">
                    {comp.meanings.slice(0, 2).join(', ')}
                  </span>
                </Link>
              ) : (
                <span
                  key={char}
                  className="flex items-center rounded-md border p-2.5"
                  title="no dictionary entry for this component"
                >
                  <span lang="ja" className="text-3xl leading-none">
                    {char}
                  </span>
                </span>
              ),
            )}
          </div>
          {linkedComponents.length < components.length && (
            <p className="mt-2 text-xs text-muted-foreground">
              Components without a card link have no KANJIDIC2 entry of their own.
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Words Using {entry.char}</h2>
        {words === null ? (
          <div className="py-4 text-sm text-muted-foreground">Loading words…</div>
        ) : words.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No JLPT-listed verbs or vocabulary use this kanji.
          </p>
        ) : (
          <div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Word</th>
                  <th className="hidden py-1.5 pr-2 font-medium sm:table-cell">Reading</th>
                  <th className="py-1.5 pr-2 font-medium">Meaning</th>
                  <th className="py-1.5 pr-2 font-medium">Type</th>
                  <th className="py-1.5 font-medium">Level</th>
                </tr>
              </thead>
              <tbody>
                {words.slice(0, visible).map(([id, isVerb, jlpt, kana, gloss, furigana]) => (
                  <tr
                    key={`${isVerb ? 'v' : 'w'}${id}`}
                    className="group cursor-pointer border-b border-border/60 hover:bg-muted/50"
                    onClick={(e) => {
                      if (rowClickGuard(e)) return
                      if (isVerb) navigate({ to: '/verbs/$verbId', params: { verbId: id } })
                      else navigate({ to: '/vocab/$wordId', params: { wordId: id } })
                    }}
                  >
                    <td className="py-0 pr-2">
                      {isVerb ? (
                        <Link
                          to="/verbs/$verbId"
                          params={{ verbId: id }}
                          className="flex items-center py-1.5 text-base leading-snug"
                        >
                          <Furigana segments={furigana} />
                        </Link>
                      ) : (
                        <Link
                          to="/vocab/$wordId"
                          params={{ wordId: id }}
                          className="flex items-center py-1.5 text-base leading-snug"
                        >
                          <Furigana segments={furigana} />
                        </Link>
                      )}
                    </td>
                    <td lang="ja" className="hidden py-1.5 pr-2 text-muted-foreground sm:table-cell">
                      {kana}
                    </td>
                    <td className="max-w-0 truncate py-1.5 pr-2 text-muted-foreground" style={{ width: '40%' }}>
                      {gloss}
                    </td>
                    <td className="py-1.5 pr-2">
                      <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
                        {isVerb ? 'Verb' : 'Vocab'}
                      </Badge>
                    </td>
                    <td className="py-1.5">
                      <LevelBadge level={jlpt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between py-3 text-xs text-muted-foreground">
              <span>
                {Math.min(visible, words.length)} of {words.length} word
                {words.length === 1 ? '' : 's'}
              </span>
              {words.length > visible && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisible((v) => v + WORDS_PAGE)}
                >
                  Show More
                </Button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
