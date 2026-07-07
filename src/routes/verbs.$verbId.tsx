import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ConjugationTable } from '@/components/verbs/ConjugationTable'
import { Furigana } from '@/components/verbs/Furigana'
import { MeaningsAccordion } from '@/components/verbs/MeaningsAccordion'
import { KanjiBreakdown } from '@/components/verbs/KanjiBreakdown'
import { ClassBadge, LevelBadge, TransBadge } from '@/components/verbs/VerbBadges'
import { CLASS_LABELS } from '@/lib/conjugation'
import { findVerb } from '@/lib/data/loader'

export const Route = createFileRoute('/verbs/$verbId')({
  loader: async ({ params }) => {
    const verb = await findVerb(params.verbId)
    if (!verb) throw notFound()
    return verb
  },
  component: VerbDetailPage,
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-muted-foreground">This verb doesn&apos;t exist.</p>
      <Link
        to="/verbs"
        className="mt-3 inline-block text-primary underline-offset-2 hover:underline"
      >
        Back to the verb list
      </Link>
    </div>
  ),
})

function VerbDetailPage() {
  const verb = Route.useLoaderData()
  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <Furigana segments={verb.furigana} className="text-4xl leading-tight" />
          <span lang="ja" className="text-lg text-muted-foreground">
            {verb.kana}
          </span>
          <span className="text-sm text-muted-foreground">{verb.romaji}</span>
        </div>
        <p className="mt-2 text-base">{verb.gloss.join('; ')}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <LevelBadge level={verb.jlpt} />
          <ClassBadge cls={verb.class} />
          <TransBadge trans={verb.transitivity} />
          <span className="text-xs text-muted-foreground">{CLASS_LABELS[verb.class]}</span>
          {verb.common && (
            <span className="text-xs text-muted-foreground">· common verb</span>
          )}
        </div>
      </header>

      <MeaningsAccordion senses={verb.senses} />

      <section>
        <h2 className="mb-2 text-lg font-semibold">Conjugations</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Click a row to see how the form is built.
        </p>
        <ConjugationTable verb={verb} />
      </section>

      {verb.kanjiChars.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Kanji</h2>
          <KanjiBreakdown chars={verb.kanjiChars} />
        </section>
      )}
    </div>
  )
}
