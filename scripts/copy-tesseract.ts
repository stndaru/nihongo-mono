/**
 * Copies the tesseract-wasm engine (worker script + SIMD/fallback wasm,
 * ~3.7 MB) from node_modules into public/ocr/engine/, where the sentence
 * parser's opt-in image-scan panel lazy-loads it. The worker resolves its
 * wasm relative to its own URL, so all three files must sit together. The
 * copy is gitignored — node_modules (version-pinned) is the source of
 * truth — and runs in front of `dev` and `build` (idempotent, skips files
 * whose size already matches). The recognition models are NOT copied here:
 * they come from tessdata_fast, pre-gzipped and committed under
 * public/ocr/models/ (see public/ocr/NOTICE.md).
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', 'node_modules', 'tesseract-wasm', 'dist')
const OUT = join(import.meta.dirname, '..', 'public', 'ocr', 'engine')

const FILES = [
  ['lib.js', 'tesseract-client.js'],
  ['tesseract-worker.js', 'tesseract-worker.js'],
  ['tesseract-core.wasm', 'tesseract-core.wasm'],
  ['tesseract-core-fallback.wasm', 'tesseract-core-fallback.wasm'],
] as const

if (!existsSync(SRC)) {
  throw new Error('tesseract-wasm is not installed — run `bun install` first')
}
mkdirSync(OUT, { recursive: true })

let copied = 0
for (const [source, target] of FILES) {
  const from = join(SRC, source)
  const to = join(OUT, target)
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue
  copyFileSync(from, to)
  copied += 1
}

console.log(
  copied > 0
    ? `copied ${copied} tesseract-wasm engine files into public/ocr/engine/`
    : 'tesseract-wasm engine already in place',
)
