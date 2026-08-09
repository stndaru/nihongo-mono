import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const segmentedTabsVariants = cva("inline-flex border", {
  variants: {
    size: {
      default: "rounded-lg bg-muted/40 p-0.5",
      compact: "h-7 shrink-0 rounded-md bg-muted/30 p-px",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

const segmentedTabVariants = cva(
  "transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      size: {
        default: "rounded-md px-3 py-1.5 text-sm",
        compact: "h-full whitespace-nowrap rounded-sm px-2 text-xs font-medium",
      },
      active: {
        true: "bg-background font-medium text-foreground shadow-sm",
        false: "text-muted-foreground hover:text-foreground",
      },
    },
    defaultVariants: {
      size: "default",
      active: false,
    },
  },
)

type SegmentedTabsSize = NonNullable<VariantProps<typeof segmentedTabsVariants>["size"]>

const SegmentedTabsContext = React.createContext<SegmentedTabsSize>("default")

const SegmentedTabs = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentProps<"div">, "role"> & { size?: SegmentedTabsSize }
>(({ className, size = "default", onKeyDown, ...props }, ref) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || !(event.target instanceof HTMLButtonElement)) return

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    )
    const current = tabs.indexOf(event.target)
    if (current < 0) return

    let next = current
    if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length
    else if (event.key === "ArrowRight") next = (current + 1) % tabs.length
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = tabs.length - 1
    else return

    event.preventDefault()
    tabs[next]?.focus()
    tabs[next]?.click()
  }

  return (
    <SegmentedTabsContext.Provider value={size}>
      <div
        ref={ref}
        role="tablist"
        className={cn(segmentedTabsVariants({ size }), className)}
        onKeyDown={handleKeyDown}
        {...props}
      />
    </SegmentedTabsContext.Provider>
  )
})
SegmentedTabs.displayName = "SegmentedTabs"

const SegmentedTab = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ComponentProps<"button">, "aria-selected" | "role"> & { active: boolean }
>(({ active, className, type = "button", ...props }, ref) => {
  const size = React.useContext(SegmentedTabsContext)

  return (
    <button
      ref={ref}
      role="tab"
      type={type}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={cn(segmentedTabVariants({ size, active }), className)}
      {...props}
    />
  )
})
SegmentedTab.displayName = "SegmentedTab"

export { SegmentedTab, SegmentedTabs }
