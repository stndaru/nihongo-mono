/**
 * Minimal ambient types for the Google Identity Services script
 * (https://accounts.google.com/gsi/client) — only the token-model surface
 * this app touches. Google ships no types for the plain script tag
 * (precedent: src/lib/ocr/tesseract-wasm.d.ts).
 */
interface GoogleTokenResponse {
  access_token?: string
  expires_in?: string | number
  scope?: string
  error?: string
  error_description?: string
}

interface GoogleTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

interface GoogleOauth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: { type?: string; message?: string }) => void
  }): GoogleTokenClient
  hasGrantedAllScopes(response: GoogleTokenResponse, ...scopes: string[]): boolean
  revoke(token: string, callback?: () => void): void
}

interface Window {
  google?: { accounts?: { oauth2?: GoogleOauth2 } }
}
