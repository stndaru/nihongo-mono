import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/quiz/')({
  component: QuizSetupPage,
})

function QuizSetupPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Conjugation quiz</h1>
      <p className="mt-2 text-muted-foreground">Quiz setup coming in Phase 5.</p>
    </div>
  )
}
