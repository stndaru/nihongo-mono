import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'

export const Route = createFileRoute('/resources')({
  component: ResourcesPage,
})

/** External sites that complement the app — name, what it is, link. */
const RESOURCES: { name: string; href: string; what: string }[] = [
  {
    name: 'Japanese Verb Conjugator',
    href: 'https://www.japaneseverbconjugator.com/',
    what: 'Type any verb and get its full conjugation table — a quick second opinion on any form, with usage notes per conjugation.',
  },
  {
    name: 'Jisho',
    href: 'https://jisho.org/',
    what: 'The classic online Japanese–English dictionary. Search by kanji, kana, romaji, English, radicals, or even by drawing a kanji; example sentences and audio included.',
  },
  {
    name: 'Takoboto',
    href: 'https://takoboto.jp/',
    what: 'A clean JMdict-based dictionary with per-word conjugation tables and example sentences — also an excellent offline app on Android and Windows.',
  },
  {
    name: 'Tofugu',
    href: 'https://www.tofugu.com/',
    what: 'In-depth articles on Japanese grammar, kana and kanji learning methods, and honest reviews of study resources — from the team behind WaniKani.',
  },
  {
    name: 'The Tiny Wisdom — Japanese',
    href: 'https://japanese.thetinywisdom.com/',
    what: 'A compact, well-structured guide to the verb groups and conjugation forms (the inspiration for this app’s homepage cheatsheet), with drills to practice them.',
  },
  {
    name: 'JLPT Sensei',
    href: 'https://jlptsensei.com/',
    what: 'JLPT-focused grammar, vocabulary, and kanji lists for every level N5–N1, each grammar point with meaning, structure, and example sentences.',
  },
  {
    name: 'MLC Japanese (Meguro Language Center)',
    href: 'https://www.mlcjapanese.co.jp/',
    what: 'Free printable PDF study materials from a Tokyo language school — kana/kanji worksheets, vocabulary drills, and JLPT practice sheets.',
  },
  {
    name: 'Japanese Test 4 You',
    href: 'https://japanesetest4you.com/',
    what: 'Free JLPT practice: grammar and vocabulary lists, flashcards, and mock tests for every level, organized N5–N1.',
  },
]

function ResourcesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hand-picked external sites that pair well with this app — dictionaries
          for cross-checking, grammar guides for the why, and JLPT practice
          material. All links open in a new tab.
        </p>
      </div>

      <ul className="space-y-3">
        {RESOURCES.map((r) => (
          <li key={r.href}>
            <a
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border p-4 transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{r.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {new URL(r.href).hostname.replace(/^www\./, '')}
                  <ExternalLink className="size-3" />
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.what}</p>
            </a>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        These are independent sites — content and availability are theirs. Data
        sources used by this app itself are credited on the About page.
      </p>
    </div>
  )
}
