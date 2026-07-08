import { Link, type LinkProps } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  BookA,
  BookOpenText,
  ChartNoAxesColumn,
  Globe,
  GraduationCap,
  Library,
  NotebookText,
  ScanText,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * Homepage shortcut cards: Essentials (the two main features), then the
 * navbar's Tools and Language dropdowns (in that owner-specified order),
 * so everything is reachable without opening the navbar menus.
 */
interface Entry {
  to: LinkProps['to']
  label: string
  description: string
  icon?: LucideIcon
  /** a Japanese glyph tile instead of a lucide icon */
  glyph?: string
}

const ESSENTIALS: Entry[] = [
  {
    to: '/dictionary',
    label: 'Dictionary',
    description: 'Every verb and vocabulary word in one searchable table',
    icon: BookOpenText,
  },
  {
    to: '/kanji',
    label: 'Kanji',
    description: 'Readings, meanings, and stroke order by JLPT level',
    glyph: '漢',
  },
]

const TOOLS: Entry[] = [
  { to: '/parser', label: 'Sentence Parser', description: 'Break down and translate a sentence', icon: ScanText },
  { to: '/quiz', label: 'Quiz', description: 'Practice conjugations and vocabulary', icon: GraduationCap },
  { to: '/progress', label: 'Progress', description: 'Streaks, accuracy, and weak spots', icon: ChartNoAxesColumn },
]

const LANGUAGE: Entry[] = [
  { to: '/verbs', label: 'Verb Vocabulary', description: 'Every conjugation of every JLPT verb', icon: BookA },
  { to: '/vocab', label: 'Non-Verb Vocabulary', description: 'Nouns, adjectives, adverbs, and more', icon: Library },
  { to: '/vocab/antonyms', label: 'Antonyms', description: 'Adjectives learned in opposite pairs', icon: ArrowLeftRight },
  { to: '/names', label: 'Proper Names', description: 'Search 743k names and places', icon: Users },
  { to: '/cheatsheet', label: 'Cheatsheet', description: 'Skimmable summaries for quick recall', icon: NotebookText },
  { to: '/resources', label: 'Resources', description: 'Hand-picked sites for learning Japanese', icon: Globe },
]

function CardGrid({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <section>
      <h2 className="mb-2.5 text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(({ to, label, description, icon: Icon, glyph }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-lg border p-3.5 transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {Icon ? (
                <Icon className="size-4.5" />
              ) : (
                <span lang="ja" className="text-lg leading-none font-medium">
                  {glyph}
                </span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function QuickAccess() {
  return (
    <div className="space-y-8">
      <CardGrid title="Essentials" entries={ESSENTIALS} />
      <CardGrid title="Tools" entries={TOOLS} />
      <CardGrid title="Language" entries={LANGUAGE} />
    </div>
  )
}
