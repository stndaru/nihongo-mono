/**
 * The only sync module app code imports statically (context.tsx, __root).
 * It gates on the persisted link state and pulls the engine in via dynamic
 * import — users who never connected pay zero bytes and make zero
 * requests, and Google's script is never loaded on their behalf.
 */
import { loadSyncMeta, syncInactiveTooLong } from './meta'
import { setSyncStatus } from './status-store'

/** Quiz-finish trigger: fire-and-forget; the UI shows status changes. */
export function requestAutoSync(): void {
  const meta = loadSyncMeta()
  if (meta === null || meta.decisionPending) return // undecided = hard-gated off
  if (syncInactiveTooLong(meta, Date.now())) {
    // 24h idle sign-out: surface it without even loading the engine —
    // the manual Sync Now / sign-in click resumes
    setSyncStatus({ phase: 'needs-reauth' })
    return
  }
  void import('./engine')
    .then((m) => m.getEngine().autoSync())
    .catch(() => undefined) // chunk-load failure: next trigger retries
}

/** App-load trigger: pull-merge with a silent token only (never a popup). */
export function initSyncOnLoad(): void {
  requestAutoSync()
}
