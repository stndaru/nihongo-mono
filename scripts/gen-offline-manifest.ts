/**
 * Generates dist/offline-manifest.json after each build (decision 72).
 *
 * The manifest is the complete list of same-origin files the app can ever
 * fetch — app shell + route chunks, all datasets (JLPT, extended tier,
 * names, strokes), the kuromoji dictionary, and the OCR engine + models —
 * with per-file byte sizes. Settings' "Offline access" section reads it to
 * state the exact download size up front and to drive the precache with
 * real byte progress; its `version` (a hash of the file list) is how the
 * UI detects that the offline copy is stale after a deploy.
 *
 * Excluded: _headers (host config, never fetched by the app), sw.js (the
 * worker script itself — the browser manages its lifecycle), source maps,
 * and the manifest itself.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('gen-offline-manifest: dist/index.html missing — run after vite build')
  process.exit(1)
}

const SKIP = new Set(['_headers', 'sw.js', 'offline-manifest.json'])

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const files = walk(DIST)
  .map((f) => f.replaceAll('\\', '/'))
  .map((f) => f.slice(DIST.length)) // '/index.html', '/assets/…'
  .filter((f) => !SKIP.has(f.slice(1)) && !f.endsWith('.map'))
  .sort()

const entries = files.map((f) => [f, statSync(join(DIST, f)).size] as const)
const totalBytes = entries.reduce((a, [, s]) => a + s, 0)
// the version keys on names + sizes: any rebuild that changes content
// changes hashed asset names or data byte sizes, flipping the version
const version = createHash('sha256')
  .update(entries.map(([f, s]) => `${f}:${s}`).join('\n'))
  .digest('hex')
  .slice(0, 16)

writeFileSync(
  join(DIST, 'offline-manifest.json'),
  JSON.stringify({ version, totalBytes, files: entries }),
)
console.log(
  `gen-offline-manifest: ${entries.length} files, ${(totalBytes / 1048576).toFixed(1)} MB, version ${version}`,
)
