import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { FeedbackAccordion } from '@/components/quiz/FeedbackAccordion'

export const Route = createFileRoute('/cheatsheet/wearing')({
  component: WearingCheatsheetPage,
})

/**
 * One "way to say wear" row: the verb, what part of the body / kind of item
 * it goes with, and one example sentence (reading given in kana so the page
 * needs no furigana pipeline — cheatsheets are static content).
 */
interface WearRow {
  verb: string
  reading: string
  usedFor: string
  items: string
  exampleJa: string
  exampleReading: string
  exampleEn: string
}

const WEAR_VERBS: WearRow[] = [
  {
    verb: '着る',
    reading: 'きる',
    usedFor: 'Torso & full body',
    items: 'shirts, jackets, dresses, kimono',
    exampleJa: '寒いのでコートを着た。',
    exampleReading: 'さむいのでコートをきた',
    exampleEn: 'It was cold, so I put on a coat.',
  },
  {
    verb: '履く',
    reading: 'はく',
    usedFor: 'Waist down & feet',
    items: 'pants, skirts, shoes, socks',
    exampleJa: '新しい靴を履いて出かけた。',
    exampleReading: 'あたらしいくつをはいてでかけた',
    exampleEn: 'I went out wearing my new shoes.',
  },
  {
    verb: '被る',
    reading: 'かぶる',
    usedFor: 'On the head',
    items: 'hats, caps, helmets, hoods',
    exampleJa: '自転車ではヘルメットを被ってください。',
    exampleReading: 'じてんしゃではヘルメットをかぶってください',
    exampleEn: 'Please wear a helmet on a bicycle.',
  },
  {
    verb: 'かける',
    reading: 'かける',
    usedFor: 'Hooked over the ears',
    items: 'glasses, sunglasses',
    exampleJa: '父はいつも眼鏡をかけている。',
    exampleReading: 'ちちはいつもめがねをかけている',
    exampleEn: 'My father always wears glasses.',
  },
  {
    verb: '羽織る',
    reading: 'はおる',
    usedFor: 'Draped over the shoulders',
    items: 'cardigans, coats, shawls',
    exampleJa: '肩にカーディガンを羽織った。',
    exampleReading: 'かたにカーディガンをはおった',
    exampleEn: 'I draped a cardigan over my shoulders.',
  },
  {
    verb: 'つける',
    reading: 'つける',
    usedFor: 'Attached to the body',
    items: 'earrings, necklaces, badges, watches, perfume',
    exampleJa: '今日は新しい香水をつけている。',
    exampleReading: 'きょうはあたらしいこうすいをつけている',
    exampleEn: "I'm wearing a new perfume today.",
  },
  {
    verb: 'はめる',
    reading: 'はめる',
    usedFor: 'Slipped snugly on',
    items: 'rings, gloves',
    exampleJa: '彼は結婚指輪をはめている。',
    exampleReading: 'かれはけっこんゆびわをはめている',
    exampleEn: 'He wears a wedding ring.',
  },
  {
    verb: '締める',
    reading: 'しめる',
    usedFor: 'Fastened around',
    items: 'neckties, belts, kimono obi',
    exampleJa: '面接のためにネクタイを締めた。',
    exampleReading: 'めんせつのためにネクタイをしめた',
    exampleEn: 'I put on a tie for the interview.',
  },
  {
    verb: '巻く',
    reading: 'まく',
    usedFor: 'Wrapped around',
    items: 'scarves, mufflers',
    exampleJa: '寒い日はマフラーを巻く。',
    exampleReading: 'さむいひはマフラーをまく',
    exampleEn: 'I wrap a scarf around my neck on cold days.',
  },
  {
    verb: 'する',
    reading: 'する',
    usedFor: 'Everyday catch-all for accessories',
    items: 'masks, ties, rings, gloves, scarves',
    exampleJa: '電車ではマスクをしている人が多い。',
    exampleReading: 'でんしゃではマスクをしているひとがおおい',
    exampleEn: 'Many people wear masks on the train.',
  },
]

/** Small labeled card, same shape as the counters page's HowCard. */
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

function WearingCheatsheetPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/cheatsheet"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Cheatsheet
        </Link>
        <h1 className="text-2xl font-semibold">Ways to Say &ldquo;Wear&rdquo;</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          English wears everything; Japanese picks the verb by <em>where on
          the body</em> the item goes and <em>how it attaches</em> — clothes
          are <span lang="ja">着る</span> on the torso but{' '}
          <span lang="ja">履く</span> from the waist down, glasses hook on
          (<span lang="ja">かける</span>), hats go on top
          (<span lang="ja">かぶる</span>). The table below covers the verbs
          daily life needs.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">How Wearing Works</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <HowCard title="The pattern">
            <ExampleLine
              ja={<>シャツ<span className="font-semibold">を</span>着る</>}
              en="item + を + the verb matched to the item"
            />
            <ExampleLine
              ja={<>帽子<span className="font-semibold">を</span>かぶる</>}
              en="ぼうしをかぶる — put on a hat"
            />
          </HowCard>
          <HowCard title="Putting on vs wearing">
            <ExampleLine
              ja={<>コートを<span className="font-semibold">着る</span></>}
              en="the plain verb is the ACTION of putting it on"
            />
            <ExampleLine
              ja={<>コートを<span className="font-semibold">着ている</span></>}
              en="〜ている is the STATE of having it on — “is wearing”"
            />
          </HowCard>
          <HowCard title="Not sure which verb?">
            <ExampleLine
              ja={<>ネクタイ・マスク・指輪＋<span className="font-semibold">を</span>する</>}
              en="する covers most accessories in everyday speech"
            />
            <ExampleLine
              ja="身につける"
              en="みにつける — a formal catch-all for anything worn or carried on the body"
            />
          </HowCard>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">The Verbs, by Body Part</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Verb</th>
                <th className="py-1.5 pr-3 font-medium">Reading</th>
                <th className="py-1.5 pr-3 font-medium">Where / how</th>
                <th className="py-1.5 pr-3 font-medium">Typical items</th>
                <th className="py-1.5 font-medium">Example</th>
              </tr>
            </thead>
            <tbody>
              {WEAR_VERBS.map((row) => (
                <tr key={row.verb + row.usedFor} className="border-b border-border/60">
                  <td lang="ja" className="py-2.5 pr-3 text-lg whitespace-nowrap">
                    {row.verb}
                  </td>
                  <td lang="ja" className="py-2.5 pr-3 text-muted-foreground">
                    {row.reading}
                  </td>
                  <td className="py-2.5 pr-3">{row.usedFor}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{row.items}</td>
                  <td className="py-2.5">
                    <div lang="ja" className="text-base">
                      {row.exampleJa}
                    </div>
                    <div lang="ja" className="text-xs text-muted-foreground">
                      {row.exampleReading}
                    </div>
                    <div className="text-xs text-muted-foreground">{row.exampleEn}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Watch Out</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            <span lang="ja">履く</span> for pants and skirts is often written{' '}
            <span lang="ja">穿く</span> in careful writing (feet get{' '}
            <span lang="ja">履く</span>, waist-down cloth gets{' '}
            <span lang="ja">穿く</span>) — but in practice it&apos;s usually
            just kana: <span lang="ja">ズボンをはく</span>.
          </li>
          <li>
            Describing what someone <em>has on</em> almost always takes{' '}
            <span lang="ja">〜ている</span>:{' '}
            <span lang="ja">眼鏡をかけている人</span> &ldquo;the person
            wearing glasses&rdquo;, <span lang="ja">スーツを着ている</span>{' '}
            &ldquo;is wearing a suit&rdquo;. The plain form usually reads as
            the act of putting on (or a habit).
          </li>
          <li>
            Taking things off splits the same way: <span lang="ja">脱ぐ</span>{' '}
            (<span lang="ja">ぬぐ</span>) undoes clothing —{' '}
            <span lang="ja">着る・履く</span> items and, together with{' '}
            <span lang="ja">取る</span>, hats — while{' '}
            <span lang="ja">外す</span> (<span lang="ja">はずす</span>)
            removes accessories: glasses, rings, ties, watches.
          </li>
          <li>
            <span lang="ja">かける</span> is for things that hook or hang —
            in everyday speech that means glasses. Necklaces are usually{' '}
            <span lang="ja">つける</span> or <span lang="ja">する</span>.
          </li>
        </ul>
        <div className="mt-3">
          <FeedbackAccordion title="Trivia: wearing a cat">
            <p className="text-sm leading-relaxed">
              <span lang="ja">猫を被る</span> (<span lang="ja">ねこをかぶる</span>,
              &ldquo;to wear a cat&rdquo;) means putting on an innocent,
              well-behaved front — the metaphor is covering your real self
              with something soft and harmless, the same{' '}
              <span lang="ja">被る</span> you use for hats.
            </p>
          </FeedbackAccordion>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Cross-checked against{' '}
        <a
          className="text-primary underline-offset-2 hover:underline"
          href="https://maggiesensei.com/2010/09/15/%E7%9D%80%E3%82%8Bkiru-how-to-say-wear-or-put-on-in-japanese/"
          target="_blank"
          rel="noreferrer"
        >
          Maggie Sensei
        </a>{' '}
        and{' '}
        <a
          className="text-primary underline-offset-2 hover:underline"
          href="https://kuwashiijapanese.com/2020/07/08/the-many-ways-to-wear-and-take-off-something-in-japanese/"
          target="_blank"
          rel="noreferrer"
        >
          Kuwashii Japanese
        </a>
        &apos;s guides to wearing verbs.
      </p>
    </div>
  )
}
