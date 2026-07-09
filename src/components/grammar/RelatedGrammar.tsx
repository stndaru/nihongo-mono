import { Link } from '@tanstack/react-router'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import type { GrammarEntry } from '@/lib/data/types'

/** A relation slug resolved to its entry, keeping the authored "vs" note. */
export interface ResolvedRelation {
  entry: GrammarEntry
  note?: string
}

export function RelatedGrammar({
  title,
  relations,
}: {
  title: string
  relations: ResolvedRelation[]
}) {
  if (relations.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {/* explicit cols: an implicit auto column would grow past the viewport on long notes */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {relations.map(({ entry, note }) => (
          <Link
            key={entry.slug}
            to="/grammar/$slug"
            params={{ slug: entry.slug }}
            className="rounded-md border p-3 transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex items-baseline gap-2">
              <span lang="ja" className="text-lg leading-snug">
                {entry.title}
              </span>
              <span className="truncate text-sm text-muted-foreground">{entry.meaning}</span>
              <LevelBadge level={entry.jlpt} className="ml-auto shrink-0" />
            </span>
            {note && <span className="mt-1 block text-xs text-muted-foreground">{note}</span>}
          </Link>
        ))}
      </div>
    </section>
  )
}
