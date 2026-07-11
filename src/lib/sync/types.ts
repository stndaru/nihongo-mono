/**
 * Google Drive progress sync — shared types. The whole feature is
 * client-only: the browser talks to Google directly, the static host is
 * never involved (decision 70).
 */

/** Everything that can go wrong during a sync, mapped to a UI state. */
export type SyncErrorKind =
  | 'rate-limit'
  | 'storage-quota'
  | 'offline'
  | 'remote-invalid'
  | 'unknown'

export type SyncStatus =
  | { phase: 'disconnected' }
  | { phase: 'connecting' }
  /** linked, but the second-browser Use/Reset choice hasn't been made —
   *  every automatic sync is hard-gated off until it is */
  | { phase: 'pending-decision' }
  | { phase: 'syncing' }
  | { phase: 'synced'; lastSyncedAt: string | null }
  /** the token expired or access was revoked — resuming needs a click
   *  (Google's token dialog only opens from a user gesture) */
  | { phase: 'needs-reauth' }
  | { phase: 'error'; kind: SyncErrorKind }

/**
 * The persisted link state. SECURITY: this is written to localStorage, so
 * it must NEVER carry a token (tokens live in gis-loader module memory
 * only) — meta.test.ts asserts the serialized form stays token-free.
 */
export interface SyncMeta {
  enabled: true
  folderId: string
  fileId: string
  lastSyncedAt: string | null
  decisionPending: boolean
}
