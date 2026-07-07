import { createFileRoute, Link } from '@tanstack/react-router'
import { BookOpen, Flame, ListChecks, Target } from 'lucide-react'
import { VerbCheatsheet } from '@/components/home/VerbCheatsheet'
import { Button } from '@/components/ui/button'
import { useProgress } from '@/lib/progress/context'
import { streakAtRisk, streakBroken } from '@/lib/progress/streak'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
  hash,
}: {
  icon: typeof Flame
  label: string
  value: string
  sub?: string
  highlight?: boolean
  /** links the card to /progress; '' targets the top of the page */
  hash?: string
}) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className={cn('mt-1.5 text-2xl font-semibold', highlight && 'text-primary')}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </>
  )
  if (hash === undefined) {
    return <div className="rounded-lg border p-4">{inner}</div>
  }
  return (
    <Link
      to="/progress"
      hash={hash || undefined}
      title="open the progress page"
      className="block rounded-lg border p-4 transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
    >
      {inner}
    </Link>
  )
}

function Dashboard() {
  const { progress } = useProgress()

  const totalAnswers = progress.sessions.reduce((a, s) => a + s.total, 0)
  const totalCorrect = progress.sessions.reduce((a, s) => a + s.correct, 0)
  const accuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : null
  const verbsSeen = Object.keys(progress.verbs).length
  const broken = streakBroken(progress.streak)
  const shownStreak = broken ? 0 : progress.streak.current
  const atRisk = !broken && streakAtRisk(progress.streak)

  return (
    // roomier than other pages on purpose — the dashboard felt dense
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">
          <span lang="ja" className="text-primary">
            日本語
          </span>{' '}
          mono
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A fast little verb dictionary and conjugation trainer. No login — your
          progress lives in this browser.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard
          icon={Flame}
          label="Day streak"
          value={String(shownStreak)}
          sub={
            atRisk
              ? 'at risk — study today!'
              : progress.streak.best > 0
                ? `best: ${progress.streak.best}`
                : 'do a quiz to start one'
          }
          highlight={shownStreak > 0 && !atRisk}
        />
        <StatCard
          icon={Target}
          label="Accuracy"
          value={accuracy === null ? '—' : `${accuracy}%`}
          sub={totalAnswers > 0 ? `${totalCorrect}/${totalAnswers} answers` : undefined}
          hash=""
        />
        <StatCard
          icon={BookOpen}
          label="Words practiced"
          value={String(verbsSeen)}
          hash="words"
        />
        <StatCard
          icon={ListChecks}
          label="Sessions"
          value={String(progress.sessions.length)}
          hash="sessions"
        />
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Button size="lg" asChild>
          <Link to="/quiz">Start a Quiz</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link to="/dictionary">Browse Dictionary</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link to="/progress">View Progress</Link>
        </Button>
      </div>

      <VerbCheatsheet />
    </div>
  )
}
