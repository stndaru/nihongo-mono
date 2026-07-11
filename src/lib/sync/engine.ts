/**
 * The Drive sync engine — the draw.io-style pull-merge-push state machine
 * (decision 70). Loaded only via dynamic import (bootstrap.ts / the
 * settings section), so none of this — nor Google's script — is in the
 * main bundle or runs for users who never connect.
 *
 * Every side effect the engine needs (fetch, GIS, local persistence,
 * clock, timers, online events) is injected: unit tests and Playwright
 * runs swap in fakes, and real Google OAuth stays a manual-only test.
 */
import {
  loadProgress,
  mergeProgress,
  parseImported,
  saveProgress,
  type ProgressData,
} from '@/lib/progress/store'
import { backoffDelay, MAX_ATTEMPTS } from './backoff'
import { merge3 } from './merge3'
import {
  createFile,
  createFolder,
  downloadFile,
  DriveError,
  findFile,
  findFolder,
  updateFile,
} from './drive'
import * as gisDefault from './gis-loader'
import { AuthRequiredError } from './gis-loader'
import {
  clearSyncMeta,
  loadSyncBase,
  loadSyncMeta,
  saveSyncBase,
  saveSyncMeta,
  syncInactiveTooLong,
} from './meta'
import { RemoteInvalidError, validateRemote } from './remote'
import { setSyncStatus } from './status-store'
import type { SyncMeta } from './types'

/** Fired after the engine writes merged remote data to localStorage so the
 *  ProgressProvider can refresh its in-memory state without re-saving. */
export const PROGRESS_CHANGED_EVENT = 'nihongo-mono:progress-external-change'

export interface EngineGis {
  loadGis(): Promise<void>
  getToken(opts: { interactive: boolean }): Promise<string>
  revokeToken(): Promise<void>
  forgetToken(): void
}

export interface EngineDeps {
  fetch: typeof fetch
  gis: EngineGis
  loadLocal(): ProgressData
  saveLocal(data: ProgressData): void
  /** ISO timestamp for lastSyncedAt */
  now(): string
  delay(ms: number): Promise<void>
  random(): number
  /** announce a local-data change made by the engine (merged pull) */
  notifyChange(): void
  /** register a one-shot callback for connectivity returning */
  onceOnline(cb: () => void): void
}

export type ConnectResult =
  | { outcome: 'connected' }
  | { outcome: 'decision'; remote: RemoteSummary }

// Abuse throttle: a trigger is skipped when the last sync SUCCEEDED this
// recently AND local data hasn't changed since — spammed triggers (route
// remounts, click mashing, scripted loops) collapse to zero Google
// requests, while anything with new data or after a failure always runs.
export const AUTO_SYNC_COOLDOWN_MS = 30_000
export const MANUAL_SYNC_COOLDOWN_MS = 5_000

export interface RemoteSummary {
  verbs: number
  sessions: number
}

const defaultDeps = (): EngineDeps => ({
  fetch: (...args) => fetch(...args),
  gis: gisDefault,
  loadLocal: loadProgress,
  saveLocal: saveProgress,
  now: () => new Date().toISOString(),
  delay: (ms) => new Promise((r) => setTimeout(r, ms)),
  random: Math.random,
  notifyChange: () => window.dispatchEvent(new Event(PROGRESS_CHANGED_EVENT)),
  onceOnline: (cb) => window.addEventListener('online', cb, { once: true }),
})

export function createSyncEngine(deps: EngineDeps) {
  let syncing = false
  let rerunQueued = false
  let onlineRetryArmed = false
  // throttle state: when + what the last successful sync agreed on
  let lastSuccessAt = 0
  let lastSuccessSnapshot: string | null = null
  // the remote copy seen during connect(), so the decision dialog doesn't
  // need a second download right after; cleared once the decision is made
  let pendingRemote: ProgressData | null = null

  const serialize = (d: ProgressData) => JSON.stringify(d)

  /** Retry Drive rate limits with backoff; everything else throws through. */
  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn()
      } catch (e) {
        if (e instanceof DriveError && e.kind === 'rate-limit' && attempt < MAX_ATTEMPTS - 1) {
          await deps.delay(backoffDelay(attempt, deps.random))
          continue
        }
        throw e
      }
    }
  }

  function failStatus(e: unknown): void {
    if (e instanceof AuthRequiredError) {
      setSyncStatus({ phase: 'needs-reauth' })
      return
    }
    if (e instanceof RemoteInvalidError) {
      setSyncStatus({ phase: 'error', kind: 'remote-invalid' })
      return
    }
    if (e instanceof DriveError) {
      switch (e.kind) {
        case 'auth':
          deps.gis.forgetToken()
          setSyncStatus({ phase: 'needs-reauth' })
          return
        case 'rate-limit':
          setSyncStatus({ phase: 'error', kind: 'rate-limit' })
          return
        case 'storage-quota':
          setSyncStatus({ phase: 'error', kind: 'storage-quota' })
          return
        case 'offline':
          setSyncStatus({ phase: 'error', kind: 'offline' })
          if (!onlineRetryArmed) {
            onlineRetryArmed = true
            deps.onceOnline(() => {
              onlineRetryArmed = false
              void autoSync()
            })
          }
          return
        case 'too-large':
          setSyncStatus({ phase: 'error', kind: 'remote-invalid' })
          return
        default:
          setSyncStatus({ phase: 'error', kind: 'unknown' })
          return
      }
    }
    setSyncStatus({ phase: 'error', kind: 'unknown' })
  }

  /**
   * Record a successful sync: stamp the meta AND store the just-agreed
   * state as the base snapshot — the next merge3's common ancestor.
   */
  function markSynced(meta: SyncMeta, basisSerialized: string): void {
    const stamped = { ...meta, lastSyncedAt: deps.now() }
    saveSyncMeta(stamped)
    saveSyncBase(basisSerialized)
    lastSuccessAt = Date.parse(stamped.lastSyncedAt as string)
    lastSuccessSnapshot = basisSerialized
    setSyncStatus({ phase: 'synced', lastSyncedAt: stamped.lastSyncedAt })
  }

  /** True when a fresh success already covers the current local state. */
  function withinCooldown(ms: number): boolean {
    if (lastSuccessSnapshot === null) return false
    if (Date.parse(deps.now()) - lastSuccessAt >= ms) return false
    return lastSuccessSnapshot === serialize(deps.loadLocal())
  }

  /** The stored base snapshot, or null when missing/unreadable. */
  function loadBase(): ProgressData | null {
    const raw = loadSyncBase()
    if (!raw) return null
    try {
      return parseImported(raw)
    } catch {
      return null
    }
  }

  /**
   * Recreate after a 404 (folder/file deleted in Drive). If another device
   * beat us to recreating the file, adopt its id and merge normally
   * instead of clobbering it — one bounded retry through syncCore.
   */
  async function recreate(token: string, meta: SyncMeta, interactive: boolean): Promise<void> {
    const folderId =
      (await withRetry(() => findFolder(deps.fetch, token))) ??
      (await withRetry(() => createFolder(deps.fetch, token)))
    const existing = await withRetry(() => findFile(deps.fetch, token, folderId))
    if (existing) {
      saveSyncMeta({ ...meta, folderId, fileId: existing.id })
      await syncCore(interactive, 1)
      return
    }
    const localSerialized = serialize(deps.loadLocal())
    const fileId = await withRetry(() =>
      createFile(deps.fetch, token, folderId, localSerialized),
    )
    markSynced({ ...meta, folderId, fileId, decisionPending: false }, localSerialized)
  }

  /** The core pull-merge-push. Caller has already set status 'syncing'. */
  async function syncCore(interactive: boolean, depth = 0): Promise<void> {
    const meta = loadSyncMeta()
    if (!meta || meta.decisionPending) return // gate: never sync undecided
    const token = await deps.gis.getToken({ interactive })
    let remoteText: string
    try {
      remoteText = await withRetry(() => downloadFile(deps.fetch, token, meta.fileId))
    } catch (e) {
      if (e instanceof DriveError && e.kind === 'not-found' && depth === 0) {
        await recreate(token, meta, interactive)
        return
      }
      throw e
    }
    const remote = validateRemote(remoteText)
    const local = deps.loadLocal()
    const base = loadBase()
    // with a base snapshot the merge is exact (remote + local delta);
    // without one (first sync ever, storage loss) fall back to the
    // additive import merge — a one-time union, then a base exists
    const merged = base ? merge3(base, local, remote) : mergeProgress(local, remote)
    const mergedSerialized = serialize(merged)
    if (mergedSerialized !== serialize(local)) {
      deps.saveLocal(merged)
      deps.notifyChange()
    }
    if (mergedSerialized !== serialize(remote)) {
      await withRetry(() => updateFile(deps.fetch, token, meta.fileId, mergedSerialized))
    }
    markSynced(meta, mergedSerialized)
  }

  /** Single-flight wrapper: a trigger during a sync queues one rerun. */
  async function runSync(interactive: boolean): Promise<void> {
    if (syncing) {
      rerunQueued = true
      return
    }
    syncing = true
    setSyncStatus({ phase: 'syncing' })
    try {
      do {
        rerunQueued = false
        await syncCore(interactive)
      } while (rerunQueued)
    } catch (e) {
      failStatus(e)
    } finally {
      syncing = false
    }
  }

  /** First connection — must be called from a click (Google popup). */
  async function connect(): Promise<ConnectResult> {
    setSyncStatus({ phase: 'connecting' })
    try {
      await deps.gis.loadGis()
      const token = await deps.gis.getToken({ interactive: true })
      const folderId =
        (await withRetry(() => findFolder(deps.fetch, token))) ??
        (await withRetry(() => createFolder(deps.fetch, token)))
      const existing = await withRetry(() => findFile(deps.fetch, token, folderId))
      if (!existing) {
        const localSerialized = serialize(deps.loadLocal())
        const fileId = await withRetry(() =>
          createFile(deps.fetch, token, folderId, localSerialized),
        )
        markSynced(
          { enabled: true, folderId, fileId, lastSyncedAt: null, decisionPending: false },
          localSerialized,
        )
        return { outcome: 'connected' }
      }
      // progress already in Drive (second browser): download it now so the
      // decision dialog can show what's there, then wait for the choice
      const text = await withRetry(() => downloadFile(deps.fetch, token, existing.id))
      const remote = validateRemote(text)
      pendingRemote = remote
      saveSyncMeta({
        enabled: true,
        folderId,
        fileId: existing.id,
        lastSyncedAt: null,
        decisionPending: true,
      })
      setSyncStatus({ phase: 'pending-decision' })
      return {
        outcome: 'decision',
        remote: { verbs: Object.keys(remote.verbs).length, sessions: remote.sessions.length },
      }
    } catch (e) {
      // a failed connect leaves nothing behind: no meta, no link
      clearSyncMeta()
      pendingRemote = null
      setSyncStatus({ phase: 'disconnected' })
      throw e
    }
  }

  /** Summary for re-opening the decision dialog after a reload. */
  async function remoteSummary(): Promise<RemoteSummary> {
    const meta = loadSyncMeta()
    if (!meta) throw new Error('Not connected.')
    if (!pendingRemote) {
      const token = await deps.gis.getToken({ interactive: true })
      const text = await withRetry(() => downloadFile(deps.fetch, token, meta.fileId))
      pendingRemote = validateRemote(text)
    }
    return {
      verbs: Object.keys(pendingRemote.verbs).length,
      sessions: pendingRemote.sessions.length,
    }
  }

  /** "Use Drive progress": merge it into local, then push the union. */
  async function decideUse(): Promise<void> {
    const meta = loadSyncMeta()
    if (!meta) return
    saveSyncMeta({ ...meta, decisionPending: false })
    if (pendingRemote) {
      // union what connect() downloaded (the one place the ADDITIVE import
      // merge is right: two independent histories meeting for the first
      // time), and anchor the base at the remote we merged from — the
      // follow-up sync then computes exact deltas even if it races another
      // device's push
      const merged = mergeProgress(deps.loadLocal(), pendingRemote)
      if (serialize(merged) !== serialize(deps.loadLocal())) {
        deps.saveLocal(merged)
        deps.notifyChange()
      }
      saveSyncBase(serialize(pendingRemote))
      pendingRemote = null
    }
    await runSync(true)
  }

  /**
   * "Start fresh": this browser's progress overwrites the Drive copy
   * (checkbox-confirmed upstream). On failure the decision reverts to
   * pending — a half-applied reset must not let a later auto-sync quietly
   * resurrect the remote data the user chose to discard.
   */
  async function decideReset(): Promise<void> {
    const meta = loadSyncMeta()
    if (!meta) return
    saveSyncMeta({ ...meta, decisionPending: false })
    pendingRemote = null
    setSyncStatus({ phase: 'syncing' })
    try {
      const token = await deps.gis.getToken({ interactive: true })
      const localSerialized = serialize(deps.loadLocal())
      await withRetry(() => updateFile(deps.fetch, token, meta.fileId, localSerialized))
      markSynced({ ...meta, decisionPending: false }, localSerialized)
    } catch (e) {
      // the error status explains why; the persisted pending flag keeps the
      // gate closed and re-offers the choice
      saveSyncMeta({ ...meta, decisionPending: true })
      failStatus(e)
    }
  }

  /** Recovery from an unreadable Drive copy: push local over it. */
  async function overwriteRemote(): Promise<void> {
    const meta = loadSyncMeta()
    if (!meta) return
    setSyncStatus({ phase: 'syncing' })
    try {
      const token = await deps.gis.getToken({ interactive: true })
      const localSerialized = serialize(deps.loadLocal())
      await withRetry(() => updateFile(deps.fetch, token, meta.fileId, localSerialized))
      markSynced(meta, localSerialized)
    } catch (e) {
      failStatus(e)
    }
  }

  /** Quiz/load/route trigger: silent token only, never a popup. */
  async function autoSync(): Promise<void> {
    // 24h idle sign-out (owner rule): drop the token and require a click
    const meta = loadSyncMeta()
    if (meta && !meta.decisionPending && syncInactiveTooLong(meta, Date.parse(deps.now()))) {
      deps.gis.forgetToken()
      setSyncStatus({ phase: 'needs-reauth' })
      return
    }
    if (withinCooldown(AUTO_SYNC_COOLDOWN_MS)) return
    await runSync(false)
  }

  /** "Sync Now" / reauth click: a popup is acceptable. */
  async function manualSync(): Promise<void> {
    if (withinCooldown(MANUAL_SYNC_COOLDOWN_MS)) return
    await runSync(true)
  }

  /** Disconnect: revoke + forget everything. Local progress is untouched. */
  async function disconnect(): Promise<void> {
    await deps.gis.revokeToken().catch(() => undefined)
    clearSyncMeta()
    pendingRemote = null
    setSyncStatus({ phase: 'disconnected' })
  }

  return {
    connect,
    remoteSummary,
    decideUse,
    decideReset,
    overwriteRemote,
    autoSync,
    manualSync,
    disconnect,
  }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>

let engine: SyncEngine | null = null

/** Lazy singleton so every trigger shares one in-flight state + token.
 *  No test hook exists on purpose: browser tests fake Google at the
 *  network layer (route interception), keeping the production surface
 *  free of dependency-swapping entry points. */
export function getEngine(): SyncEngine {
  if (!engine) engine = createSyncEngine(defaultDeps())
  return engine
}
