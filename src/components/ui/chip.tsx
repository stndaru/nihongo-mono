import { cn } from '@/lib/utils'

export function Chip({
  active,
  onClick,
  children,
  title,
  className,
  disabled,
}: {
  active: boolean
  /** receives the click event — `e.detail === 0` identifies keyboard activation */
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
  title?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'h-7 rounded-md border px-2 text-xs transition-colors duration-100',
        active
          ? 'border-primary/50 bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        // no pointer-events-none: the title tooltip must still explain why
        disabled && 'opacity-50',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * `onLabelClick` makes the group's name itself a control: multi-select
 * groups toggle select/deselect-all, single-select filters clear back to
 * "all" (user convention — every filter label on the site behaves this way).
 */
export function ChipGroup({
  label,
  onLabelClick,
  labelTitle,
  children,
}: {
  label: string
  onLabelClick?: () => void
  labelTitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {onLabelClick ? (
        <button
          type="button"
          onClick={onLabelClick}
          title={labelTitle}
          className="mr-0.5 rounded-sm text-xs text-muted-foreground underline-offset-2 transition-colors duration-100 hover:text-foreground hover:underline"
        >
          {label}
        </button>
      ) : (
        <span className="mr-0.5 text-xs text-muted-foreground">{label}</span>
      )}
      {children}
    </div>
  )
}
