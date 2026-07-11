/**
 * Google Identity Services loader + token acquisition.
 *
 * SECURITY PROPERTIES (decision 70):
 * - The script is injected only when this module's functions run, and this
 *   module is only reachable through the lazily-imported sync engine — a
 *   user who never connects Drive never loads Google code.
 * - The access token lives in module memory plus THIS TAB's
 *   sessionStorage (owner request: staying signed in across reloads —
 *   GIS can't reliably re-mint silently once browsers block third-party
 *   cookies). It is tab-scoped, gone when the tab closes, expires within
 *   the hour, and NEVER goes to localStorage. The CSP's connect-src
 *   allowlist bounds where a stolen token could even be sent.
 * - The one requested scope is drive.file; the grant is verified with
 *   hasGrantedAllScopes before the token is accepted.
 * - Each token request carries a generation number; callbacks from a
 *   superseded request are dropped (stale-callback defense).
 */

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GSI_SRC = 'https://accounts.google.com/gsi/client'
const SCRIPT_TIMEOUT_MS = 15_000
const TOKEN_SAFETY_MS = 60_000

/** Thrown when a token can't be had without user interaction. */
export class AuthRequiredError extends Error {}

export function clientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''
}

/** The whole feature hides when no OAuth client is configured. */
export function syncConfigured(): boolean {
  return clientId() !== ''
}

const SILENT_TIMEOUT_MS = 8000
// renew a token this long before it expires so an open tab never lapses
const RENEW_BEFORE_MS = 5 * 60_000
// per-tab persistence so a reload keeps the signed-in state (see header)
const TOKEN_STORE_KEY = 'nihongo-mono:drive-sync:token:v1'

function readStoredToken(): { token: string; expiresAt: number } | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: unknown; expiresAt?: unknown }
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') return null
    if (Date.now() >= parsed.expiresAt - TOKEN_SAFETY_MS) return null
    return { token: parsed.token, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

function writeStoredToken(c: { token: string; expiresAt: number }): void {
  try {
    sessionStorage.setItem(TOKEN_STORE_KEY, JSON.stringify(c))
  } catch {
    // storage full / blocked: memory-only for this tab, still functional
  }
}

function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORE_KEY)
  } catch {
    // nothing to clear
  }
}

let scriptPromise: Promise<void> | null = null
let tokenClient: GoogleTokenClient | null = null
let cached: { token: string; expiresAt: number } | null = null
let renewTimer: ReturnType<typeof setTimeout> | null = null
let generation = 0
// GIS delivers results through the two init-time callbacks; the pending
// request's resolvers live here so requestToken can await them
let pending: {
  gen: number
  resolve: (token: string) => void
  reject: (err: Error) => void
} | null = null

export function loadGis(): Promise<void> {
  // decision 60: never cache a rejected promise — a failed load may be a
  // blocker/network blip and the next click should retry
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = GSI_SRC
      script.async = true
      const timer = setTimeout(() => {
        script.remove()
        reject(new Error('Google sign-in script timed out.'))
      }, SCRIPT_TIMEOUT_MS)
      script.onload = () => {
        clearTimeout(timer)
        if (window.google?.accounts?.oauth2) resolve()
        else reject(new Error('Google sign-in script loaded but is unusable.'))
      }
      script.onerror = () => {
        clearTimeout(timer)
        script.remove()
        reject(new Error("Couldn't reach Google — check your network or content blockers."))
      }
      document.head.appendChild(script)
    })
    scriptPromise.catch(() => {
      scriptPromise = null
    })
  }
  return scriptPromise
}

function ensureTokenClient(): GoogleTokenClient {
  if (tokenClient) return tokenClient
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google sign-in is not loaded.')
  tokenClient = oauth2.initTokenClient({
    client_id: clientId(),
    scope: DRIVE_FILE_SCOPE,
    callback: (response) => {
      const p = pending
      if (!p || p.gen !== generation) return // stale response — ignore
      pending = null
      if (response.error || !response.access_token) {
        p.reject(
          response.error === 'access_denied' || response.error === 'interaction_required'
            ? new AuthRequiredError(response.error)
            : new Error(response.error_description || response.error || 'Sign-in failed.'),
        )
        return
      }
      const oauth = window.google?.accounts?.oauth2
      if (oauth && !oauth.hasGrantedAllScopes(response, DRIVE_FILE_SCOPE)) {
        p.reject(new Error('Google Drive access was not granted.'))
        return
      }
      const expiresIn = Number(response.expires_in ?? 0)
      cached = {
        token: response.access_token,
        expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 0) * 1000,
      }
      writeStoredToken(cached)
      scheduleRenewal(cached.expiresAt)
      p.resolve(response.access_token)
    },
    // popup closed / blocked / origin mismatch land here — closed and
    // blocked both mean "needs the user", i.e. the needs-reauth state
    error_callback: (error) => {
      const p = pending
      if (!p || p.gen !== generation) return
      pending = null
      p.reject(
        error.type === 'popup_closed' || error.type === 'popup_failed_to_open'
          ? new AuthRequiredError(error.type)
          : new Error(error.message || 'Google sign-in failed.'),
      )
    },
  })
  return tokenClient
}

/**
 * Keep an open tab signed in past Google's ~1 h token lifetime: shortly
 * before expiry, silently mint a replacement. Failure is fine — the old
 * token keeps working until expiry and the next sync surfaces
 * needs-reauth if Google really wants the user. The token itself still
 * never leaves module memory (the security invariant): "staying signed
 * in" across page loads is the silent path below, not persistence.
 */
function scheduleRenewal(expiresAt: number): void {
  if (renewTimer) clearTimeout(renewTimer)
  const inMs = expiresAt - Date.now() - RENEW_BEFORE_MS
  if (inMs <= 0) {
    renewTimer = null
    return
  }
  renewTimer = setTimeout(() => {
    renewTimer = null
    void getToken({ interactive: false, forceRefresh: true }).catch(() => undefined)
  }, inMs)
}

/**
 * Get a Drive-scoped access token. The in-memory token survives only the
 * current page, so a fresh load has none — the non-interactive path still
 * ATTEMPTS a GIS token request with `prompt: ''` (with an existing grant
 * and a live Google session it completes with no UI at all — the draw.io
 * behavior), but it's wrapped in a timeout: if Google needs the user
 * (blocked popup, signed out, revoked), the caller lands in needs-reauth
 * instead of hanging, and a click resolves it.
 */
export async function getToken(opts: {
  interactive: boolean
  /** skip the cache — used by the pre-expiry renewal */
  forceRefresh?: boolean
}): Promise<string> {
  if (!opts.forceRefresh) {
    if (!cached) {
      // fresh page in a tab that was already signed in: pick the token
      // back up so a reload never needs Google at all
      cached = readStoredToken()
      if (cached) scheduleRenewal(cached.expiresAt)
    }
    if (cached && Date.now() < cached.expiresAt - TOKEN_SAFETY_MS) return cached.token
  }
  await loadGis()
  const client = ensureTokenClient()
  generation += 1
  const gen = generation
  return new Promise<string>((resolve, reject) => {
    pending?.reject(new AuthRequiredError('superseded'))
    const timer = opts.interactive
      ? null
      : setTimeout(() => {
          if (pending?.gen === gen) {
            pending = null
            reject(new AuthRequiredError('silent token timed out'))
          }
        }, SILENT_TIMEOUT_MS)
    pending = {
      gen,
      resolve: (token) => {
        if (timer) clearTimeout(timer)
        resolve(token)
      },
      reject: (err) => {
        if (timer) clearTimeout(timer)
        reject(err)
      },
    }
    // silent path: prompt '' tells Google "no UI — fail instead". Without
    // it Google may decide to require interaction, which (with no user
    // gesture) means a blocked popup and a spurious needs-reauth.
    client.requestAccessToken(opts.interactive ? undefined : { prompt: '' })
  })
}

function cancelRenewal(): void {
  if (renewTimer) {
    clearTimeout(renewTimer)
    renewTimer = null
  }
}

/** Best-effort revoke + full wipe, memory and tab storage (disconnect). */
export async function revokeToken(): Promise<void> {
  const token = cached?.token ?? readStoredToken()?.token
  cached = null
  pending = null
  cancelRenewal()
  clearStoredToken()
  if (!token || !window.google?.accounts?.oauth2) return
  await new Promise<void>((resolve) => {
    try {
      window.google!.accounts!.oauth2!.revoke(token, resolve)
      setTimeout(resolve, 3000) // revoke callback is not guaranteed
    } catch {
      resolve()
    }
  })
}

/** Drop the token (memory + tab) so the next sync must re-auth (401). */
export function forgetToken(): void {
  cached = null
  cancelRenewal()
  clearStoredToken()
}
