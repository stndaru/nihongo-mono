import type { FuriganaSegment } from './types'

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
