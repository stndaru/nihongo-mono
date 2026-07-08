import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Collapsible panel for quiz feedback extras (closed by default). Children
 * render only while open, so any per-option work is done lazily.
 */
export function FeedbackAccordion({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 p-3 text-left text-sm font-medium transition-colors duration-100 hover:bg-muted/50"
      >
        {title}
        <ChevronDown
          className={cn(
            'ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-100',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="border-t border-border/60 p-3 pt-2">{children}</div>}
    </div>
  )
}
