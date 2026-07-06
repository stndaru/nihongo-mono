import { cn } from '@/lib/utils'

export function Chip({
  active,
  onClick,
  children,
  title,
  className,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-7 rounded-md border px-2 text-xs transition-colors duration-100',
        active
          ? 'border-primary/50 bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
