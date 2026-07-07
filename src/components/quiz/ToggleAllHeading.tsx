/** A quiz-setup section heading that toggles select/deselect-all for its group. */
export function ToggleAllHeading({
  children,
  onClick,
}: {
  children: string
  onClick: () => void
}) {
  return (
    <h2 className="text-sm font-medium">
      <button
        type="button"
        onClick={onClick}
        title="select/deselect all"
        className="rounded-sm underline-offset-2 transition-colors duration-100 hover:text-primary hover:underline"
      >
        {children}
      </button>
    </h2>
  )
}

/** All selected → none; anything else → all. Start stays disabled while empty. */
export function toggleAll<T>(list: T[], all: readonly T[]): T[] {
  return all.every((x) => list.includes(x)) ? [] : [...all]
}
