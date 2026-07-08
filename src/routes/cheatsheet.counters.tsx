import { Fragment, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown, ExternalLink } from 'lucide-react'
import { FeedbackAccordion } from '@/components/quiz/FeedbackAccordion'
import { COUNT_SEQUENCE, countWith, type CounterRule } from '@/lib/counters'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/cheatsheet/counters')({
  component: CounterCheatsheetPage,
})

/**
 * Counters cheatsheet — static content by design, like the verb summary.
 * Scope and groupings follow Tofugu's counters guide + list (credited at
 * the bottom). Rows with a `rule` expand into a generated 1–100 counting
 * sequence (src/lib/counters.ts); rows without one prefer native ひと・ふた
 * counting or calendar readings, where a generated kango sequence would
 * mislead.
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

interface CounterRow {
  counter: string
  reading: string
  counts: string
  notes?: string
  /** present = the row expands into a generated counting sequence */
  rule?: CounterRule
}

const MUST_KNOW: CounterRow[] = [
  { counter: '本', reading: 'ほん', counts: 'long, thin things — pens, bottles, umbrellas, trains, phone calls', notes: 'いっぽん・さんぼん・ろっぽん', rule: { kana: 'ほん', cls: 'hb' } },
  { counter: '枚', reading: 'まい', counts: 'flat things — paper, tickets, plates, shirts', rule: { kana: 'まい', cls: 'none' } },
  { counter: '匹', reading: 'ひき', counts: 'small and medium animals — cats, dogs, fish, insects', notes: 'いっぴき・さんびき・ろっぴき', rule: { kana: 'ひき', cls: 'hb' } },
  { counter: '頭', reading: 'とう', counts: 'large animals — horses, cows, elephants', rule: { kana: 'とう', cls: 't' } },
  { counter: '羽', reading: 'わ', counts: 'birds — and, famously, rabbits', rule: { kana: 'わ', cls: 'none' } },
  { counter: '冊', reading: 'さつ', counts: 'books, magazines, notebooks', notes: 'いっさつ・はっさつ', rule: { kana: 'さつ', cls: 's' } },
  { counter: '台', reading: 'だい', counts: 'machines, vehicles, instruments', rule: { kana: 'だい', cls: 'none' } },
  { counter: '人', reading: 'にん', counts: 'people', notes: 'ひとり・ふたり, then さんにん…', rule: { kana: 'にん', cls: 'none', four: 'よ', special: { 1: 'ひとり', 2: 'ふたり' } } },
  { counter: '歳', reading: 'さい', counts: 'years of age', notes: 'いっさい・はっさい — and 二十歳（はたち）', rule: { kana: 'さい', cls: 's', special: { 20: 'はたち' } } },
  { counter: '回', reading: 'かい', counts: 'times, occurrences', notes: 'いっかい・はっかい', rule: { kana: 'かい', cls: 'k' } },
  { counter: '階', reading: 'かい', counts: 'floors of a building', notes: 'さんがい is common for 3F', rule: { kana: 'かい', cls: 'k', special: { 3: 'さんがい' } } },
  { counter: '分', reading: 'ふん', counts: 'minutes', notes: 'いっぷん・さんぷん・じゅっぷん', rule: { kana: 'ふん', cls: 'hp' } },
  { counter: '時', reading: 'じ', counts: "o'clock", notes: 'よじ (4), しちじ (7), くじ (9)' },
  { counter: '時間', reading: 'じかん', counts: 'hours (duration)', rule: { kana: 'じかん', cls: 'none', four: 'よ', nine: 'く' } },
  { counter: '日', reading: 'にち', counts: 'days and dates', notes: 'ついたち…とおか are special (see below)' },
  { counter: '月', reading: 'がつ・つき', counts: 'calendar months (がつ) / month counts (〜か月 かげつ)' },
  { counter: '年', reading: 'ねん', counts: 'years, school grades', notes: 'よねん (4)', rule: { kana: 'ねん', cls: 'none', four: 'よ' } },
]

const COMMON: CounterRow[] = [
  { counter: '円', reading: 'えん', counts: 'Japanese yen', rule: { kana: 'えん', cls: 'none', four: 'よ' } },
  { counter: '箇所', reading: 'かしょ', counts: 'places, spots, locations', rule: { kana: 'かしょ', cls: 'k' } },
  { counter: '缶', reading: 'かん', counts: 'cans', rule: { kana: 'かん', cls: 'k' } },
  { counter: '巻', reading: 'かん', counts: 'volumes in a book series', rule: { kana: 'かん', cls: 'k' } },
  { counter: '曲', reading: 'きょく', counts: 'songs', rule: { kana: 'きょく', cls: 'k' } },
  { counter: '切れ', reading: 'きれ', counts: 'slices — sashimi, meat, cake' },
  { counter: '口', reading: 'くち', counts: 'bites, sips' },
  { counter: '組', reading: 'くみ', counts: 'pairs, sets, groups; school classes' },
  { counter: '件', reading: 'けん', counts: 'matters, cases, incidents', rule: { kana: 'けん', cls: 'k' } },
  { counter: '軒', reading: 'けん', counts: 'houses, shops, restaurants', rule: { kana: 'けん', cls: 'k' } },
  { counter: '語', reading: 'ご', counts: 'words', rule: { kana: 'ご', cls: 'none' } },
  { counter: '校', reading: 'こう', counts: 'schools', rule: { kana: 'こう', cls: 'k' } },
  { counter: '皿', reading: 'さら', counts: 'plates of food' },
  { counter: '試合', reading: 'しあい', counts: 'games, matches (sports)', rule: { kana: 'しあい', cls: 's' } },
  { counter: '社', reading: 'しゃ', counts: 'companies; shrines', rule: { kana: 'しゃ', cls: 's' } },
  { counter: '種類', reading: 'しゅるい', counts: 'kinds, varieties, types', rule: { kana: 'しゅるい', cls: 's' } },
  { counter: '週', reading: 'しゅう', counts: 'weeks', rule: { kana: 'しゅう', cls: 's' } },
  { counter: '周', reading: 'しゅう', counts: 'laps, circuits', rule: { kana: 'しゅう', cls: 's' } },
  { counter: '色', reading: 'しょく', counts: 'colors', rule: { kana: 'しょく', cls: 's' } },
  { counter: '席', reading: 'せき', counts: 'seats', rule: { kana: 'せき', cls: 's' } },
  { counter: '戦', reading: 'せん', counts: 'battles, matches, rounds', rule: { kana: 'せん', cls: 's' } },
  { counter: '足', reading: 'そく', counts: 'pairs of footwear — shoes, socks', rule: { kana: 'そく', cls: 's' } },
  { counter: '束', reading: 'たば', counts: 'bundles' },
  { counter: '玉', reading: 'たま', counts: 'round things — balls of yarn, pachinko balls' },
  { counter: '段', reading: 'だん', counts: 'steps, shelves, layers; martial-arts ranks', rule: { kana: 'だん', cls: 'none' } },
  { counter: '着', reading: 'ちゃく', counts: 'outfits, articles of clothing', rule: { kana: 'ちゃく', cls: 't' } },
  { counter: '通', reading: 'つう', counts: 'letters, emails, documents', rule: { kana: 'つう', cls: 't' } },
  { counter: '粒', reading: 'つぶ', counts: 'small round things — grains, beans, pills' },
  { counter: '点', reading: 'てん', counts: 'points, scores; items, artworks', rule: { kana: 'てん', cls: 't' } },
  { counter: '度', reading: 'ど', counts: 'times; degrees (temperature, angles)', rule: { kana: 'ど', cls: 'none' } },
  { counter: '杯', reading: 'はい', counts: 'cups and bowls of liquid — also squid, octopus, crabs', notes: 'いっぱい・さんばい', rule: { kana: 'はい', cls: 'hb' } },
  { counter: '泊', reading: 'はく', counts: 'overnight stays', notes: 'いっぱく・さんぱく', rule: { kana: 'はく', cls: 'hp' } },
  { counter: '箱', reading: 'はこ', counts: 'boxes' },
  { counter: '発', reading: 'はつ', counts: 'shots, fireworks, punches', rule: { kana: 'はつ', cls: 'hp' } },
  { counter: '番', reading: 'ばん', counts: 'order, turn, rank', rule: { kana: 'ばん', cls: 'none' } },
  { counter: '秒', reading: 'びょう', counts: 'seconds', rule: { kana: 'びょう', cls: 'none' } },
  { counter: '便', reading: 'びん', counts: 'flights, bus runs, deliveries', rule: { kana: 'びん', cls: 'none' } },
  { counter: '袋', reading: 'ふくろ', counts: 'bags, sacks' },
  { counter: '部屋', reading: 'へや', counts: 'rooms' },
  { counter: '歩', reading: 'ほ', counts: 'steps (walking)', notes: 'いっぽ・さんぽ', rule: { kana: 'ほ', cls: 'hp' } },
  { counter: '名', reading: 'めい', counts: 'people (polite — reservations, headcounts)', rule: { kana: 'めい', cls: 'none' } },
  { counter: '文字', reading: 'もじ', counts: 'letters, characters', rule: { kana: 'もじ', cls: 'none' } },
  { counter: '問', reading: 'もん', counts: 'questions, problems (tests)', rule: { kana: 'もん', cls: 'none' } },
  { counter: '話', reading: 'わ', counts: 'episodes, stories', rule: { kana: 'わ', cls: 'none' } },
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

/** Small labeled card for the "How Counters Work" grid. */
function HowCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </div>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

/** One example line inside a HowCard: Japanese phrase + gloss. */
function ExampleLine({ ja, en }: { ja: React.ReactNode; en: string }) {
  return (
    <div>
      <div lang="ja" className="text-base">
        {ja}
      </div>
      <div className="text-xs text-muted-foreground">{en}</div>
    </div>
  )
}

/** Counter table with per-row expandable generated counting sequences. */
function CounterTable({ rows, withNotes }: { rows: CounterRow[]; withNotes?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const cols = withNotes ? 5 : 4
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', withNotes ? 'min-w-[42rem]' : 'min-w-[32rem]')}>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-3 font-medium">Counter</th>
            <th className="py-1.5 pr-3 font-medium">Reading</th>
            <th className="py-1.5 pr-3 font-medium">Counts</th>
            {withNotes && <th className="py-1.5 pr-3 font-medium">Watch out</th>}
            {/* relative: sr-only is position:absolute — without a positioned
                ancestor inside the scroll container it escapes the overflow
                clip and widens the page */}
            <th className="relative w-8 py-1.5 font-medium">
              <span className="sr-only">Count from 1 to 100</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = row.counter + row.reading
            const isOpen = open === key
            return (
              <Fragment key={key}>
                <tr
                  className={cn(
                    'border-b border-border/60',
                    row.rule && 'cursor-pointer transition-colors duration-100 hover:bg-muted/50',
                    isOpen && 'border-b-0',
                  )}
                  onClick={() => row.rule && setOpen(isOpen ? null : key)}
                  title={row.rule ? 'Show the counting sequence' : undefined}
                >
                  <td lang="ja" className="py-2 pr-3 text-lg">
                    {row.counter}
                  </td>
                  <td lang="ja" className="py-2 pr-3 text-muted-foreground">
                    {row.reading}
                  </td>
                  <td className="py-2 pr-3">{row.counts}</td>
                  {withNotes && (
                    <td lang="ja" className="py-2 pr-3 text-muted-foreground">
                      {row.notes}
                    </td>
                  )}
                  <td className="py-2">
                    {row.rule && (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`Count with ${row.counter}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpen(isOpen ? null : key)
                        }}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      >
                        <ChevronDown
                          className={cn('size-4 transition-transform duration-150', isOpen && 'rotate-180')}
                        />
                      </button>
                    )}
                  </td>
                </tr>
                {isOpen && row.rule && (
                  <tr className="border-b border-border/60">
                    <td colSpan={cols} className="pb-3">
                      {/* CSS multicol: fills top-to-bottom first, then wraps
                          to the next column, and balances column heights —
                          vertical reading order with minimal height */}
                      <div className="columns-2 gap-x-4 rounded-md bg-muted/40 p-3 sm:columns-3 lg:columns-4">
                        {COUNT_SEQUENCE.map((n) => (
                          <div key={n} className="flex break-inside-avoid items-baseline gap-1.5 py-0.5">
                            <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                              {n}
                            </span>
                            <span lang="ja">{countWith(row.rule!, n)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

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
        <h2 className="mb-3 text-lg font-semibold">How Counters Work</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <HowCard title="In a sentence">
            <ExampleLine
              ja={<>タイヤを<span className="font-semibold">三本</span>買った</>}
              en="number + counter before the verb — “I bought three tires”"
            />
            <ExampleLine
              ja={<><span className="font-semibold">五匹の</span>犬がやって来た</>}
              en="or attach to the noun with の — “five dogs showed up”"
            />
          </HowCard>
          <HowCard title="Asking how many">
            <ExampleLine
              ja={<><span className="font-semibold">何</span>本・<span className="font-semibold">何</span>枚・<span className="font-semibold">何</span>人</>}
              en="何 + the counter — なんぼん・なんまい・なんにん"
            />
            <ExampleLine ja="いくつ" en="when no counter comes to mind" />
          </HowCard>
          <HowCard title="Counter unknown?">
            <ExampleLine
              ja={<>りんご<span className="font-semibold">三つ</span>・りんご<span className="font-semibold">三個</span></>}
              en="〜つ and 個 count almost anything — you'll be understood"
            />
          </HowCard>
        </div>
        <div className="mt-3 space-y-2">
          <FeedbackAccordion title="Trivia: two number systems share the work">
            <div className="space-y-2 text-sm leading-relaxed">
              <p>
                Most counters use the Chinese-origin numbers (
                <span lang="ja">いち・に・さん…</span>), with three readings
                avoided for sounding like unlucky words: 4 is{' '}
                <span lang="ja">よん</span> (not し, &ldquo;death&rdquo;), 7 is{' '}
                <span lang="ja">なな</span> (not しち), 9 is{' '}
                <span lang="ja">きゅう</span> (not く, &ldquo;suffering&rdquo;).
              </p>
              <p>
                The native-Japanese numbers (<span lang="ja">ひとつ・ふたつ…</span>)
                survive in the universal <span lang="ja">〜つ</span> counter and
                in fossils like <span lang="ja">ひとり・ふたり</span> (people)
                and the first ten dates of the month. Loanword counters (
                <span lang="ja">セット・ページ</span>) even accept English
                numbers: <span lang="ja">ワンセット・ツーセット</span>.
              </p>
              <p>
                Sometimes the two systems split one word&apos;s nuance —{' '}
                <span lang="ja">五匹の犬が…</span> reads as one specific group
                of five, while <span lang="ja">犬が五匹…</span> just counts how
                many came.
              </p>
            </div>
          </FeedbackAccordion>
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
          set worth memorizing outright. Click a row to see its counting
          sequence, generated from the counter&apos;s sound-change rule.
        </p>
        <div className="mt-2">
          <CounterTable rows={MUST_KNOW} withNotes />
        </div>
      </section>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          Sound changes — the same few patterns everywhere
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
          <li>
            Most h-row counters (<span lang="ja">本・匹・杯</span>): 1, 6, 8, 10
            harden to p (<span lang="ja">いっぽん・ろっぴき・はっぱい・じゅっぽん</span>),
            3 and <span lang="ja">何</span> soften to b (<span lang="ja">さんぼん・なんびき</span>).
          </li>
          <li>
            A few h-row counters never take b — always p after ん or っ (
            <span lang="ja">分・泊・歩</span>: <span lang="ja">さんぷん・よんぷん・さんぱく・さんぽ</span>).
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
          restaurants, travel, and media. Rows without an arrow prefer
          native counting (<span lang="ja">ひと口・ふた切れ</span>) or calendar
          readings, so no sequence is generated for them.
        </p>
        <div className="mt-2">
          <CounterTable rows={COMMON} />
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
