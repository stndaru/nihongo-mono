import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/verbs/$verbId')({
  component: VerbDetailPage,
})

function VerbDetailPage() {
  const { verbId } = Route.useParams()
  return (
    <div>
      <h1 className="text-2xl font-semibold">Verb {verbId}</h1>
      <p className="mt-2 text-muted-foreground">Verb detail coming in Phase 4.</p>
    </div>
  )
}
