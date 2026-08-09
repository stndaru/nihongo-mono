/**
 * Copies the tesseract-wasm runtime and SIMD/fallback binaries from node_modules into
 * public/ocr/engine/, where the sentence parser's opt-in image-scan worker
 * lazy-loads the supported build. The
 * copy is gitignored — node_modules (version-pinned) is the source of
 * truth — and runs in front of `dev` and `build` (idempotent, skips files
 * whose size already matches). The recognition models are NOT copied here:
 * they come from tessdata_fast, pre-gzipped and committed under
 * public/ocr/models/ (see public/ocr/NOTICE.md).
 */
import { copyFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', 'node_modules', 'tesseract-wasm', 'dist')
const OUT = join(import.meta.dirname, '..', 'public', 'ocr', 'engine')

const FILES = ['lib.js', 'tesseract-core.wasm', 'tesseract-core-fallback.wasm']

if (!existsSync(SRC)) {
  throw new Error('tesseract-wasm is not installed — run `bun install` first')
}
mkdirSync(OUT, { recursive: true })

// The app now bundles its own module worker so it can select page segmentation
// per scan. Remove the old high-level worker from earlier local builds; public/
// is copied wholesale and a stale file would otherwise inflate every build.
const legacyWorker = join(OUT, 'tesseract-worker.js')
if (existsSync(legacyWorker)) unlinkSync(legacyWorker)

let copied = 0
for (const file of FILES) {
  const from = join(SRC, file)
  const to = join(OUT, file)
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue
  copyFileSync(from, to)
  copied += 1
}

console.log(
  copied > 0
    ? `copied ${copied} tesseract-wasm engine files into public/ocr/engine/`
    : 'tesseract-wasm engine already in place',
)
