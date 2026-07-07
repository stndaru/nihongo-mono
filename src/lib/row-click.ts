import type { MouseEvent } from 'react'

/**
 * Whole table rows navigate to the detail page, but clicking must never
 * steal a text selection or fight the real link in the first column.
 * Returns true when the row click handler should do nothing:
 *
 * - the click landed on (or inside) an <a> — the link handles it, and
 *   middle/ctrl-click "open in new tab" keeps working there
 * - the user just finished selecting text (mouseup after a drag fires a
 *   click, and getSelection() reports a Range at that moment)
 * - a modifier is held — the row can't open a new tab, so do nothing
 *   rather than surprise-navigate the current one
 */
export function rowClickGuard(e: MouseEvent): boolean {
  if ((e.target as HTMLElement).closest('a')) return true
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return true
  const selection = window.getSelection()
  return selection !== null && selection.type === 'Range'
}
