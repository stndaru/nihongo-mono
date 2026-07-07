/**
 * Copies the kuromoji IPADIC dictionary (12 pre-gzipped .dat.gz files,
 * ~17 MB) plus its licence NOTICE from node_modules into public/kuromoji/,
 * where the sentence parser lazy-loads it on the user's first "Break Down"
 * click. The copy is gitignored — node_modules (version-pinned) is the
 * source of truth — and runs in front of `dev` and `build` (idempotent,
 * skips files whose size already matches).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', 'node_modules', 'kuromoji')
const OUT = join(import.meta.dirname, '..', 'public', 'kuromoji')
const OUT_DICT = join(OUT, 'dict')

if (!existsSync(join(SRC, 'dict'))) {
  throw new Error('kuromoji is not installed — run `bun install` first')
}
mkdirSync(OUT_DICT, { recursive: true })

let copied = 0
for (const file of readdirSync(join(SRC, 'dict'))) {
  if (!file.endsWith('.dat.gz')) continue
  const from = join(SRC, 'dict', file)
  const to = join(OUT_DICT, file)
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue
  copyFileSync(from, to)
  copied += 1
}
// the IPADIC licence requires its notice to travel with the data
copyFileSync(join(SRC, 'NOTICE.md'), join(OUT, 'NOTICE.md'))

console.log(
  copied > 0
    ? `copied ${copied} kuromoji dict files into public/kuromoji/`
    : 'kuromoji dict already in place',
)
