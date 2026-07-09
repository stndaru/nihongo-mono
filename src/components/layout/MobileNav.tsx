import { useState } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Button } from '@/components/ui/button'

const ITEMS: { to: LinkProps['to']; label: string; exact?: boolean; section?: string }[] = [
  { to: '/', label: 'Home', exact: true },
  { to: '/dictionary', label: 'Dictionary', section: 'Essentials' },
  { to: '/kanji', label: 'Kanji' },
  { to: '/verbs', label: 'Verb Vocabulary', section: 'Language' },
  { to: '/vocab', label: 'Non-Verb Vocabulary' },
  { to: '/vocab/antonyms', label: 'Antonyms' },
  { to: '/grammar', label: 'Grammar Points' },
  { to: '/names', label: 'Proper Names' },
  { to: '/cheatsheet', label: 'Cheatsheet' },
  { to: '/resources', label: 'Resources' },
  { to: '/parser', label: 'Sentence Parser', section: 'Tools' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/progress', label: 'Progress' },
  { to: '/settings', label: 'Settings' },
]

/** Burger-triggered side drawer; phones only (the button is sm:hidden). */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Open Menu">
          <Menu className="size-5" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 duration-150 data-[state=closed]:duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background px-4 py-4 shadow-lg duration-150 ease-snap outline-none data-[state=closed]:duration-100 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left sm:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          {/* link/label padding of 8px + container 16px = 24px from the edge */}
          <div className="mb-3 flex items-center justify-between pl-2">
            <span className="flex items-baseline gap-1.5 font-semibold">
              <span lang="ja" className="text-primary">
                日本語
              </span>
              <span className="text-sm text-muted-foreground">mono</span>
            </span>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close Menu">
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <nav className="flex flex-col text-sm">
            {ITEMS.map((item) => (
              <span key={item.to} className="contents">
                {item.section && (
                  // deliberately tiny and faint — a group caption, not a link
                  <span className="mt-6 mb-1.5 px-2 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase select-none">
                    {item.section}
                  </span>
                )}
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact ?? false }}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-2 text-muted-foreground transition-colors duration-100 hover:text-foreground"
                  activeProps={{ className: 'bg-secondary !text-foreground' }}
                >
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
