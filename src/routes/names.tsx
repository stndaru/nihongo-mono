import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { SearchBox } from '@/components/verbs/SearchBox'
import {
  loadNamesManifest,
  NAME_TYPE_LABELS,
  searchNames,
  type NameSearchOutcome,
} from '@/lib/data/names'

interface NamesSearch {
  q?: string
}

export const Route = createFileRoute('/names')({
  validateSearch: (search: Record<string, unknown>): NamesSearch => {
    const out: NamesSearch = {}
    if (typeof search.q === 'string' && search.q) out.q = search.q
    return out
  },
  component: NamesPage,
})

function NamesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const q = search.q ?? ''

  const [total, setTotal] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    loadNamesManifest()
      .then((m) => {
        if (alive) setTotal(m.count)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const [outcome, setOutcome] = useState<NameSearchOutcome | null>(null)
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    if (!q) {
      setOutcome(null)
      return
    }
    let alive = true
    setSearching(true)
    searchNames(q)
      .then((res) => {
        if (alive) setOutcome(res)
      })
      .finally(() => {
        if (alive) setSearching(false)
      })
    return () => {
      alive = false
    }
  }, [q])

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold">Proper Names</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total !== null && `${total.toLocaleString()} `}Japanese surnames, given
          names, places, companies, and other proper nouns from JMnedict (the
          successor of ENAMDICT). Search by the beginning of a name — reading
          (kana or romaji) or written form.
        </p>
      </div>
      <SearchBox
        value={q}
        onChange={(next) =>
          navigate({ search: next ? { q: next } : {}, replace: true })
        }
        placeholder="たなか, tanaka, 田中…"
      />
      {!q ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Type a name to search.
        </p>
      ) : outcome === null || searching ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Searching…</p>
      ) : outcome.results.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No names start with “{q}”.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {outcome.total.toLocaleString()} match{outcome.total === 1 ? '' : 'es'}
            {outcome.total > outcome.results.length &&
              ` (showing the ${outcome.results.length} shortest)`}
          </p>
          <div className="overflow-hidden rounded-lg border">
            {outcome.results.map((name, i) => (
              <div
                key={`${name.kanji}|${name.kana}|${i}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/60 p-2.5 pl-3 last:border-b-0"
              >
                <span lang="ja" className="text-lg">
                  {name.kanji || name.kana}
                </span>
                {name.kanji && (
                  <span lang="ja" className="text-sm text-muted-foreground">
                    {name.kana}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">{name.gloss}</span>
                <span className="ml-auto flex shrink-0 flex-wrap gap-1">
                  {name.types.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="px-1.5 font-normal text-muted-foreground"
                    >
                      {NAME_TYPE_LABELS[t] ?? t}
                    </Badge>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
