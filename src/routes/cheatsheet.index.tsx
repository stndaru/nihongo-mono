import { createFileRoute, Link, type LinkProps } from '@tanstack/react-router'
import { ChevronRight, NotebookText } from 'lucide-react'

export const Route = createFileRoute('/cheatsheet/')({
  component: CheatsheetIndexPage,
})

/** In-app cheatsheets — skimmable summaries for recall, one page each. */
const CHEATSHEETS: { name: string; to: LinkProps['to']; what: string }[] = [
  {
    name: 'Japanese Verb Summary',
    to: '/cheatsheet/verbs',
    what: 'The three verb types (godan / ichidan / irregular): what they are, how to spot them — including the る-trap lookalikes — and how each conjugates, with a side-by-side form table.',
  },
  {
    name: 'Japanese Counters',
    to: '/cheatsheet/counters',
    what: 'How counting words work — the grammar, the two number systems, asking how many — plus tables of the universal つ series, the must-know counters, and the common tier, with the sound changes to expect.',
  },
]

function CheatsheetIndexPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cheatsheet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compact summaries to learn the key ideas once and refresh them at a
          glance later.
        </p>
      </div>

      <ul className="space-y-3">
        {CHEATSHEETS.map((c) => (
          <li key={c.name}>
            <Link
              to={c.to}
              className="flex items-center gap-3 rounded-lg border p-4 transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <NotebookText className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{c.name}</span>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{c.what}</p>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
