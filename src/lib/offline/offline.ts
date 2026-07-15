/**
 * "Offline access" (decision 72): opt-in, whole-app precache.
 *
 * Enabling registers the service worker (public/sw.js) and downloads
 * every file in the build's offline-manifest.json into Cache Storage —
 * app shell, all datasets, and kuromoji. OCR has a separate optional pack.
 * The worker
 * then serves the app with no connection, across tab closes and browser
 * restarts. Image scanning also registers the worker after its own opt-in.
 *
 * Everything here runs from the Settings page only; nothing is imported
 * on normal loads. The meta in localStorage is small bookkeeping — the
 * actual files live in Cache Storage under OFFLINE_CACHE.
 */

/** Must match the cache name in public/sw.js. */
export const OFFLINE_CACHE = 'nihongo-mono-offline-v1'
const META_KEY = 'nihongo-mono:offline:v1'
export const MANIFEST_URL = '/offline-manifest.json'
const CONCURRENCY = 6

export function hasOcrOfflineCache(cacheNames: readonly string[]): boolean {
  return cacheNames.some((name) => name.startsWith('nihongo-mono-ocr-paddle-'))
}

export interface OfflineMeta {
  /** manifest version the copy was downloaded from */
  version: string
  bytes: number
  files: number
  completedAt: string
  /** did the browser grant persistent storage (protection from eviction) */
  persisted: boolean
}

export interface OfflineManifest {
  version: string
  totalBytes: number
  /** [path, bytes] for every same-origin file the app can fetch */
  files: [string, number][]
}

/** Cache Storage + service workers need a secure context (https/localhost). */
export function offlineSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof caches !== 'undefined' &&
    window.isSecureContext
  )
}

export function loadOfflineMeta(): OfflineMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<OfflineMeta> | null
    if (
      !data ||
      typeof data !== 'object' ||
      typeof data.version !== 'string' ||
      typeof data.bytes !== 'number' ||
      typeof data.files !== 'number' ||
      typeof data.completedAt !== 'string'
    ) {
      return null
    }
    return {
      version: data.version,
      bytes: data.bytes,
      files: data.files,
      completedAt: data.completedAt,
      persisted: data.persisted === true,
    }
  } catch {
    return null
  }
}

function saveOfflineMeta(meta: OfflineMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // bookkeeping only — the cache itself still works
  }
}

function clearOfflineMeta(): void {
  try {
    localStorage.removeItem(META_KEY)
  } catch {
    // nothing to clear
  }
}

/** Validate untrusted-ish JSON into a manifest (exported for tests). */
export function parseManifest(text: string): OfflineManifest {
  const data = JSON.parse(text) as Partial<OfflineManifest> | null
  if (
    !data ||
    typeof data !== 'object' ||
    typeof data.version !== 'string' ||
    typeof data.totalBytes !== 'number' ||
    !Array.isArray(data.files) ||
    !data.files.every(
      (f) =>
        Array.isArray(f) && typeof f[0] === 'string' && f[0].startsWith('/') && typeof f[1] === 'number',
    )
  ) {
    throw new Error('offline manifest is malformed')
  }
  return { version: data.version, totalBytes: data.totalBytes, files: data.files }
}

export async function fetchManifest(): Promise<OfflineManifest> {
  const res = await fetch(MANIFEST_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`manifest fetch failed (${res.status})`)
  return parseManifest(await res.text())
}

/**
 * index.html goes LAST (exported for tests): the worker's offline
 * navigation fallback serves the cached shell, so the shell must never
 * be written before every chunk it references — a torn download then
 * leaves the previous copy fully working instead of a broken mix.
 */
export function downloadOrder(files: [string, number][]): [string, number][] {
  const rest = files.filter(([path]) => path !== '/index.html')
  const shell = files.filter(([path]) => path === '/index.html')
  return [...rest, ...shell]
}

/** Does the cache still hold a servable copy? (eviction detection) */
export async function cacheIntact(): Promise<boolean> {
  try {
    if (!(await caches.has(OFFLINE_CACHE))) return false
    const cache = await caches.open(OFFLINE_CACHE)
    return (await cache.match('/index.html', { ignoreVary: true })) !== undefined
  } catch {
    return false
  }
}

/**
 * Download the manifest's files into the cache (also used to update an
 * existing copy — same-name puts overwrite, stale entries are pruned at
 * the end). Progress reports cumulative manifest bytes, not wire bytes.
 * Throws on any failed file; a FIRST download that fails is rolled back
 * so no half-cache lingers, while a failed UPDATE keeps the old copy
 * (index.html is written last — see downloadOrder).
 */
export async function enableOffline(
  manifest: OfflineManifest,
  onProgress: (doneBytes: number) => void,
  signal?: AbortSignal,
): Promise<OfflineMeta> {
  const hadCopy = loadOfflineMeta() !== null && (await cacheIntact())
  await navigator.serviceWorker.register('/sw.js')
  const cache = await caches.open(OFFLINE_CACHE)
  const queue = downloadOrder(manifest.files)
  let done = 0
  let index = 0
  try {
    const worker = async () => {
      for (;;) {
        const i = index++
        if (i >= queue.length) return
        const [path, size] = queue[i]
        // no-cache: revalidate against the server so the offline copy is
        // the live version, not whatever the HTTP cache had lying around
        const res = await fetch(path, { cache: 'no-cache', signal })
        if (!res.ok) throw new Error(`${path} failed (${res.status})`)
        await cache.put(path, res)
        done += size
        onProgress(done)
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    // prune files that no longer exist in this version
    const keep = new Set(manifest.files.map(([path]) => path))
    for (const req of await cache.keys()) {
      if (!keep.has(new URL(req.url).pathname)) await cache.delete(req)
    }
  } catch (err) {
    if (!hadCopy) {
      // first download failed: leave nothing behind
      await caches.delete(OFFLINE_CACHE).catch(() => undefined)
      if (!hasOcrOfflineCache(await caches.keys())) {
        const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
        await Promise.all(regs.map((r) => r.unregister()))
      }
      clearOfflineMeta()
    }
    throw err
  }
  // ask the browser to protect the data from storage-pressure eviction
  let persisted = false
  try {
    persisted = (await navigator.storage?.persist?.()) === true
  } catch {
    persisted = false
  }
  const meta: OfflineMeta = {
    version: manifest.version,
    bytes: manifest.totalBytes,
    files: manifest.files.length,
    completedAt: new Date().toISOString(),
    persisted,
  }
  saveOfflineMeta(meta)
  return meta
}

/** Remove everything: worker, cache, bookkeeping. Local data untouched. */
export async function removeOffline(): Promise<void> {
  await caches.delete(OFFLINE_CACHE).catch(() => undefined)
  const hasOcr = hasOcrOfflineCache(await caches.keys())
  if (!hasOcr) {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
    await Promise.all(regs.map((r) => r.unregister()))
  }
  clearOfflineMeta()
}

export function formatMB(bytes: number): string {
  return `${(bytes / 1048576).toFixed(bytes >= 104857600 ? 0 : 1)} MB`
}
