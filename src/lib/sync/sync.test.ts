import { beforeEach, describe, expect, it } from 'vitest'
import { emptyProgress, type ProgressData } from '@/lib/progress/store'
import { backoffDelay, MAX_ATTEMPTS } from './backoff'
import { classifyDriveError, escapeQ } from './drive'
import { merge3 } from './merge3'
import { clearSyncMeta, loadSyncMeta, saveSyncMeta } from './meta'
import { MAX_REMOTE_BYTES, RemoteInvalidError, validateRemote } from './remote'
import type { SyncMeta } from './types'

// vitest runs in node — give the meta module a real-enough localStorage
const backing = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
}

beforeEach(() => backing.clear())

describe('meta', () => {
  const meta: SyncMeta = {
    enabled: true,
    folderId: 'folder123',
    fileId: 'file456',
    lastSyncedAt: '2026-07-11T10:00:00.000Z',
    decisionPending: false,
  }

  it('round-trips', () => {
    saveSyncMeta(meta)
    expect(loadSyncMeta()).toEqual(meta)
    clearSyncMeta()
    expect(loadSyncMeta()).toBeNull()
  })

  it('never persists anything token-shaped (security invariant)', () => {
    saveSyncMeta(meta)
    const raw = backing.get('nihongo-mono:drive-sync:v1')!
    expect(raw).not.toMatch(/token/i)
    expect(raw).not.toMatch(/bearer/i)
    // the type itself has no token field — this guards against regressions
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      'decisionPending',
      'enabled',
      'fileId',
      'folderId',
      'lastSyncedAt',
    ])
  })

  it('rejects malformed stored values instead of throwing', () => {
    backing.set('nihongo-mono:drive-sync:v1', 'not json')
    expect(loadSyncMeta()).toBeNull()
    backing.set('nihongo-mono:drive-sync:v1', JSON.stringify({ enabled: true }))
    expect(loadSyncMeta()).toBeNull()
    backing.set(
      'nihongo-mono:drive-sync:v1',
      JSON.stringify({ enabled: true, folderId: 'f', fileId: 'x' }),
    )
    expect(loadSyncMeta()).toEqual({
      enabled: true,
      folderId: 'f',
      fileId: 'x',
      lastSyncedAt: null,
      decisionPending: false,
    })
  })
})

describe('backoff', () => {
  it('doubles per attempt with bounded jitter', () => {
    const noJitter = () => 0
    expect([0, 1, 2, 3, 4].map((a) => backoffDelay(a, noJitter))).toEqual([
      1000, 2000, 4000, 8000, 16000,
    ])
    // jitter stays under 250ms
    expect(backoffDelay(0, () => 0.999)).toBeLessThan(1250)
    // attempts beyond the ceiling clamp
    expect(backoffDelay(99, noJitter)).toBe(16000)
    expect(MAX_ATTEMPTS).toBe(5)
  })
})

describe('escapeQ', () => {
  it('escapes quotes and backslashes for Drive q queries', () => {
    expect(escapeQ("it's")).toBe("it\\'s")
    expect(escapeQ('a\\b')).toBe('a\\\\b')
    expect(escapeQ("\\'")).toBe("\\\\\\'")
  })
})

describe('classifyDriveError', () => {
  const body = (reason: string) => ({ error: { errors: [{ reason }] } })
  it('maps every failure the sync matrix handles', () => {
    expect(classifyDriveError(401, null)).toBe('auth')
    expect(classifyDriveError(429, null)).toBe('rate-limit')
    expect(classifyDriveError(404, null)).toBe('not-found')
    expect(classifyDriveError(403, body('rateLimitExceeded'))).toBe('rate-limit')
    expect(classifyDriveError(403, body('userRateLimitExceeded'))).toBe('rate-limit')
    expect(classifyDriveError(403, body('storageQuotaExceeded'))).toBe('storage-quota')
    expect(classifyDriveError(403, body('insufficientPermissions'))).toBe('auth')
    expect(classifyDriveError(403, body('somethingElse'))).toBe('unknown')
    expect(classifyDriveError(500, null)).toBe('unknown')
    expect(classifyDriveError(403, 'not an object')).toBe('unknown')
  })
})

describe('merge3', () => {
  const stat = (seen: number, correct: number, lastSeen = '2026-07-10') => ({
    seen,
    correct,
    wrong: seen - correct,
    lastSeen,
  })
  const session = (date: string, total = 5, correct = 4) => ({
    date,
    total,
    correct,
    forms: [],
  })
  const prog = (over: Partial<ProgressData>): ProgressData => ({
    ...emptyProgress(),
    ...over,
  })

  it('is idempotent: merging identical states changes nothing', () => {
    const state = prog({
      verbs: { a: stat(3, 2) },
      sessions: [session('2026-07-10')],
      forms: { te: { seen: 3, correct: 2 } },
      streak: { current: 2, best: 4, lastActiveDay: '2026-07-10' },
    })
    expect(merge3(state, state, state)).toEqual(state)
  })

  it('adds each side’s delta exactly once on concurrent changes', () => {
    const base = prog({ verbs: { a: stat(2, 1) }, sessions: [session('2026-07-09')] })
    const local = prog({
      verbs: { a: stat(4, 3, '2026-07-11'), b: stat(1, 1, '2026-07-11') },
      sessions: [session('2026-07-09'), session('2026-07-11')],
    })
    const remote = prog({
      verbs: { a: stat(3, 2, '2026-07-10'), c: stat(2, 0, '2026-07-10') },
      sessions: [session('2026-07-09'), session('2026-07-10')],
    })
    const merged = merge3(base, local, remote)
    // a: remote 3 + local delta (4-2)=2 → 5 seen; correct 2 + (3-1)=4
    expect(merged.verbs.a).toMatchObject({ seen: 5, correct: 4, lastSeen: '2026-07-11' })
    expect(merged.verbs.b.seen).toBe(1) // local-only
    expect(merged.verbs.c.seen).toBe(2) // remote-only
    expect(merged.sessions.map((s) => s.date)).toEqual([
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
    ])
  })

  it('propagates a remote reset instead of resurrecting old data', () => {
    const shared = prog({ verbs: { a: stat(5, 5) }, sessions: [session('2026-07-09')] })
    // other device chose "start fresh": remote is now empty; this device
    // made no changes since base — everything should follow the reset
    const merged = merge3(shared, shared, emptyProgress())
    expect(merged.verbs).toEqual({})
    expect(merged.sessions).toEqual([])
  })

  it('keeps only the local delta when remote lost a verb this device kept practicing', () => {
    const base = prog({ verbs: { a: stat(2, 2) } })
    const local = prog({ verbs: { a: stat(5, 4, '2026-07-11') } })
    const merged = merge3(base, local, emptyProgress())
    expect(merged.verbs.a).toMatchObject({ seen: 3, correct: 2 })
  })

  it('counts duplicate-looking sessions via multiset difference', () => {
    const twice = [session('2026-07-10'), session('2026-07-10')]
    const base = prog({ sessions: [twice[0]] })
    const local = prog({ sessions: twice }) // one genuinely new identical record
    const remote = prog({ sessions: [twice[0]] })
    expect(merge3(base, local, remote).sessions).toHaveLength(2)
  })

  it('streak: the most recently active timeline wins, best is a high-water mark', () => {
    const base = emptyProgress()
    const local = prog({ streak: { current: 1, best: 9, lastActiveDay: '2026-07-10' } })
    const remote = prog({ streak: { current: 4, best: 4, lastActiveDay: '2026-07-11' } })
    expect(merge3(base, local, remote).streak).toEqual({
      current: 4,
      best: 9,
      lastActiveDay: '2026-07-11',
    })
  })
})

describe('validateRemote', () => {
  it('accepts a real progress file', () => {
    const data = emptyProgress()
    expect(validateRemote(JSON.stringify(data))).toEqual(data)
  })
  it('rejects oversize payloads before parsing', () => {
    expect(() => validateRemote('x'.repeat(MAX_REMOTE_BYTES + 1))).toThrow(RemoteInvalidError)
  })
  it('rejects non-JSON and wrong-shape payloads', () => {
    expect(() => validateRemote('nope')).toThrow(RemoteInvalidError)
    expect(() => validateRemote('{"version":2}')).toThrow(RemoteInvalidError)
    expect(() => validateRemote('{"version":1}')).toThrow(RemoteInvalidError)
  })
  it('migrates additively like the file-import path', () => {
    const minimal = { version: 1, verbs: {}, sessions: [] } as unknown as ProgressData
    const parsed = validateRemote(JSON.stringify(minimal))
    expect(parsed.forms).toEqual({})
    expect(parsed.streak).toEqual({ current: 0, best: 0, lastActiveDay: null })
  })
})
