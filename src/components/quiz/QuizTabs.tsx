import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/quiz', label: 'Conjugation' },
  { to: '/quiz/vocab', label: 'Vocabulary' },
] as const

export function QuizTabs({ active }: { active: (typeof TABS)[number]['to'] }) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm w-fit">
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className={cn(
            'rounded-md px-3 py-1 transition-colors duration-100',
            tab.to === active
              ? 'bg-background font-medium shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
