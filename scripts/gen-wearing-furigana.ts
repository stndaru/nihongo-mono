// One-off helper (not wired into package.json): generate compact furigana
// strings for the wearing-cheatsheet examples and verify each expansion
// against the page's expert-reviewed kana readings before they replace them.
import { initReading, sentenceFurigana } from './lib/reading'
import { parseFurigana } from '../src/lib/data/furigana'

const EXAMPLES: Array<[ja: string, reading: string]> = [
  ['寒いのでコートを着た。', 'さむいのでコートをきた'],
  ['新しい靴を履いて出かけた。', 'あたらしいくつをはいてでかけた'],
  ['自転車ではヘルメットを被ってください。', 'じてんしゃではヘルメットをかぶってください'],
  ['父はいつも眼鏡をかけている。', 'ちちはいつもめがねをかけている'],
  ['肩にカーディガンを羽織った。', 'かたにカーディガンをはおった'],
  ['今日は新しい香水をつけている。', 'きょうはあたらしいこうすいをつけている'],
  ['彼は結婚指輪をはめている。', 'かれはけっこんゆびわをはめている'],
  ['面接のためにネクタイを締めた。', 'めんせつのためにネクタイをしめた'],
  ['寒い日はマフラーを巻く。', 'さむいひはマフラーをまく'],
  ['電車ではマスクをしている人が多い。', 'でんしゃではマスクをしているひとがおおい'],
]

const KATA = /[゠-ヿ]/
const toHira = (s: string) =>
  [...s].map((ch) => (KATA.test(ch) && ch !== 'ー' ? String.fromCharCode(ch.charCodeAt(0) - 0x60) : ch)).join('')

await initReading()
let bad = 0
for (const [ja, reading] of EXAMPLES) {
  const f = sentenceFurigana(ja)
  if (!f) {
    console.log(`MISS  ${ja}`)
    bad += 1
    continue
  }
  const expanded = parseFurigana(f)
    .map((s) => s.r ?? s.t)
    .join('')
    .replace(/。/g, '')
  const okay = toHira(expanded) === toHira(reading)
  if (!okay) bad += 1
  console.log(`${okay ? 'OK  ' : 'DIFF'}  ${ja}\n      f: ${f}\n      expanded: ${expanded}${okay ? '' : `\n      expected: ${reading}`}`)
}
if (bad) process.exit(1)
