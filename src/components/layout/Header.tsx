import { useRef, useState } from 'react'
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
  { to: '/verbs', label: 'Verb Vocabulary', description: 'Every conjugation of every JLPT verb' },
  { to: '/vocab', label: 'Non-Verb Vocabulary', description: 'Nouns, adjectives, adverbs, and more' },
  { to: '/vocab/antonyms', label: 'Antonyms', description: 'Adjectives learned in opposite pairs' },
  { to: '/grammar', label: 'Grammar Points', description: 'Every JLPT grammar pattern explained' },
  { to: '/names', label: 'Proper Names', description: 'Search 743k names and places' },
  { to: '/cheatsheet', label: 'Cheatsheet', description: 'Skimmable summaries for quick recall' },
  { to: '/resources', label: 'Resources', description: 'Hand-picked sites for learning Japanese' },
]

const TOOLS_ITEMS: MenuEntry[] = [
  { to: '/parser', label: 'Sentence Parser', description: 'Break down and translate a sentence' },
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

  // Linear-style hover behavior: open on trigger hover, close shortly after
  // the pointer leaves both the trigger and the panel (the delay bridges the
  // 4px gap between them). modal={false} so pointer events outside keep
  // working — that's what lets "mouse moved away" close it.
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpen(false), 200)
  }
  const openNow = () => {
    cancelClose()
    setOpen(true)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        className={cn(linkClass, 'flex items-center gap-0.5', active && activeClass)}
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
      >
        {label}
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="grid w-[26rem] grid-cols-2 gap-1 border-border/80 bg-muted p-2 shadow-lg dark:bg-popover dark:brightness-110"
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={item.to}
            asChild
            className="cursor-pointer items-start focus:bg-background/80 dark:focus:bg-accent"
          >
            <Link to={item.to} className="flex h-full flex-col gap-0.5 rounded-md p-2.5">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-xs leading-snug text-balance text-muted-foreground">
                {item.description}
              </span>
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
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-1 px-3 sm:px-4">
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
        {/* phones use the burger drawer instead. min-w-0 + overflow-x-auto:
            when the row is tight (mid-size viewports, larger font-size
            settings) the nav scrolls in place instead of forcing the whole
            page wider — the header's intrinsic width used to overflow
            640–720px viewports even at the default size */}
        <nav className="hidden min-w-0 items-center gap-0.5 overflow-x-auto text-sm whitespace-nowrap [scrollbar-width:none] sm:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
          <NavDropdown
            label="Language"
            items={LANGUAGE_ITEMS}
            activePrefixes={['/verbs', '/vocab', '/grammar', '/names', '/cheatsheet', '/resources']}
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
