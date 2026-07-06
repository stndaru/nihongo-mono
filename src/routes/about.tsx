import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="prose-sm max-w-2xl">
      <h1 className="text-2xl font-semibold">About</h1>
      <p className="mt-2 text-muted-foreground">
        nihongo mono is a lightweight Japanese verb dictionary and conjugation
        trainer. There is no login and no server — your study progress is
        stored only in this browser.
      </p>
      <h2 className="mt-6 text-lg font-semibold">Data sources & licences</h2>
      <p className="mt-2 text-muted-foreground">
        Attribution details will be completed alongside the dataset (Phase 2).
      </p>
    </div>
  )
}
