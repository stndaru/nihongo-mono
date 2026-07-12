/**
 * nihongo mono — offline service worker (decision 72).
 *
 * Registered ONLY when the user enables "Offline access" in Settings —
 * users who never opt in never get a service worker at all. The Settings
 * page precaches every file from offline-manifest.json into CACHE; this
 * worker then serves the app when the network is gone.
 *
 * Rules:
 * - Cross-origin requests are NEVER touched (no respondWith): Google
 *   sign-in, the Drive API, and the translation providers keep their
 *   exact online/offline behavior — the sync engine's own offline
 *   handling stays authoritative.
 * - /assets/* are content-hashed and immutable → cache-first.
 * - Everything else same-origin (navigations, /data, /kuromoji, /ocr) →
 *   network-first so online users always see the live version, falling
 *   back to the cache offline; SPA navigations fall back to the cached
 *   index.html.
 * - Data files (stable names) are written through on successful network
 *   fetches so the offline copy stays fresh. index.html and the hashed
 *   assets are NOT written through — they only change together, via the
 *   explicit "Update Offline Copy" flow, so the cached app snapshot can
 *   never tear into a broken old-shell/new-chunk mix.
 */
const CACHE = 'nihongo-mono-offline-v1'
// every URL has exactly one cached entry; Vary matching would only break
// hits (e.g. `Vary: Origin` + the crossorigin module scripts' Origin
// header vs the precache's plain fetches)
const MATCH = { ignoreVary: true }

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/** @param {string} pathname */
const isImmutableAsset = (pathname) => pathname.startsWith('/assets/')
/** @param {string} pathname */
const isWriteThrough = (pathname) =>
  pathname.startsWith('/data/') || pathname.startsWith('/kuromoji/') || pathname.startsWith('/ocr/')

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // Google/translation: hands off

  if (isImmutableAsset(url.pathname)) {
    event.respondWith(
      caches
        .open(CACHE)
        .then(async (cache) => (await cache.match(request, MATCH)) ?? fetch(request)),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response.ok && isWriteThrough(url.pathname) && (await cache.match(request, MATCH))) {
          await cache.put(request, response.clone())
        }
        return response
      } catch (err) {
        const hit = await cache.match(request, MATCH)
        if (hit) return hit
        if (request.mode === 'navigate') {
          const shell = await cache.match('/index.html', MATCH)
          if (shell) return shell
        }
        throw err
      }
    })(),
  )
})
