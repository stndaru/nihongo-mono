/**
 * Google Identity Services loader + token acquisition.
 *
 * SECURITY PROPERTIES (decision 70):
 * - The script is injected only when this module's functions run, and this
 *   module is only reachable through the lazily-imported sync engine — a
 *   user who never connects Drive never loads Google code.
 * - The access token lives in this module's memory ONLY. It is never
 *   persisted anywhere, so nothing outside a live tab can steal it.
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
 * Get a Drive-scoped access token. The in-memory token survives only the
 * current page, so a fresh load has none — the non-interactive path still
 * ATTEMPTS a GIS token request (with an existing grant and Google session
 * it completes without user interaction — the draw.io behavior), but it's
 * wrapped in a timeout: if Google needs the user (blocked popup, signed
 * out, revoked), the caller lands in needs-reauth instead of hanging, and
 * a click resolves it.
 */
export async function getToken(opts: { interactive: boolean }): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - TOKEN_SAFETY_MS) return cached.token
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
    client.requestAccessToken()
  })
}

/** Best-effort revoke + memory wipe (disconnect). */
export async function revokeToken(): Promise<void> {
  const token = cached?.token
  cached = null
  pending = null
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

/** Drop the in-memory token so the next sync must re-auth (401 handling). */
export function forgetToken(): void {
  cached = null
}
