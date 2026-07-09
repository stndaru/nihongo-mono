import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { GrammarStructure } from '@/components/grammar/GrammarStructure'
import { RelatedGrammar, type ResolvedRelation } from '@/components/grammar/RelatedGrammar'
import { BackButton } from '@/components/layout/BackButton'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import { ExampleSentences } from '@/components/verbs/ExampleSentences'
import { findGrammar, loadGrammarLevels } from '@/lib/data/loader'
import type { GrammarEntry, GrammarRelation } from '@/lib/data/types'

/**
 * Relations resolve-and-filter (like resolveIds on the vocab detail page):
 * a slug whose level isn't authored yet simply renders no card. findGrammar
 * already loaded every level, so this is in-memory.
 */
function resolveRelations(
  relations: GrammarRelation[],
  all: GrammarEntry[],
): ResolvedRelation[] {
  return relations.flatMap((rel) => {
    const entry = all.find((g) => g.slug === rel.slug)
    return entry ? [{ entry, note: rel.note }] : []
  })
}

export const Route = createFileRoute('/grammar/$slug')({
  loader: async ({ params }) => {
    const entry = await findGrammar(params.slug)
    if (!entry) throw notFound()
    const all = await loadGrammarLevels([5, 4, 3, 2, 1]) // already cached by findGrammar
    return {
      entry,
      synonyms: resolveRelations(entry.synonyms, all),
      antonyms: resolveRelations(entry.antonyms, all),
      related: resolveRelations(entry.related, all),
    }
  },
  component: GrammarDetailPage,
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-muted-foreground">This grammar point doesn&apos;t exist.</p>
      <Link
        to="/grammar"
        className="mt-3 inline-block text-primary underline-offset-2 hover:underline"
      >
        Back to the grammar list
      </Link>
    </div>
  ),
})

function GrammarDetailPage() {
  const { entry, synonyms, antonyms, related } = Route.useLoaderData()
  return (
    <div className="space-y-8">
      <header>
        <div className="mb-2">
          <BackButton fallback="/grammar" label="Grammar Points" />
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <span lang="ja" className="text-4xl leading-tight">
            {entry.title}
          </span>
          {entry.kana !== entry.title && (
            <span lang="ja" className="text-lg text-muted-foreground">
              {entry.kana}
            </span>
          )}
          <span className="text-sm text-muted-foreground">{entry.romaji}</span>
        </div>
        <p className="mt-2 text-base">{entry.meaning}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <LevelBadge level={entry.jlpt} />
          {entry.levelNote && (
            <span className="text-xs text-muted-foreground">· {entry.levelNote}</span>
          )}
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">What It Does</h2>
        <p className="text-[0.95rem] leading-relaxed">{entry.summary}</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">How to Use</h2>
        <GrammarStructure structure={entry.structure} />
      </section>

      {entry.pitfalls.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Watch Out</h2>
          <ul className="space-y-2">
            {entry.pitfalls.map((pitfall, i) => (
              <li key={i} className="flex gap-2.5 rounded-md border p-3 text-sm leading-relaxed">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
                <span>{pitfall}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Example Sentences</h2>
        <ExampleSentences examples={entry.examples} />
      </section>

      <RelatedGrammar title="Similar Grammar" relations={synonyms} />
      <RelatedGrammar title="Opposite Grammar" relations={antonyms} />
      <RelatedGrammar title="See Also" relations={related} />
    </div>
  )
}
