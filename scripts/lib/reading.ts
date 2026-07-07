/**
 * Sentence furigana via kuromoji (IPADIC morphological analysis) — build
 * time only, never bundled. Call initReading() once at script start; after
 * that sentenceFurigana() is synchronous.
 *
 * Kuromoji readings are per token; within a token the ruby is narrowed to
 * the non-kana core by stripping the kana that surface and reading share at
 * both ends (食べた/タベタ → 食(た)べた). Tokens kuromoji can't read
 * (numbers, latin, rare symbols) stay bare rather than guessing.
 */
import kuromoji from 'kuromoji'
import { toHiragana } from 'wanakana'
import type { FuriganaSegment } from '../../src/lib/data/types'
import { KANJI_CHAR_RE } from './build-common'

type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>

let tokenizer: Tokenizer | null = null

export function initReading(): Promise<void> {
  return new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: 'node_modules/kuromoji/dict' })
      .build((err, t) => {
        if (err) reject(err)
        else {
          tokenizer = t
          resolve()
        }
      })
  })
}

const hasKanji = (s: string) => {
  const hit = KANJI_CHAR_RE.test(s)
  KANJI_CHAR_RE.lastIndex = 0
  return hit
}

/** Ruby for one token: shared leading/trailing kana stay bare (katakana in
 * the surface counts as matching its hiragana reading). */
function tokenSegments(surface: string, reading: string): FuriganaSegment[] {
  const same = (a: string, b: string) => !hasKanji(a) && toHiragana(a) === b
  let start = 0
  while (
    start < surface.length &&
    start < reading.length &&
    same(surface[start], reading[start])
  ) {
    start++
  }
  let end = 0
  while (
    end < surface.length - start &&
    end < reading.length - start &&
    same(surface[surface.length - 1 - end], reading[reading.length - 1 - end])
  ) {
    end++
  }
  const segs: FuriganaSegment[] = []
  if (start > 0) segs.push({ t: surface.slice(0, start) })
  segs.push({
    t: surface.slice(start, surface.length - end),
    r: reading.slice(start, reading.length - end),
  })
  if (end > 0) segs.push({ t: surface.slice(surface.length - end) })
  return segs
}

export function sentenceFurigana(ja: string): FuriganaSegment[] | undefined {
  if (!tokenizer || !hasKanji(ja)) return undefined
  const segs: FuriganaSegment[] = []
  const plain = (t: string) => {
    const last = segs[segs.length - 1]
    if (last && !last.r) last.t += t
    else segs.push({ t })
  }
  for (const token of tokenizer.tokenize(ja)) {
    const surface = token.surface_form
    const reading = token.reading && token.reading !== '*' ? toHiragana(token.reading) : ''
    if (!hasKanji(surface) || !reading) {
      plain(surface)
      continue
    }
    for (const seg of tokenSegments(surface, reading)) {
      if (seg.r) segs.push(seg)
      else plain(seg.t)
    }
  }
  return segs
}
