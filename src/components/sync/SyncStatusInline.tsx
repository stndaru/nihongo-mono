/**
 * Ambient sync status — a small line shown on the progress page and quiz
 * summaries so a background sync is never invisible. Renders nothing when
 * Drive isn't linked; problem states link to Settings where the fix lives.
 */
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Cloud, RefreshCw } from 'lucide-react'
import { useSyncStatus } from '@/lib/sync/status-store'
import { cn } from '@/lib/utils'

export function SyncStatusInline({ className }: { className?: string }) {
  const status = useSyncStatus()
  if (status.phase === 'disconnected') return null

  const base = cn('inline-flex items-center gap-1.5 text-xs', className)
  switch (status.phase) {
    case 'syncing':
    case 'connecting':
      return (
        <span className={cn(base, 'text-muted-foreground')}>
          <RefreshCw className="size-3.5 motion-safe:animate-spin" /> Syncing to Drive…
        </span>
      )
    case 'synced':
      return (
        <span className={cn(base, 'text-muted-foreground')}>
          <Cloud className="size-3.5" /> Synced to Drive
        </span>
      )
    case 'pending-decision':
      return (
        <Link
          to="/settings"
          className={cn(base, 'text-muted-foreground underline-offset-2 hover:underline')}
        >
          <AlertTriangle className="size-3.5" /> Drive sync — decision needed
        </Link>
      )
    case 'needs-reauth':
      return (
        <Link to="/settings" className={cn(base, 'text-muted-foreground underline-offset-2 hover:underline')}>
          <AlertTriangle className="size-3.5" /> Drive sync — sign-in needed
        </Link>
      )
    case 'error':
      return (
        <Link to="/settings" className={cn(base, 'text-muted-foreground underline-offset-2 hover:underline')}>
          <AlertTriangle className="size-3.5" /> Drive sync paused
        </Link>
      )
  }
}
