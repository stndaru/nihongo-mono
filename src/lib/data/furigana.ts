import type { FuriganaSegment } from './types'

/**
 * Parses the compact bracket form the build scripts emit for example
 * sentences — もっと｜果物[くだもの]を｜食[た]べる — back into ruby
 * segments (｜ marks the start of an annotated base). The string form is
 * 5–10× smaller on the wire than segment objects, which is why it exists.
 */
export function parseFurigana(f: string): FuriganaSegment[] {
  const segs: FuriganaSegment[] = []
  const re = /｜([^[]+)\[([^\]]+)\]/g
  let last = 0
  for (let m = re.exec(f); m; m = re.exec(f)) {
    // plain text between the previous annotation and this one
    if (m.index > last) segs.push({ t: f.slice(last, m.index) })
    segs.push({ t: m[1], r: m[2] })
    last = re.lastIndex
  }
  if (last < f.length) segs.push({ t: f.slice(last) })
  return segs
}

/**
 * Derives ruby segments for any kanji/kana surface pair, e.g. a conjugated
 * form the dataset has no precomputed furigana for. The shared kana tail is
 * left bare and the differing head becomes one ruby segment, which also
 * handles reading shifts like 来ない/こない → [{t:来, r:こ}, {t:ない}].
 */
export function pairFurigana(kanji: string, kana: string): FuriganaSegment[] {
  if (kanji === kana) return [{ t: kana }]
  let suffix = 0
  while (
    suffix < kanji.length &&
    suffix < kana.length &&
    kanji[kanji.length - 1 - suffix] === kana[kana.length - 1 - suffix]
  ) {
    suffix++
  }
  const kanjiHead = kanji.slice(0, kanji.length - suffix)
  const kanaHead = kana.slice(0, kana.length - suffix)
  if (!kanjiHead) return [{ t: kana }]
  const tail = kanji.slice(kanji.length - suffix)
  return tail ? [{ t: kanjiHead, r: kanaHead }, { t: tail }] : [{ t: kanjiHead, r: kanaHead }]
}
