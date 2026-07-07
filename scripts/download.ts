/**
 * Downloads raw dictionary sources into scripts/.cache/ (gitignored).
 * Idempotent: existing outputs are skipped. Pass --force to re-download.
 *
 * Usage: bun scripts/download.ts [--force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import sources from './sources.json'

const CACHE = join(import.meta.dirname, '.cache')
const FORCE = process.argv.includes('--force')

interface GithubAsset {
  pattern: string
  out: string
  zip: boolean
}

async function fetchOk(url: string, attempt = 1): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'nihongo-mono-data-pipeline' },
  })
  if (res.status === 429 && attempt <= 4) {
    const wait = attempt * 15_000
    console.log(`[wait] 429 from ${new URL(url).host}, retrying in ${wait / 1000}s`)
    await new Promise((r) => setTimeout(r, wait))
    return fetchOk(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
  return res
}

async function downloadGithub(repo: string, assets: GithubAsset[], versions: Record<string, string>) {
  const pending = assets.filter((a) => FORCE || !existsSync(join(CACHE, a.out)))
  if (pending.length === 0) {
    console.log(`[skip] ${repo} — all outputs cached`)
    return
  }
  const release = (await (
    await fetchOk(`https://api.github.com/repos/${repo}/releases/latest`)
  ).json()) as {
    tag_name: string
    assets: { name: string; browser_download_url: string }[]
  }
  versions[repo] = release.tag_name
  for (const spec of pending) {
    const re = new RegExp(spec.pattern)
    const asset = release.assets.find((a) => re.test(a.name))
    if (!asset) throw new Error(`${repo}: no asset matching ${spec.pattern}`)
    console.log(`[get ] ${asset.name} (${release.tag_name})`)
    const buf = new Uint8Array(await (await fetchOk(asset.browser_download_url)).arrayBuffer())
    if (spec.zip) {
      const entries = unzipSync(buf)
      const jsonName = Object.keys(entries).find((n) => n.endsWith('.json'))
      if (!jsonName) throw new Error(`${asset.name}: no .json inside zip`)
      writeFileSync(join(CACHE, spec.out), entries[jsonName])
    } else {
      writeFileSync(join(CACHE, spec.out), buf)
    }
    console.log(`[ok  ] ${spec.out}`)
  }
}

async function downloadRaw(url: string, out: string) {
  const target = join(CACHE, out)
  if (!FORCE && existsSync(target)) {
    console.log(`[skip] ${out}`)
    return
  }
  console.log(`[get ] ${url}`)
  writeFileSync(target, new Uint8Array(await (await fetchOk(url)).arrayBuffer()))
  console.log(`[ok  ] ${out}`)
}

mkdirSync(CACHE, { recursive: true })

const versionsPath = join(CACHE, 'versions.json')
const versions: Record<string, string> = existsSync(versionsPath)
  ? JSON.parse(readFileSync(versionsPath, 'utf8'))
  : {}

/** KRADFILE (kanji component decomposition) ships EUC-JP inside a zip. */
async function downloadKradfile() {
  const target = join(CACHE, 'kradfile.txt')
  if (!FORCE && existsSync(target)) {
    console.log('[skip] kradfile.txt')
    return
  }
  const url = 'http://ftp.edrdg.org/pub/Nihongo/kradzip.zip'
  console.log(`[get ] ${url}`)
  const buf = new Uint8Array(await (await fetchOk(url)).arrayBuffer())
  const entries = unzipSync(buf)
  const decoder = new TextDecoder('euc-jp')
  // kradfile covers JIS X 0208, kradfile2 the rarer JIS X 0212 characters
  const text = ['kradfile', 'kradfile2']
    .filter((name) => entries[name])
    .map((name) => decoder.decode(entries[name]))
    .join('\n')
  writeFileSync(target, text)
  console.log('[ok  ] kradfile.txt')
  versions['edrdg/kradfile'] = 'kradzip'
}

for (const gh of sources.github) {
  await downloadGithub(gh.repo, gh.assets, versions)
}
for (const raw of sources.raw) {
  await downloadRaw(raw.url, raw.out)
}
await downloadKradfile()
versions['elzup/jlpt-word-list'] = versions['elzup/jlpt-word-list'] ?? 'master'
writeFileSync(versionsPath, JSON.stringify(versions, null, 2))
console.log('done.')
