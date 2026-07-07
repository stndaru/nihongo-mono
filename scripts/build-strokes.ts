/**
 * Extracts stroke-order data from the KanjiVG single-XML release into
 * codepoint shards under public/data/strokes/. Only the raw SVG path `d`
 * strings survive, in stroke order — group metadata, stroke-number text,
 * and the per-kanji licence comments stay out of the payload, so a whole
 * character costs ~1 KB instead of a ~4 KB SVG file. The client renders
 * the frames itself (src/components/kanji/StrokeOrder.tsx).
 *
 * KanjiVG is © Ulrich Apel, CC BY-SA 3.0 — credited on the About page.
 *
 * Usage: bun scripts/build-strokes.ts   (needs data:download first)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { writeJsonGz } from './lib/gzip-out'
import type { DatasetMeta } from '../src/lib/data/types'

const CACHE = join(import.meta.dirname, '.cache')
const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data')
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'data', 'strokes')

// Keep in sync with STROKE_SHARDS in src/lib/data/loader.ts.
const STROKE_SHARDS = 256

const src = join(CACHE, 'kanjivg.xml.gz')
if (!existsSync(src)) {
  throw new Error('kanjivg.xml.gz not cached — run `bun run data:download` first')
}
const xml = gunzipSync(readFileSync(src)).toString('utf8')

const shards = Array.from({ length: STROKE_SHARDS }, () => ({}) as Record<string, string[]>)
let count = 0
// one <kanji id="kvg:kanji_XXXXX"> element per character; hex-only ids only
// (variant forms like `..._04e00-Kaisho` are deliberately skipped)
const kanjiRe = /<kanji id="kvg:kanji_([0-9a-f]+)">([\s\S]*?)<\/kanji>/g
const pathRe = /<path [^>]*?\bd="([^"]+)"/g
for (let m = kanjiRe.exec(xml); m; m = kanjiRe.exec(xml)) {
  const char = String.fromCodePoint(parseInt(m[1], 16))
  const paths = [...m[2].matchAll(pathRe)].map((p) => p[1])
  if (paths.length === 0) continue
  // document order of <path> elements IS the stroke order in KanjiVG
  shards[(char.codePointAt(0) ?? 0) % STROKE_SHARDS][char] = paths
  count += 1
}
if (count === 0) throw new Error('no kanji parsed — did the KanjiVG XML format change?')

mkdirSync(OUT_DIR, { recursive: true })
shards.forEach((shard, n) => writeJsonGz(join(OUT_DIR, `${n}.json.gz`), shard))

const metaPath = join(DATA_DIR, 'meta.json')
const meta: DatasetMeta = JSON.parse(readFileSync(metaPath, 'utf8'))
meta.strokesCount = count
const versionsPath = join(CACHE, 'versions.json')
if (existsSync(versionsPath)) {
  const versions = JSON.parse(readFileSync(versionsPath, 'utf8')) as Record<string, string>
  if (versions['KanjiVG/kanjivg']) meta.sources['KanjiVG/kanjivg'] = versions['KanjiVG/kanjivg']
}
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')

console.log(`stroke data for ${count} kanji into ${STROKE_SHARDS} shards in public/data/strokes/`)
