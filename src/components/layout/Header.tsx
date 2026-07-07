import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Home', exact: true },
  { to: '/verbs', label: 'Verbs' },
] as const

const NAV_AFTER = [
  { to: '/names', label: 'Names' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/settings', label: 'Settings' },
] as const

const VOCAB_ITEMS = [
  { to: '/vocab', label: 'All Vocabulary' },
  { to: '/vocab/antonyms', label: 'Antonyms' },
] as const

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

function VocabDropdown() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = pathname.startsWith('/vocab')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(linkClass, 'flex items-center gap-0.5', active && activeClass)}
      >
        Vocab
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {VOCAB_ITEMS.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to}>{item.label}</Link>
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
        <Link
          to="/"
          className="mr-2 flex items-baseline gap-1.5 font-semibold whitespace-nowrap"
        >
          <span lang="ja" className="text-primary">
            日本語
          </span>
          <span className="text-sm text-muted-foreground">mono</span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
          <VocabDropdown />
          {NAV_AFTER.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
