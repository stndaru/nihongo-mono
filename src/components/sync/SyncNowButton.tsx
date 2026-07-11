/**
 * Manual "Sync Now" — reconciles Drive ↔ this browser on demand from the
 * dashboard and the progress page. Renders nothing when Drive isn't
 * linked. Uses the interactive token path (same as Settings' Sync Now) so
 * an expired session can recover with a popup right where the user is.
 */
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSyncStatus } from '@/lib/sync/status-store'
import { cn } from '@/lib/utils'
import { SyncStatusInline } from './SyncStatusInline'

export function SyncNowButton({
  className,
  size = 'sm',
  withStatus = false,
}: {
  className?: string
  size?: 'sm' | 'default'
  /** also render the status pill beside the button (dashboard layout) */
  withStatus?: boolean
}) {
  const status = useSyncStatus()
  if (status.phase === 'disconnected') return null

  const busy = status.phase === 'syncing' || status.phase === 'connecting'
  const button = (
    <Button
      variant="outline"
      size={size}
      className={withStatus ? undefined : className}
      // undecided second browser: syncing stays hard-gated until the
      // Use-vs-Start-Fresh choice; the pill links to Settings for it
      disabled={busy || status.phase === 'pending-decision'}
      onClick={() =>
        void import('@/lib/sync/engine')
          .then((m) => m.getEngine().manualSync())
          .catch(() => undefined) // failures surface via the status pill
      }
    >
      <RefreshCw className={busy ? 'motion-safe:animate-spin' : undefined} /> Sync Now
    </Button>
  )
  if (!withStatus) return button
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <SyncStatusInline />
      {button}
    </div>
  )
}
