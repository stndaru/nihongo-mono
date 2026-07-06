import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/quiz/session')({
  component: QuizSessionPage,
})

function QuizSessionPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Quiz session</h1>
      <p className="mt-2 text-muted-foreground">Quiz session coming in Phase 5.</p>
    </div>
  )
}
