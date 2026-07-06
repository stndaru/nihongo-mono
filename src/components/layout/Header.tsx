import { Link } from '@tanstack/react-router'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Home', exact: true },
  { to: '/verbs', label: 'Verbs' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/settings', label: 'Settings' },
] as const

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-1 px-3 sm:px-4">
        <Link to="/" className="mr-2 flex items-baseline gap-1.5 font-semibold">
          <span lang="ja" className="text-primary">
            日本語
          </span>
          <span className="text-sm text-muted-foreground">mono</span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: 'exact' in item && item.exact }}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-100 hover:text-foreground"
              activeProps={{ className: 'bg-secondary !text-foreground' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
