import { Link, useRouterState, type LinkProps } from '@tanstack/react-router'
import { ChevronDown, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CommandPalette } from '@/components/search/CommandPalette'
import { cn } from '@/lib/utils'
import { MobileNav } from './MobileNav'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Home', exact: true },
  { to: '/dictionary', label: 'Dictionary' },
  { to: '/kanji', label: 'Kanji' },
] as const

interface MenuEntry {
  to: LinkProps['to']
  label: string
  description: string
}

/** Grouped nav dropdowns (Linear-style: name above, value line bold below). */
const LANGUAGE_ITEMS: MenuEntry[] = [
  { to: '/verbs', label: 'Verbs', description: 'Every conjugation of every JLPT verb' },
  { to: '/vocab', label: 'Vocabulary', description: 'Nouns, adjectives, adverbs, and more' },
  { to: '/vocab/antonyms', label: 'Antonyms', description: 'Adjectives learned in opposite pairs' },
  { to: '/names', label: 'Proper Names', description: 'Search 743k names and places' },
]

const TOOLS_ITEMS: MenuEntry[] = [
  { to: '/parser', label: 'Sentence Parser', description: 'Break a sentence into its words' },
  { to: '/quiz', label: 'Quiz', description: 'Practice conjugations and vocabulary' },
  { to: '/progress', label: 'Progress', description: 'Streaks, accuracy, and weak spots' },
]

const linkClass =
  'rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-100 hover:text-foreground'
const activeClass = 'bg-secondary !text-foreground'

function NavLink({ to, label, exact }: { to: string; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact ?? false }}
      className={linkClass}
      activeProps={{ className: activeClass }}
    >
      {label}
    </Link>
  )
}

function NavDropdown({
  label,
  items,
  activePrefixes,
}: {
  label: string
  items: MenuEntry[]
  activePrefixes: string[]
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = activePrefixes.some((p) => pathname.startsWith(p))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(linkClass, 'flex items-center gap-0.5', active && activeClass)}
      >
        {label}
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="grid w-[26rem] grid-cols-2 gap-1 p-2">
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild className="items-start">
            <Link to={item.to} className="flex h-full flex-col gap-0.5 rounded-md p-2.5">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-sm leading-snug font-medium">{item.description}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-1 px-6 sm:px-4">
        <MobileNav />
        <Link
          to="/"
          className="mr-2 flex items-baseline gap-1.5 font-semibold whitespace-nowrap"
        >
          <span lang="ja" className="text-primary">
            日本語
          </span>
          <span className="text-sm text-muted-foreground">mono</span>
        </Link>
        {/* phones use the burger drawer instead */}
        <nav className="hidden items-center gap-0.5 text-sm sm:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
          <NavDropdown
            label="Language"
            items={LANGUAGE_ITEMS}
            activePrefixes={['/verbs', '/vocab', '/names']}
          />
          <NavDropdown
            label="Tools"
            items={TOOLS_ITEMS}
            activePrefixes={['/parser', '/quiz', '/progress']}
          />
        </nav>
        <div className="ml-auto flex items-center gap-0.5">
          <CommandPalette />
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild title="Settings" aria-label="Settings">
            <Link to="/settings" activeProps={{ className: 'bg-secondary' }}>
              <Settings className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
