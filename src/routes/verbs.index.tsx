import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/verbs/')({
  component: VerbListPage,
})

function VerbListPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Verbs</h1>
      <p className="mt-2 text-muted-foreground">Verb list coming in Phase 3.</p>
    </div>
  )
}
