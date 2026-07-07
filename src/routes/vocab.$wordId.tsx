import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ExampleSentences } from '@/components/verbs/ExampleSentences'
import { Furigana } from '@/components/verbs/Furigana'
import { KanjiBreakdown } from '@/components/verbs/KanjiBreakdown'
import { MeaningsAccordion } from '@/components/verbs/MeaningsAccordion'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import { AdjectiveInflectionTable } from '@/components/vocab/AdjectiveInflectionTable'
import { PosBadge } from '@/components/vocab/PosBadge'
import { RelatedWords } from '@/components/vocab/RelatedWords'
import { findVocab } from '@/lib/data/loader'
import type { VocabEntry } from '@/lib/data/types'

async function resolveIds(ids: string[] | undefined): Promise<VocabEntry[]> {
  if (!ids || ids.length === 0) return []
  const words = await Promise.all(ids.map(findVocab))
  return words.filter((w): w is VocabEntry => Boolean(w))
}

export const Route = createFileRoute('/vocab/$wordId')({
  loader: async ({ params }) => {
    const word = await findVocab(params.wordId)
    if (!word) throw notFound()
    const [antonyms, synonyms] = await Promise.all([
      resolveIds(word.antonyms),
      resolveIds(word.synonyms),
    ])
    return { word, antonyms, synonyms }
  },
  component: VocabDetailPage,
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-muted-foreground">This word doesn&apos;t exist.</p>
      <Link
        to="/vocab"
        className="mt-3 inline-block text-primary underline-offset-2 hover:underline"
      >
        Back to the vocabulary list
      </Link>
    </div>
  ),
})

function VocabDetailPage() {
  const { word, antonyms, synonyms } = Route.useLoaderData()
  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <Furigana segments={word.furigana} className="text-4xl leading-tight" />
          <span lang="ja" className="text-lg text-muted-foreground">
            {word.kana}
          </span>
          <span className="text-sm text-muted-foreground">{word.romaji}</span>
        </div>
        <p className="mt-2 text-base">{word.gloss.join('; ')}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <LevelBadge level={word.jlpt} />
          <PosBadge pos={word.pos} />
          {word.common && <span className="text-xs text-muted-foreground">· common word</span>}
        </div>
      </header>

      <MeaningsAccordion senses={word.senses} />

      {word.examples.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Example Sentences</h2>
          <ExampleSentences examples={word.examples} />
        </section>
      )}

      <AdjectiveInflectionTable word={word} />

      <RelatedWords title="Antonyms" words={antonyms} />
      <RelatedWords title="See also" words={synonyms} />

      {word.kanjiChars.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Kanji</h2>
          <KanjiBreakdown chars={word.kanjiChars} />
        </section>
      )}
    </div>
  )
}
