import { Link } from '@tanstack/react-router'
import { accuracyOf, wordStatus } from '@/lib/progress/analytics'
import { useProgress } from '@/lib/progress/context'
import { StatusBadge } from './StatusBadge'

/**
 * One-line personal quiz history for a word's detail page. Renders nothing
 * until the word has appeared in a quiz.
 */
export function WordPractice({ id }: { id: string }) {
  const { progress } = useProgress()
  const stat = progress.verbs[id]
  if (!stat) return null
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <StatusBadge status={wordStatus(stat)} />
      <span>
        quizzed {stat.seen}×, {Math.round(accuracyOf(stat) * 100)}% correct · last on{' '}
        {stat.lastSeen}
      </span>
      <Link to="/progress" className="text-primary underline-offset-2 hover:underline">
        All Progress
      </Link>
    </div>
  )
}
