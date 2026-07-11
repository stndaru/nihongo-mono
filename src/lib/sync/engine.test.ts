import { beforeEach, describe, expect, it } from 'vitest'
import { applySession, emptyProgress, type ProgressData } from '@/lib/progress/store'
import {
  AUTO_SYNC_COOLDOWN_MS,
  createSyncEngine,
  MANUAL_SYNC_COOLDOWN_MS,
  type EngineDeps,
} from './engine'
import { AuthRequiredError } from './gis-loader'
import { loadSyncMeta, saveSyncBase, saveSyncMeta } from './meta'
import { getSyncStatus, setSyncStatus } from './status-store'

// node has no localStorage — back the meta module with a Map
const backing = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
}

/** In-memory Drive: one folder slot, one file slot, injectable failures. */
function makeDrive(initial?: { folder?: string; file?: { id: string; content: string } }) {
  const state = {
    folder: initial?.folder ?? null,
    file: initial?.file ?? null,
    requests: [] as { method: string; url: string }[],
    /** next N matching calls fail with this HTTP response */
    failures: [] as { match: (url: string, method: string) => boolean; status: number; reason?: string }[],
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status })
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    state.requests.push({ method, url })
    const failIdx = state.failures.findIndex((f) => f.match(url, method))
    if (failIdx >= 0) {
      const [f] = state.failures.splice(failIdx, 1)
      return json({ error: { errors: [{ reason: f.reason ?? '' }] } }, f.status)
    }
    if (url.includes('/drive/v3/files?q=')) {
      const q = decodeURIComponent(url)
      if (q.includes('vnd.google-apps.folder')) {
        return json({ files: state.folder ? [{ id: state.folder }] : [] })
      }
      return json({
        files: state.file ? [{ id: state.file.id, modifiedTime: '2026-07-11T00:00:00Z' }] : [],
      })
    }
    if (url.includes('/upload/drive/v3/files?uploadType=multipart')) {
      const body = String(init?.body)
      const content = body.split('\r\n\r\n')[2]?.split('\r\n--')[0] ?? ''
      state.file = { id: 'file-new', content }
      return json({ id: 'file-new' })
    }
    if (url.includes('/upload/drive/v3/files/') && method === 'PATCH') {
      if (!state.file) return json({ error: {} }, 404)
      state.file = { ...state.file, content: String(init?.body) }
      return json({ id: state.file.id })
    }
    if (url.includes('alt=media')) {
      if (!state.file) return json({ error: {} }, 404)
      return new Response(state.file.content, { status: 200 })
    }
    if (url.includes('/drive/v3/files?fields=id') && method === 'POST') {
      state.folder = 'folder-new'
      return json({ id: 'folder-new' })
    }
    return json({ error: {} }, 500)
  }
  return { state, fetchImpl }
}

function makeDeps(drive: ReturnType<typeof makeDrive>, opts?: { silentAuthFails?: boolean }) {
  const local = { data: emptyProgress() }
  const events = {
    delays: [] as number[],
    notified: 0,
    forgot: 0,
    revoked: 0,
    onlineCb: null as (() => void) | null,
  }
  const deps: EngineDeps = {
    fetch: drive.fetchImpl,
    gis: {
      loadGis: async () => undefined,
      getToken: async ({ interactive }) => {
        if (!interactive && opts?.silentAuthFails) throw new AuthRequiredError('expired')
        return 'test-token'
      },
      revokeToken: async () => void (events.revoked += 1),
      forgetToken: () => void (events.forgot += 1),
    },
    loadLocal: () => local.data,
    saveLocal: (d) => void (local.data = d),
    now: () => '2026-07-11T12:00:00.000Z',
    delay: async (ms) => void events.delays.push(ms),
    random: () => 0,
    notifyChange: () => void (events.notified += 1),
    onceOnline: (cb) => void (events.onlineCb = cb),
  }
  return { deps, local, events }
}

const someProgress = (): ProgressData =>
  applySession(emptyProgress(), {
    answers: [{ verbId: '1358280', correct: true, form: 'te' }],
    forms: ['te'],
  })

const linkedMeta = (decisionPending = false, base?: ProgressData) => {
  saveSyncMeta({
    enabled: true,
    folderId: 'folder-1',
    fileId: 'file-1',
    lastSyncedAt: null,
    decisionPending,
  })
  if (base) saveSyncBase(JSON.stringify(base))
}

beforeEach(() => {
  backing.clear()
  setSyncStatus({ phase: 'disconnected' })
})

describe('connect', () => {
  it('first device: creates folder + file with local progress, links, syncs', async () => {
    const drive = makeDrive() // empty Drive
    const { deps, local } = makeDeps(drive)
    local.data = someProgress()
    const engine = createSyncEngine(deps)
    const result = await engine.connect()
    expect(result.outcome).toBe('connected')
    expect(drive.state.folder).toBe('folder-new')
    expect(JSON.parse(drive.state.file!.content).version).toBe(1)
    expect(loadSyncMeta()).toMatchObject({ fileId: 'file-new', decisionPending: false })
    expect(getSyncStatus().phase).toBe('synced')
  })

  it('second browser: existing file → pending decision with remote summary', async () => {
    const remote = someProgress()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(remote) },
    })
    const engine = createSyncEngine(makeDeps(drive).deps)
    const result = await engine.connect()
    expect(result).toEqual({ outcome: 'decision', remote: { verbs: 1, sessions: 1 } })
    expect(loadSyncMeta()).toMatchObject({ decisionPending: true })
    expect(getSyncStatus().phase).toBe('pending-decision')
  })

  it('a failed connect leaves nothing behind', async () => {
    const drive = makeDrive()
    drive.state.failures.push({ match: () => true, status: 500 })
    const engine = createSyncEngine(makeDeps(drive).deps)
    await expect(engine.connect()).rejects.toThrow()
    expect(loadSyncMeta()).toBeNull()
    expect(getSyncStatus().phase).toBe('disconnected')
  })
})

describe('decision gate', () => {
  it('autoSync does nothing while the decision is pending', async () => {
    linkedMeta(true)
    const drive = makeDrive({ folder: 'f', file: { id: 'file-1', content: '{}' } })
    const engine = createSyncEngine(makeDeps(drive).deps)
    await engine.autoSync()
    expect(drive.state.requests).toHaveLength(0)
  })

  it('decideUse merges the remote into local and pushes the union', async () => {
    const remote = someProgress()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(remote) },
    })
    const { deps, local, events } = makeDeps(drive)
    const engine = createSyncEngine(deps)
    await engine.connect() // parks pendingRemote + decisionPending meta
    await engine.decideUse()
    expect(local.data.verbs['1358280'].seen).toBe(1) // remote merged in
    expect(events.notified).toBeGreaterThan(0)
    expect(loadSyncMeta()).toMatchObject({ decisionPending: false })
    expect(getSyncStatus().phase).toBe('synced')
  })

  it('decideReset overwrites Drive with local, keeping local untouched', async () => {
    const remote = someProgress()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(remote) },
    })
    const { deps, local } = makeDeps(drive) // local = empty (fresh browser)
    const engine = createSyncEngine(deps)
    await engine.connect()
    await engine.decideReset()
    expect(JSON.parse(drive.state.file!.content)).toEqual(emptyProgress())
    expect(local.data).toEqual(emptyProgress())
    expect(getSyncStatus().phase).toBe('synced')
  })
})

describe('syncNow (pull-merge-push)', () => {
  it('pulls remote-only data in, pushes local-only data out', async () => {
    linkedMeta()
    const remote = someProgress()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(remote) },
    })
    const { deps, local, events } = makeDeps(drive)
    local.data = applySession(emptyProgress(), {
      answers: [{ verbId: '1343950', correct: true, form: 'past' }],
      forms: ['past'],
    })
    await createSyncEngine(deps).autoSync()
    // both sides now hold the union
    expect(Object.keys(local.data.verbs).sort()).toEqual(['1343950', '1358280'])
    expect(Object.keys(JSON.parse(drive.state.file!.content).verbs).sort()).toEqual([
      '1343950',
      '1358280',
    ])
    expect(events.notified).toBe(1)
    expect(getSyncStatus()).toEqual({ phase: 'synced', lastSyncedAt: '2026-07-11T12:00:00.000Z' })
  })

  it('skips the upload when nothing changed', async () => {
    const data = someProgress()
    linkedMeta(false, data)
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(data) },
    })
    const { deps, local, events } = makeDeps(drive)
    local.data = data
    await createSyncEngine(deps).autoSync()
    expect(drive.state.requests.filter((r) => r.method === 'PATCH')).toHaveLength(0)
    expect(events.notified).toBe(0)
    expect(getSyncStatus().phase).toBe('synced')
  })

  it('repeated syncs never inflate counts (three-way merge, not additive)', async () => {
    const data = someProgress()
    linkedMeta(false, data)
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(data) },
    })
    const { deps, local } = makeDeps(drive)
    local.data = data
    const engine = createSyncEngine(deps)
    await engine.autoSync()
    await engine.autoSync()
    await engine.autoSync()
    expect(local.data.verbs['1358280'].seen).toBe(1)
    expect(JSON.parse(drive.state.file!.content).verbs['1358280'].seen).toBe(1)
    expect(local.data.sessions).toHaveLength(1)
  })

  it('concurrent deltas from two devices each count exactly once', async () => {
    // shared history: both devices synced `data`; this device adds one
    // more answer; the other device already pushed its own extra answer
    const data = someProgress()
    const otherDevice = applySession(data, {
      answers: [{ verbId: '1296400', correct: false, form: 'negative' }],
      forms: ['negative'],
    })
    linkedMeta(false, data)
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(otherDevice) },
    })
    const { deps, local } = makeDeps(drive)
    local.data = applySession(data, {
      answers: [{ verbId: '1358280', correct: true, form: 'te' }],
      forms: ['te'],
    })
    await createSyncEngine(deps).autoSync()
    // 1358280: 1 shared + 1 local delta = 2; 1296400: remote's 1; no doubling
    expect(local.data.verbs['1358280'].seen).toBe(2)
    expect(local.data.verbs['1296400'].seen).toBe(1)
    expect(local.data.sessions).toHaveLength(3)
    expect(JSON.parse(drive.state.file!.content)).toEqual(local.data)
  })

  it('retries rate limits with backoff, then succeeds', async () => {
    linkedMeta()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(emptyProgress()) },
    })
    drive.state.failures.push(
      { match: (u) => u.includes('alt=media'), status: 403, reason: 'rateLimitExceeded' },
      { match: (u) => u.includes('alt=media'), status: 429 },
    )
    const { deps, events } = makeDeps(drive)
    await createSyncEngine(deps).autoSync()
    expect(events.delays).toEqual([1000, 2000])
    expect(getSyncStatus().phase).toBe('synced')
  })

  it('exhausted rate-limit retries land in error{rate-limit}', async () => {
    linkedMeta()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(emptyProgress()) },
    })
    for (let i = 0; i < 6; i++) {
      drive.state.failures.push({
        match: (u) => u.includes('alt=media'),
        status: 403,
        reason: 'userRateLimitExceeded',
      })
    }
    const { deps } = makeDeps(drive)
    await createSyncEngine(deps).autoSync()
    expect(getSyncStatus()).toEqual({ phase: 'error', kind: 'rate-limit' })
  })

  it('401 lands in needs-reauth and forgets the token', async () => {
    linkedMeta()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(emptyProgress()) },
    })
    drive.state.failures.push({ match: (u) => u.includes('alt=media'), status: 401 })
    const { deps, events } = makeDeps(drive)
    await createSyncEngine(deps).autoSync()
    expect(getSyncStatus().phase).toBe('needs-reauth')
    expect(events.forgot).toBe(1)
  })

  it('silent-token failure lands in needs-reauth without any request', async () => {
    linkedMeta()
    const drive = makeDrive()
    const { deps } = makeDeps(drive, { silentAuthFails: true })
    await createSyncEngine(deps).autoSync()
    expect(getSyncStatus().phase).toBe('needs-reauth')
    expect(drive.state.requests).toHaveLength(0)
  })

  it('storage quota exceeded lands in error{storage-quota}', async () => {
    linkedMeta()
    const remote = someProgress()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(remote) },
    })
    drive.state.failures.push({
      match: (_u, m) => m === 'PATCH',
      status: 403,
      reason: 'storageQuotaExceeded',
    })
    const { deps, local } = makeDeps(drive)
    local.data = applySession(emptyProgress(), {
      answers: [{ verbId: '1343950', correct: true, form: 'past' }],
      forms: ['past'],
    })
    await createSyncEngine(deps).autoSync()
    expect(getSyncStatus()).toEqual({ phase: 'error', kind: 'storage-quota' })
  })

  it('offline errors arm a one-shot online retry', async () => {
    linkedMeta()
    const data = someProgress()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(data) },
    })
    const { deps, events } = makeDeps(drive)
    const failingOnce: typeof fetch = (() => {
      let failed = false
      return async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        if (!failed) {
          failed = true
          throw new TypeError('network down')
        }
        return drive.fetchImpl(input, init)
      }
    })()
    await createSyncEngine({ ...deps, fetch: failingOnce }).autoSync()
    expect(getSyncStatus()).toEqual({ phase: 'error', kind: 'offline' })
    expect(events.onlineCb).not.toBeNull()
    events.onlineCb!() // fire-and-forget by design — wait for it to settle
    for (let i = 0; i < 50 && getSyncStatus().phase !== 'synced'; i++) {
      await new Promise((r) => setTimeout(r, 0))
    }
    expect(getSyncStatus().phase).toBe('synced')
  })

  it('remote file deleted in Drive → recreates and pushes local', async () => {
    linkedMeta() // fileId 'file-1' no longer exists
    const drive = makeDrive({ folder: 'folder-1' }) // folder exists, file gone
    const { deps, local } = makeDeps(drive)
    local.data = someProgress()
    await createSyncEngine(deps).autoSync()
    expect(drive.state.file).not.toBeNull()
    expect(JSON.parse(drive.state.file!.content).sessions).toHaveLength(1)
    expect(loadSyncMeta()).toMatchObject({ fileId: 'file-new' })
    expect(getSyncStatus().phase).toBe('synced')
  })

  it('an unreadable Drive copy lands in error{remote-invalid}; overwrite recovers', async () => {
    linkedMeta()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: 'corrupted!!' },
    })
    const { deps, local } = makeDeps(drive)
    local.data = someProgress()
    const engine = createSyncEngine(deps)
    await engine.autoSync()
    expect(getSyncStatus()).toEqual({ phase: 'error', kind: 'remote-invalid' })
    await engine.overwriteRemote()
    expect(JSON.parse(drive.state.file!.content).sessions).toHaveLength(1)
    expect(getSyncStatus().phase).toBe('synced')
  })

  it('single-flight: a trigger mid-sync queues exactly one rerun', async () => {
    linkedMeta()
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(emptyProgress()) },
    })
    const { deps } = makeDeps(drive)
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const gatedFetch: typeof fetch = async (input, init) => {
      await gate
      return drive.fetchImpl(input, init)
    }
    const engine = createSyncEngine({ ...deps, fetch: gatedFetch })
    const first = engine.autoSync()
    const second = engine.autoSync() // queued
    const third = engine.autoSync() // collapses into the same queued rerun
    release()
    await Promise.all([first, second, third])
    const downloads = drive.state.requests.filter((r) => r.url.includes('alt=media'))
    expect(downloads).toHaveLength(2) // initial + exactly one rerun
    expect(getSyncStatus().phase).toBe('synced')
  })
})

describe('trigger throttle (abuse guard)', () => {
  const T0 = Date.parse('2026-07-11T12:00:00.000Z')
  /** linked + in-sync setup with a mutable clock driving deps.now */
  function throttledSetup() {
    const data = someProgress()
    linkedMeta(false, data)
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(data) },
    })
    const made = makeDeps(drive)
    made.local.data = data
    const clock = { ms: T0 }
    made.deps.now = () => new Date(clock.ms).toISOString()
    return { ...made, drive, clock }
  }

  it('spammed auto triggers after a fresh sync make zero requests', async () => {
    const { deps, drive, clock } = throttledSetup()
    const engine = createSyncEngine(deps)
    await engine.autoSync()
    const count = drive.state.requests.length
    clock.ms += 1000
    for (let i = 0; i < 10; i++) await engine.autoSync()
    expect(drive.state.requests).toHaveLength(count)
    // past the cooldown the next trigger syncs for real again
    clock.ms += AUTO_SYNC_COOLDOWN_MS
    await engine.autoSync()
    expect(drive.state.requests.length).toBeGreaterThan(count)
  })

  it('new local data bypasses the cooldown (quiz results always upload)', async () => {
    const { deps, drive, local, clock } = throttledSetup()
    const engine = createSyncEngine(deps)
    await engine.autoSync()
    const count = drive.state.requests.length
    clock.ms += 1000
    local.data = applySession(local.data, {
      answers: [{ verbId: '1343950', correct: true, form: 'past' }],
      forms: ['past'],
    })
    await engine.autoSync()
    expect(drive.state.requests.length).toBeGreaterThan(count)
    expect(JSON.parse(drive.state.file!.content).verbs['1343950']).toBeTruthy()
  })

  it('manual Sync Now has its own shorter cooldown', async () => {
    const { deps, drive, clock } = throttledSetup()
    const engine = createSyncEngine(deps)
    await engine.manualSync()
    const count = drive.state.requests.length
    clock.ms += 1000
    await engine.manualSync() // click-mash: within the manual cooldown
    expect(drive.state.requests).toHaveLength(count)
    clock.ms += MANUAL_SYNC_COOLDOWN_MS
    await engine.manualSync() // a deliberate re-click later runs
    expect(drive.state.requests.length).toBeGreaterThan(count)
  })

  it('a failure never starts a cooldown — recovery clicks run immediately', async () => {
    const { deps, drive, clock } = throttledSetup()
    drive.state.failures.push({ match: (u) => u.includes('alt=media'), status: 401 })
    const engine = createSyncEngine(deps)
    await engine.autoSync()
    expect(getSyncStatus().phase).toBe('needs-reauth')
    clock.ms += 1000
    await engine.manualSync()
    expect(getSyncStatus().phase).toBe('synced')
  })
})

describe('24h inactivity sign-out', () => {
  // deps.now is fixed at 2026-07-11T12:00:00Z
  const linkedAt = (lastSyncedAt: string, data: ProgressData) => {
    saveSyncMeta({
      enabled: true,
      folderId: 'folder-1',
      fileId: 'file-1',
      lastSyncedAt,
      decisionPending: false,
    })
    saveSyncBase(JSON.stringify(data))
  }

  it('auto-sync stands down after 24h idle; a manual sync resumes', async () => {
    const data = someProgress()
    linkedAt('2026-07-10T11:00:00.000Z', data) // 25h before deps.now
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(data) },
    })
    const { deps, local, events } = makeDeps(drive)
    local.data = data
    const engine = createSyncEngine(deps)
    await engine.autoSync()
    expect(drive.state.requests).toHaveLength(0) // signed out: no Google traffic
    expect(events.forgot).toBe(1) // token dropped — a real sign-out
    expect(getSyncStatus().phase).toBe('needs-reauth')
    await engine.manualSync() // the sign-in click
    expect(getSyncStatus().phase).toBe('synced')
    expect(loadSyncMeta()?.lastSyncedAt).toBe('2026-07-11T12:00:00.000Z') // fresh again
  })

  it('under 24h idle auto-sync runs normally', async () => {
    const data = someProgress()
    linkedAt('2026-07-10T13:00:00.000Z', data) // 23h before deps.now
    const drive = makeDrive({
      folder: 'folder-1',
      file: { id: 'file-1', content: JSON.stringify(data) },
    })
    const { deps, local } = makeDeps(drive)
    local.data = data
    await createSyncEngine(deps).autoSync()
    expect(drive.state.requests.length).toBeGreaterThan(0)
    expect(getSyncStatus().phase).toBe('synced')
  })
})

describe('disconnect', () => {
  it('revokes, clears the link, leaves local data alone', async () => {
    linkedMeta()
    const drive = makeDrive()
    const { deps, local, events } = makeDeps(drive)
    local.data = someProgress()
    await createSyncEngine(deps).disconnect()
    expect(events.revoked).toBe(1)
    expect(loadSyncMeta()).toBeNull()
    expect(getSyncStatus().phase).toBe('disconnected')
    expect(local.data.sessions).toHaveLength(1)
  })
})
