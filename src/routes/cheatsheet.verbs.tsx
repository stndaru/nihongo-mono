import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { VerbCheatsheet } from '@/components/home/VerbCheatsheet'

export const Route = createFileRoute('/cheatsheet/verbs')({
  component: VerbCheatsheetPage,
})

function VerbCheatsheetPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/cheatsheet"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Cheatsheet
        </Link>
        <h1 className="text-2xl font-semibold">Japanese Verb Summary</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Learn the three verb types once, then come back to skim whenever a
          conjugation feels shaky.
        </p>
      </div>

      <VerbCheatsheet />
    </div>
  )
}
