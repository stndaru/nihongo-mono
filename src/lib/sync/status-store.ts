/**
 * Tiny external store for the ambient sync status. This and bootstrap.ts
 * are the only sync modules in the main bundle (~0.5 kB); everything else
 * (engine, Drive REST, Google's script) loads on demand.
 */
import { useSyncExternalStore } from 'react'
import { loadSyncMeta } from './meta'
import type { SyncStatus } from './types'

/** What we can know before the engine has run: linked or not, and stale-when. */
function initialStatus(): SyncStatus {
  const meta = loadSyncMeta()
  if (!meta) return { phase: 'disconnected' }
  if (meta.decisionPending) return { phase: 'pending-decision' }
  return { phase: 'synced', lastSyncedAt: meta.lastSyncedAt }
}

let status: SyncStatus = initialStatus()
const listeners = new Set<() => void>()

export function getSyncStatus(): SyncStatus {
  return status
}

export function setSyncStatus(next: SyncStatus): void {
  status = next
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSyncStatus, getSyncStatus)
}
