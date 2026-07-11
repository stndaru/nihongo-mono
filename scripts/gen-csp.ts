/**
 * Generates the Content-Security-Policy after each build (decision 70).
 *
 * The policy locks script execution to the app's own chunks plus Google's
 * sign-in script, and network egress to the origins the app actually
 * talks to — an XSS payload can neither load foreign code nor exfiltrate
 * a Drive token anywhere useful. The inline theme/FOUC script in
 * index.html is allowed via its sha256 hash, computed HERE from the built
 * dist/index.html so editing that script can never silently break the
 * policy — the hash regenerates on every build.
 *
 * Outputs:
 * - dist/_headers            (read by Cloudflare Workers assets AND Netlify)
 * - vercel.json "headers"    (rewritten in-repo to stay in lockstep)
 *
 * Notes baked into the policy:
 * - 'wasm-unsafe-eval' is required for tesseract-wasm (OCR): plain
 *   script-src blocks WebAssembly compilation. It does NOT allow JS eval.
 * - worker-src falls back to script-src: the self-hosted OCR worker is
 *   covered by 'self'.
 * - style/img/font are deliberately left unset (no default-src): Radix
 *   inline styles and data: images must keep working; scripts and network
 *   are the vectors that matter for token safety.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const dist = 'dist/index.html'
if (!existsSync(dist)) {
  console.error('gen-csp: dist/index.html missing — run after vite build')
  process.exit(1)
}
const html = readFileSync(dist, 'utf8')

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .filter((s) => s.trim() !== '')
const hashes = inlineScripts.map(
  (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`,
)

const csp = [
  `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')} https://accounts.google.com`.replace(/\s+/g, ' '),
  "connect-src 'self' https://www.googleapis.com https://accounts.google.com https://translate.googleapis.com https://api.mymemory.translated.net",
  'frame-src https://accounts.google.com',
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join('; ')

writeFileSync('dist/_headers', `/*\n  Content-Security-Policy: ${csp}\n`)

// vercel.json can't be generated into dist — rewrite it in-repo so a
// FOUC-script edit shows up as a reviewable diff instead of a stale hash
const vercelPath = 'vercel.json'
const vercel = JSON.parse(readFileSync(vercelPath, 'utf8')) as Record<string, unknown>
const next = {
  ...vercel,
  headers: [
    {
      source: '/(.*)',
      headers: [{ key: 'Content-Security-Policy', value: csp }],
    },
  ],
}
const serialized = JSON.stringify(next, null, 2) + '\n'
if (serialized !== readFileSync(vercelPath, 'utf8')) {
  writeFileSync(vercelPath, serialized)
  console.log('gen-csp: vercel.json CSP updated — commit the change')
}
console.log(`gen-csp: dist/_headers written (${hashes.length} inline script hash)`)
