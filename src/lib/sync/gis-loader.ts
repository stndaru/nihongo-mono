/**
 * Google Identity Services loader + token acquisition.
 *
 * SECURITY PROPERTIES (decision 70):
 * - The script is injected only when this module's functions run, and this
 *   module is only reachable through the lazily-imported sync engine — a
 *   user who never connects Drive never loads Google code.
 * - AUTOMATIC callers never contact Google sign-in AT ALL (owner rule:
 *   GIS's "silent" flow can open a real login popup when Google decides
 *   interaction is needed — surprise popups on every page load,
 *   especially on mobile). Non-interactive getToken only reuses the
 *   persisted token and otherwise fails into needs-reauth, where the UI
 *   shows a sign-in warning; requestAccessToken runs ONLY from clicks.
 * - The access token lives in module memory plus localStorage (owner
 *   request, twice widened: staying signed in across reloads AND full
 *   browser restarts — GIS can't reliably re-mint silently once browsers
 *   block third-party cookies). Exposure is bounded by Google's ≤1 h
 *   token lifetime, the 24 h idle sign-out (engine/bootstrap), the
 *   drive.file scope, and the CSP: hash-pinned script-src blocks
 *   injected code and the connect-src allowlist bounds where a stolen
 *   token could even be sent. The link META must still never carry a
 *   token (meta.ts test pins that).
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

// persistence so reloads AND browser restarts keep the signed-in state
// within the token's ≤1 h life (see header for the security envelope)
const TOKEN_STORE_KEY = 'nihongo-mono:drive-sync:token:v1'

function readStoredToken(): { token: string; expiresAt: number } | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: unknown; expiresAt?: unknown }
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') return null
    if (Date.now() >= parsed.expiresAt - TOKEN_SAFETY_MS) {
      clearStoredToken() // expired blob: don't leave it on disk
      return null
    }
    return { token: parsed.token, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

function writeStoredToken(c: { token: string; expiresAt: number }): void {
  try {
    localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify(c))
  } catch {
    // storage full / blocked: memory-only for this tab, still functional
  }
}

function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORE_KEY)
  } catch {
    // nothing to clear
  }
}

let scriptPromise: Promise<void> | null = null
let tokenClient: GoogleTokenClient | null = null
let cached: { token: string; expiresAt: number } | null = null
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
 * Get a Drive-scoped access token.
 *
 * Non-interactive (auto-sync) callers only ever reuse the persisted
 * token: within its ~1 h life reloads and restarts stay signed in with
 * zero Google traffic, and past it they throw AuthRequiredError — the
 * UI then shows the "sign in to resume sync" warning. They deliberately
 * NEVER call requestAccessToken: GIS may open a real login popup when
 * Google wants interaction, and unprompted popups on every trigger are
 * exactly what the owner banned. Interactive callers (clicks) run the
 * full GIS flow, where a popup is expected and gesture-sanctioned.
 */
export async function getToken(opts: { interactive: boolean }): Promise<string> {
  if (!cached) {
    // fresh page in a browser that was already signed in: pick the
    // token back up so a reload or restart never needs Google at all
    cached = readStoredToken()
  }
  if (cached && Date.now() < cached.expiresAt - TOKEN_SAFETY_MS) return cached.token
  if (!opts.interactive) throw new AuthRequiredError('sign-in required')
  await loadGis()
  const client = ensureTokenClient()
  generation += 1
  const gen = generation
  return new Promise<string>((resolve, reject) => {
    pending?.reject(new AuthRequiredError('superseded'))
    pending = { gen, resolve, reject }
    client.requestAccessToken()
  })
}

/** Best-effort revoke + full wipe, memory and storage (disconnect). */
export async function revokeToken(): Promise<void> {
  const token = cached?.token ?? readStoredToken()?.token
  cached = null
  pending = null
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

/** Drop the token (memory + storage) so the next sync must re-auth (401). */
export function forgetToken(): void {
  cached = null
  clearStoredToken()
}
