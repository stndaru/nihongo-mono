import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { OPEN_PALETTE_EVENT } from '@/components/search/CommandPalette'
import { ProgressProvider } from '@/lib/progress/context'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <ProgressProvider>
      <RootShell />
    </ProgressProvider>
  )
}

function RootShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>
      {/* phones: floating search, same palette as Ctrl+K on desktop */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        aria-label="Search"
        className="fixed right-6 bottom-6 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-100 active:scale-95 sm:hidden"
      >
        <Search className="size-5" />
      </button>
      <footer className="border-t py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 text-xs text-muted-foreground sm:px-4">
          <span>nihongo mono — no login, data stays in your browser</span>
          <Link to="/about" className="underline-offset-2 hover:underline">
            About & licences
          </Link>
        </div>
      </footer>
    </div>
  )
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <p lang="ja" className="text-4xl">
        見つかりません
      </p>
      <p className="mt-2 text-muted-foreground">This page does not exist.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline-offset-2 hover:underline">
        Back home
      </Link>
    </div>
  )
}
