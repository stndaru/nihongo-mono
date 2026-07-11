# Google Drive sync — owner setup

The Drive progress sync (Settings → Cloud sync) is entirely client-side:
the browser talks to Google, never to the hosting server. The only thing
the app needs from you is an OAuth **client ID** — the feature hides
itself when none is configured.

## One-time Google Cloud console steps

1. <https://console.cloud.google.com> → create a project (e.g.
   `nihongo-mono`).
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**:
   - User type **External**; fill app name + support email.
   - For the **privacy policy / homepage URLs** the branding form asks
     for, use the app's own pages: homepage = the deployed origin,
     privacy policy = `<origin>/cloud-sync` (the in-app "Cloud Sync — How
     It Works & Privacy" page, which is the user-facing consent notice).
   - Scopes: add `https://www.googleapis.com/auth/drive.file` only. It is
     a **non-sensitive** scope (the app can touch only files it created),
     so no security assessment is required.
   - Publish the app — or keep it in Testing and add your own Google
     account as a test user (tokens then expire after 7 days, fine for
     development).
4. **APIs & Services → Credentials → Create credentials → OAuth client
   ID** → application type **Web application**:
   - **Authorized JavaScript origins** — the exact origins the app is
     served from. This list is the real security control (the client ID
     itself is public by design):
     - `http://localhost:5173` (dev)
     - `http://localhost:4173` (vite preview)
     - your production origin(s), e.g. `https://nihongo-mono.pages.dev`
   - **No redirect URIs** — the app uses the GIS token model, which
     doesn't redirect.
5. Copy the client ID.

## Wiring it into builds

- Local dev: create `.env.local` (gitignored) with
  `VITE_GOOGLE_CLIENT_ID=<the id>` (template: `.env.example`).
- Hosted builds: set the same variable in each host's build environment
  (Cloudflare Pages / Netlify / Vercel build settings). Vite inlines it at
  build time.

## What the app does with it (for review)

- `src/lib/sync/gis-loader.ts` loads `https://accounts.google.com/gsi/client`
  only after the user opts in, requests the `drive.file` scope only, and
  keeps the access token in memory (never storage).
- `src/lib/sync/drive.ts` + `engine.ts` maintain a `Nihongo Mono` folder in
  My Drive root with a single `progress.json`, pull-merge-pushed after each
  quiz session (three-way merge — see decision 70).
- The build emits a Content-Security-Policy (`scripts/gen-csp.ts` →
  `dist/_headers` + `vercel.json`) that pins script execution and network
  egress to the origins above.

## Manual test checklist (needs a real Google account)

- Connect on localhost: popup, consent, folder appears in Drive root.
- Second browser/profile: connect → Use/Start-fresh decision flow.
- Revoke access at <https://myaccount.google.com/permissions> → next sync
  shows "Sign in to Google to resume sync"; re-auth works.
- Leave a tab open >1 h → next quiz sync silently refreshes or asks.
- On the deployed host: no CSP violations in the console while using the
  parser (translation), OCR, and Drive sync.
