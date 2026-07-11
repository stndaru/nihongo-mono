import type { SyncMeta } from './types'

const META_KEY = 'nihongo-mono:drive-sync:v1'

/** Defensive read: anything malformed counts as "not linked". */
export function loadSyncMeta(): SyncMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<SyncMeta> | null
    if (
      !data ||
      typeof data !== 'object' ||
      data.enabled !== true ||
      typeof data.folderId !== 'string' ||
      typeof data.fileId !== 'string'
    ) {
      return null
    }
    return {
      enabled: true,
      folderId: data.folderId,
      fileId: data.fileId,
      lastSyncedAt: typeof data.lastSyncedAt === 'string' ? data.lastSyncedAt : null,
      decisionPending: data.decisionPending === true,
    }
  } catch {
    return null
  }
}

/** Owner rule: after this long with no successful sync, the link "signs
 *  out" — silent auto-sync stands down and an explicit click (interactive
 *  sync) is required to resume. Google-required sign-outs (revoked grant,
 *  expired session) are separate and always honored via needs-reauth. */
export const INACTIVITY_SIGNOUT_MS = 24 * 60 * 60 * 1000

export function syncInactiveTooLong(meta: SyncMeta, nowMs: number): boolean {
  return meta.lastSyncedAt !== null && nowMs - Date.parse(meta.lastSyncedAt) > INACTIVITY_SIGNOUT_MS
}

export function saveSyncMeta(meta: SyncMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // storage full/denied — the link degrades to per-session, nothing breaks
  }
}

export function clearSyncMeta(): void {
  try {
    localStorage.removeItem(META_KEY)
    localStorage.removeItem(BASE_KEY)
  } catch {
    // ignore
  }
}

/**
 * The last-synced snapshot — the three-way merge's common ancestor
 * (see merge3.ts). Stored as the raw serialized ProgressData; a missing
 * or unreadable base falls back to the additive import merge once.
 */
const BASE_KEY = 'nihongo-mono:drive-sync:base:v1'

export function loadSyncBase(): string | null {
  try {
    return localStorage.getItem(BASE_KEY)
  } catch {
    return null
  }
}

export function saveSyncBase(serialized: string): void {
  try {
    localStorage.setItem(BASE_KEY, serialized)
  } catch {
    // storage full — next sync falls back to the import merge
  }
}
