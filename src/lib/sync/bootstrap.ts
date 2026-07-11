/**
 * The only sync module app code imports statically (context.tsx, __root).
 * It gates on the persisted link state and pulls the engine in via dynamic
 * import — users who never connected pay zero bytes and make zero
 * requests, and Google's script is never loaded on their behalf.
 */
import { loadSyncMeta } from './meta'

function syncActive(): boolean {
  const meta = loadSyncMeta()
  return meta !== null && !meta.decisionPending // undecided = hard-gated off
}

/** Quiz-finish trigger: fire-and-forget; the UI shows status changes. */
export function requestAutoSync(): void {
  if (!syncActive()) return
  void import('./engine')
    .then((m) => m.getEngine().autoSync())
    .catch(() => undefined) // chunk-load failure: next trigger retries
}

/** App-load trigger: pull-merge with a silent token only (never a popup). */
export function initSyncOnLoad(): void {
  requestAutoSync()
}
