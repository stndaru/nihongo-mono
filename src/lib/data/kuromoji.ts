/**
 * Lazy, on-demand kuromoji tokenizer for the sentence parser. Nothing here
 * loads until the user's first "Break Down" click: the kuromoji code comes
 * in via dynamic import (its own chunk) and the IPADIC dictionary (12
 * pre-gzipped files, ~17 MB — copied to public/kuromoji by
 * scripts/copy-kuromoji.ts) is fetched with per-file progress. Both are
 * cached: the module singleton for the session, the files by the browser.
 */
import type { IpadicFeatures } from 'kuromoji'
import { fetchBufferGz } from './fetch-gz'

export interface JaTokenizer {
  tokenize(text: string): IpadicFeatures[]
}

// Exact loading order of DictionaryLoader.load — each group feeds one
// DynamicDictionaries.loadX call with specific typed-array views.
const DICT_FILES = [
  'base.dat.gz',
  'check.dat.gz',
  'tid.dat.gz',
  'tid_pos.dat.gz',
  'tid_map.dat.gz',
  'cc.dat.gz',
  'unk.dat.gz',
  'unk_pos.dat.gz',
  'unk_map.dat.gz',
  'unk_char.dat.gz',
  'unk_compat.dat.gz',
  'unk_invoke.dat.gz',
] as const

export const DICT_FILE_COUNT = DICT_FILES.length

async function build(onProgress?: (done: number, total: number) => void): Promise<JaTokenizer> {
  const [{ default: DynamicDictionaries }, { default: Tokenizer }] = await Promise.all([
    import('kuromoji/src/dict/DynamicDictionaries.js'),
    import('kuromoji/src/Tokenizer.js'),
  ])
  let done = 0
  const buffers = await Promise.all(
    DICT_FILES.map(async (file) => {
      const buf = await fetchBufferGz(`${import.meta.env.BASE_URL}kuromoji/dict/${file}`)
      done += 1
      onProgress?.(done, DICT_FILES.length)
      return buf
    }),
  )
  const dic = new DynamicDictionaries()
  dic.loadTrie(new Int32Array(buffers[0]), new Int32Array(buffers[1]))
  dic.loadTokenInfoDictionaries(
    new Uint8Array(buffers[2]),
    new Uint8Array(buffers[3]),
    new Uint8Array(buffers[4]),
  )
  dic.loadConnectionCosts(new Int16Array(buffers[5]))
  dic.loadUnknownDictionaries(
    new Uint8Array(buffers[6]),
    new Uint8Array(buffers[7]),
    new Uint8Array(buffers[8]),
    new Uint8Array(buffers[9]),
    new Uint32Array(buffers[10]),
    new Uint8Array(buffers[11]),
  )
  return new Tokenizer(dic)
}

let cached: Promise<JaTokenizer> | null = null
let ready = false

/** True once the tokenizer finished loading (skip the download notice). */
export function tokenizerReady(): boolean {
  return ready
}

export function loadTokenizer(
  onProgress?: (done: number, total: number) => void,
): Promise<JaTokenizer> {
  if (!cached) {
    cached = build(onProgress).then((tok) => {
      ready = true
      return tok
    })
    cached.catch(() => {
      cached = null // a failed download may be retried
    })
  }
  return cached
}
