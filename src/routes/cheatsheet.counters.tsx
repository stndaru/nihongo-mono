import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export const Route = createFileRoute('/cheatsheet/counters')({
  component: CounterCheatsheetPage,
})

/**
 * Counters cheatsheet — static content by design, like the verb summary.
 * Scope and groupings follow Tofugu's counters list (credited at the
 * bottom): the two universal counters first, the ~17 must-know ones, then
 * a broader common set. Readings are plain kana columns — easier to scan
 * in a table than ruby.
 */

/** One ruby pair, for inline examples. */
function R({ k, r }: { k: string; r: string }) {
  return (
    <ruby>
      {k}
      <rt>{r}</rt>
    </ruby>
  )
}

/** The wago series — counts almost anything. [kanji, reading] per 1–10. */
const TSU_SERIES: [string, string][] = [
  ['一つ', 'ひとつ'],
  ['二つ', 'ふたつ'],
  ['三つ', 'みっつ'],
  ['四つ', 'よっつ'],
  ['五つ', 'いつつ'],
  ['六つ', 'むっつ'],
  ['七つ', 'ななつ'],
  ['八つ', 'やっつ'],
  ['九つ', 'ここのつ'],
  ['十', 'とお'],
]

/** [counter, reading, what it counts, notes/irregulars] */
const MUST_KNOW: [string, string, string, string][] = [
  ['本', 'ほん', 'long, thin things — pens, bottles, umbrellas, trains, phone calls', 'いっぽん・さんぼん・ろっぽん'],
  ['枚', 'まい', 'flat things — paper, tickets, plates, shirts', ''],
  ['匹', 'ひき', 'small and medium animals — cats, dogs, fish, insects', 'いっぴき・さんびき・ろっぴき'],
  ['頭', 'とう', 'large animals — horses, cows, elephants', ''],
  ['羽', 'わ', 'birds — and, famously, rabbits', ''],
  ['冊', 'さつ', 'books, magazines, notebooks', 'いっさつ・はっさつ'],
  ['台', 'だい', 'machines, vehicles, instruments', ''],
  ['人', 'にん', 'people', 'ひとり・ふたり, then さんにん…'],
  ['歳', 'さい', 'years of age', 'いっさい・はっさい — and 二十歳（はたち）'],
  ['回', 'かい', 'times, occurrences', 'いっかい・はっかい'],
  ['階', 'かい', 'floors of a building', 'さんがい is common for 3F'],
  ['分', 'ふん', 'minutes', 'いっぷん・さんぷん・じゅっぷん'],
  ['時', 'じ', "o'clock", 'よじ (4), しちじ (7), くじ (9)'],
  ['時間', 'じかん', 'hours (duration)', ''],
  ['日', 'にち', 'days and dates', 'ついたち…とおか are special (see below)'],
  ['月', 'がつ・つき', 'calendar months (がつ) / month counts (〜か月 かげつ)', ''],
  ['年', 'ねん', 'years, school grades', ''],
]

/** [counter, reading, what it counts] */
const COMMON: [string, string, string][] = [
  ['円', 'えん', 'Japanese yen'],
  ['箇所', 'かしょ', 'places, spots, locations'],
  ['缶', 'かん', 'cans'],
  ['巻', 'かん', 'volumes in a book series'],
  ['曲', 'きょく', 'songs'],
  ['切れ', 'きれ', 'slices — sashimi, meat, cake'],
  ['口', 'くち', 'bites, sips'],
  ['組', 'くみ', 'pairs, sets, groups; school classes'],
  ['件', 'けん', 'matters, cases, incidents'],
  ['軒', 'けん', 'houses, shops, restaurants'],
  ['語', 'ご', 'words'],
  ['校', 'こう', 'schools'],
  ['皿', 'さら', 'plates of food'],
  ['試合', 'しあい', 'games, matches (sports)'],
  ['社', 'しゃ', 'companies; shrines'],
  ['種類', 'しゅるい', 'kinds, varieties, types'],
  ['週', 'しゅう', 'weeks'],
  ['周', 'しゅう', 'laps, circuits'],
  ['色', 'しょく', 'colors'],
  ['席', 'せき', 'seats'],
  ['戦', 'せん', 'battles, matches, rounds'],
  ['足', 'そく', 'pairs of footwear — shoes, socks'],
  ['束', 'たば', 'bundles'],
  ['玉', 'たま', 'round things — balls of yarn, pachinko balls'],
  ['段', 'だん', 'steps, shelves, layers; martial-arts ranks'],
  ['着', 'ちゃく', 'outfits, articles of clothing'],
  ['通', 'つう', 'letters, emails, documents'],
  ['粒', 'つぶ', 'small round things — grains, beans, pills'],
  ['点', 'てん', 'points, scores; items, artworks'],
  ['度', 'ど', 'times; degrees (temperature, angles)'],
  ['杯', 'はい', 'cups and bowls of liquid — also squid, octopus, crabs', ],
  ['泊', 'はく', 'overnight stays'],
  ['箱', 'はこ', 'boxes'],
  ['発', 'はつ', 'shots, fireworks, punches'],
  ['番', 'ばん', 'order, turn, rank'],
  ['秒', 'びょう', 'seconds'],
  ['便', 'びん', 'flights, bus runs, deliveries'],
  ['袋', 'ふくろ', 'bags, sacks'],
  ['部屋', 'へや', 'rooms'],
  ['歩', 'ほ', 'steps (walking)'],
  ['名', 'めい', 'people (polite — reservations, headcounts)'],
  ['文字', 'もじ', 'letters, characters'],
  ['問', 'もん', 'questions, problems (tests)'],
  ['話', 'わ', 'episodes, stories'],
]

/** The first ten dates of the month — all irregular. */
const DATES: [string, string][] = [
  ['一日', 'ついたち'],
  ['二日', 'ふつか'],
  ['三日', 'みっか'],
  ['四日', 'よっか'],
  ['五日', 'いつか'],
  ['六日', 'むいか'],
  ['七日', 'なのか'],
  ['八日', 'ようか'],
  ['九日', 'ここのか'],
  ['十日', 'とおか'],
]

function CounterCheatsheetPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/cheatsheet"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Cheatsheet
        </Link>
        <h1 className="text-2xl font-semibold">Japanese Counters</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Japanese never counts bare — a number always pairs with a counter
          word matched to what&apos;s being counted, the way English says
          &ldquo;three <em>sheets</em> of paper&rdquo; — except in Japanese
          it&apos;s mandatory for everything. There are 350+ counters, but the
          ones below cover almost everything daily life throws at you.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">How Counters Work</h2>
        <div className="mt-1 space-y-2.5 text-sm leading-relaxed">
          <p>
            <span className="font-medium">In a sentence,</span> the number +
            counter usually sits right before the verb, like an adverb:{' '}
            <span lang="ja">タイヤを<R k="三" r="さん" />本買った</span>{' '}
            (&ldquo;I bought three tires&rdquo;). To attach it to the noun
            instead, link with <span lang="ja">の</span>:{' '}
            <span lang="ja">五匹の<R k="犬" r="いぬ" />がやって来た</span>{' '}
            (&ldquo;five dogs showed up&rdquo;). The nuance differs slightly —{' '}
            <span lang="ja">五匹の犬が…</span> reads as one specific group of
            five, while <span lang="ja">犬が五匹…</span> just counts how many
            came.
          </p>
          <p>
            <span className="font-medium">Two number systems share the work.</span>{' '}
            Most counters use the Chinese-origin numbers (
            <span lang="ja">いち・に・さん…</span>), with three readings avoided
            for sounding like unlucky words: 4 is <span lang="ja">よん</span>{' '}
            (not し), 7 is <span lang="ja">なな</span> (not しち), 9 is{' '}
            <span lang="ja">きゅう</span> (not く). The native-Japanese numbers
            (<span lang="ja">ひとつ・ふたつ…</span>) survive in the universal{' '}
            <span lang="ja">〜つ</span> counter and in fossils like{' '}
            <span lang="ja">ひとり・ふたり</span> (people) and the first ten
            dates of the month.
          </p>
          <p>
            <span className="font-medium">To ask &ldquo;how many&rdquo;,</span>{' '}
            put <span lang="ja">何</span> before the counter:{' '}
            <span lang="ja">何本（なんぼん）・何枚（なんまい）・何人（なんにん）</span>{' '}
            — or just <span lang="ja">いくつ</span> when no counter comes to
            mind. And when you don&apos;t know the right counter at all, the
            two below are the safe fallbacks — you&apos;ll be understood.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Learn These Two First</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span lang="ja">〜つ</span> counts just about anything — objects,
          abstract ideas, children&apos;s ages — with native-Japanese numbers.
          Its sibling <span lang="ja">個（こ）</span> counts anything with a
          distinct shape (<span lang="ja">いっこ・ろっこ・じゅっこ</span>).
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <tbody>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {TSU_SERIES.map(([k]) => (
                  <th key={k} lang="ja" className="py-1.5 pr-3 font-medium">
                    {k}
                  </th>
                ))}
              </tr>
              <tr>
                {TSU_SERIES.map(([k, r]) => (
                  <td key={k} lang="ja" className="py-2 pr-3">
                    {r}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Must-Know Counters</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These handle people, animals, objects, time, and dates — the core
          set worth memorizing outright.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Counter</th>
                <th className="py-1.5 pr-3 font-medium">Reading</th>
                <th className="py-1.5 pr-3 font-medium">Counts</th>
                <th className="py-1.5 font-medium">Watch out</th>
              </tr>
            </thead>
            <tbody>
              {MUST_KNOW.map(([counter, reading, counts, notes]) => (
                <tr key={counter + reading} className="border-b border-border/60">
                  <td lang="ja" className="py-2 pr-3 text-lg">
                    {counter}
                  </td>
                  <td lang="ja" className="py-2 pr-3 text-muted-foreground">
                    {reading}
                  </td>
                  <td className="py-2 pr-3">{counts}</td>
                  <td lang="ja" className="py-2 text-muted-foreground">
                    {notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          Sound changes — the same few patterns everywhere
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
          <li>
            Counters starting with an h-sound (<span lang="ja">本・匹・杯・分</span>):
            1, 6, 8, 10 harden to p (<span lang="ja">いっぽん・ろっぴき・はっぱい・じゅっぷん</span>),
            3 and <span lang="ja">何</span> soften to b (<span lang="ja">さんぼん・なんびき</span>).
          </li>
          <li>
            Counters starting with k, s, or t (<span lang="ja">回・個・歳・冊</span>):
            1, 8, and 10 double the consonant (<span lang="ja">いっかい・はっこ・じゅっさい</span>).
          </li>
          <li>
            Age 20 is its own word: <span lang="ja">二十歳（はたち）</span>.
          </li>
        </ul>
        <p className="mt-2 font-medium text-amber-700 dark:text-amber-400">
          Dates 1st–10th are all irregular
        </p>
        <p lang="ja" className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 leading-relaxed">
          {DATES.map(([k, r]) => (
            <span key={k} className="whitespace-nowrap">
              <R k={k} r={r} />
            </span>
          ))}
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Common Counters</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The next tier — you&apos;ll meet these constantly in shops,
          restaurants, travel, and media.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Counter</th>
                <th className="py-1.5 pr-3 font-medium">Reading</th>
                <th className="py-1.5 font-medium">Counts</th>
              </tr>
            </thead>
            <tbody>
              {COMMON.map(([counter, reading, counts]) => (
                <tr key={counter + reading + counts} className="border-b border-border/60">
                  <td lang="ja" className="py-2 pr-3 text-lg">
                    {counter}
                  </td>
                  <td lang="ja" className="py-2 pr-3 text-muted-foreground">
                    {reading}
                  </td>
                  <td className="py-2">{counts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Based on Tofugu&apos;s{' '}
        <a
          href="https://www.tofugu.com/japanese/japanese-counters-guide/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-baseline gap-0.5 text-primary underline-offset-2 hover:underline"
        >
          counters guide
          <ExternalLink className="size-3 self-center" />
        </a>{' '}
        and{' '}
        <a
          href="https://www.tofugu.com/japanese/japanese-counters-list/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-baseline gap-0.5 text-primary underline-offset-2 hover:underline"
        >
          list of 350 Japanese counters
          <ExternalLink className="size-3 self-center" />
        </a>{' '}
        — the full list covers the rare and loanword counters too.
      </p>
    </div>
  )
}
