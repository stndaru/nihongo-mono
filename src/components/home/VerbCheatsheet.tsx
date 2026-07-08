import { Link } from '@tanstack/react-router'
import { Eye, Lightbulb, Repeat } from 'lucide-react'
import { ConjugationGuide } from '@/components/home/ConjugationGuide'
import { cn } from '@/lib/utils'

/**
 * The homepage verb-type cheatsheet: what the three types are, how to spot
 * them, and how each conjugates — compact enough to recall by skimming.
 * Static content by design (these facts never change with the dataset);
 * the full 22-form tables live on the verb detail pages.
 */

/** One ruby pair — the cheatsheet is full of them. */
function R({ k, r }: { k: string; r: string }) {
  return (
    <ruby>
      {k}
      <rt>{r}</rt>
    </ruby>
  )
}

/** Per-card accent (kanji badge + label tint) so the three types scan apart. */
const ACCENTS = {
  godan: 'bg-primary/10 text-primary',
  ichidan: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  irregular: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
} as const

function Card({
  accent,
  glyph,
  title,
  tag,
  children,
}: {
  accent: keyof typeof ACCENTS
  glyph: string
  title: string
  tag: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2.5">
        <span
          lang="ja"
          aria-hidden
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md text-lg font-bold',
            ACCENTS[accent],
          )}
        >
          {glyph}
        </span>
        <div className="min-w-0">
          <h3 className="text-base leading-tight font-bold">{title}</h3>
          <span lang="ja" className="text-xs text-muted-foreground">
            {tag}
          </span>
        </div>
      </div>
      {/* separators + breathing room between What / Spot It / Conjugate */}
      <div className="mt-4 divide-y divide-border/60 text-sm [&>*]:py-3.5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
        {children}
      </div>
    </div>
  )
}

const SECTION_ICONS = {
  what: Lightbulb,
  spot: Eye,
  conjugate: Repeat,
} as const

function Row({
  icon,
  label,
  children,
}: {
  icon: keyof typeof SECTION_ICONS
  label: string
  children: React.ReactNode
}) {
  const Icon = SECTION_ICONS[icon]
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  )
}

/** One aligned "form → result" line — far more skimmable than ・-chains. */
function Formula({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span lang="ja">{children}</span>
    </div>
  )
}

/** [form, godan 書く, ichidan 食べる, する, 来る] — readings inline as ruby. */
const TABLE: [string, React.ReactNode, React.ReactNode, React.ReactNode, React.ReactNode][] = [
  [
    'ます (polite)',
    <span lang="ja" key="g"><R k="書" r="か" />きます</span>,
    <span lang="ja" key="i"><R k="食" r="た" />べます</span>,
    <span lang="ja" key="s">します</span>,
    <span lang="ja" key="k"><R k="来" r="き" />ます</span>,
  ],
  [
    'ない (negative)',
    <span lang="ja" key="g"><R k="書" r="か" />かない</span>,
    <span lang="ja" key="i"><R k="食" r="た" />べない</span>,
    <span lang="ja" key="s">しない</span>,
    <span lang="ja" key="k"><R k="来" r="こ" />ない</span>,
  ],
  [
    'て (te form)',
    <span lang="ja" key="g"><R k="書" r="か" />いて</span>,
    <span lang="ja" key="i"><R k="食" r="た" />べて</span>,
    <span lang="ja" key="s">して</span>,
    <span lang="ja" key="k"><R k="来" r="き" />て</span>,
  ],
  [
    'た (past)',
    <span lang="ja" key="g"><R k="書" r="か" />いた</span>,
    <span lang="ja" key="i"><R k="食" r="た" />べた</span>,
    <span lang="ja" key="s">した</span>,
    <span lang="ja" key="k"><R k="来" r="き" />た</span>,
  ],
  [
    'Potential',
    <span lang="ja" key="g"><R k="書" r="か" />ける</span>,
    <span lang="ja" key="i"><R k="食" r="た" />べられる</span>,
    <span lang="ja" key="s">できる</span>,
    <span lang="ja" key="k"><R k="来" r="こ" />られる</span>,
  ],
]

/** Common いる/える-sounding verbs that are secretly godan. */
const TRAPS: [string, string][] = [
  ['帰る', 'かえる'],
  ['走る', 'はしる'],
  ['入る', 'はいる'],
  ['要る', 'いる'],
  ['切る', 'きる'],
  ['知る', 'しる'],
  ['喋る', 'しゃべる'],
  ['減る', 'へる'],
  ['焦る', 'あせる'],
  ['限る', 'かぎる'],
  ['蹴る', 'ける'],
  ['滑る', 'すべる'],
]

export function VerbCheatsheet() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Verb Types at a Glance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every Japanese verb is one of three types, and the type decides every
          conjugation. Spot the type in this order:
        </p>
        <ol className="mt-2 flex flex-col gap-1.5 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5">
          {(
            [
              [<span key="1">する or <span lang="ja">来る</span>?</span>, 'irregular'],
              [<span key="2"><span lang="ja">る</span> after an i/e sound?</span>, 'ichidan'],
              [<span key="3">everything else</span>, 'godan'],
            ] as const
          ).map(([q, a], i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <span>
                {q} <span className="text-muted-foreground">→</span>{' '}
                <span className="font-semibold">{a}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card accent="godan" glyph="五" title="Godan" tag="五段 ・ u-verbs ・ ~70% of all verbs">
          <Row icon="what" label="What">
            The last kana slides across the five vowel rows — that slide{' '}
            <em>is</em> the conjugation.
          </Row>
          <Row icon="spot" label="Spot it">
            <ul className="list-disc space-y-1 pl-4">
              <li>
                Doesn&apos;t end in <span lang="ja">る</span>:{' '}
                <span lang="ja"><R k="書" r="か" />く・<R k="飲" r="の" />む・<R k="話" r="はな" />す</span>
              </li>
              <li>
                Or <span lang="ja">る</span> after an a/u/o sound:{' '}
                <span lang="ja"><R k="分" r="わ" />かる・<R k="乗" r="の" />る</span>
              </li>
            </ul>
          </Row>
          <Row icon="conjugate" label="Conjugate — slide, then attach">
            <div className="space-y-1">
              <Formula label="ない"><R k="書" r="か" />か + ない</Formula>
              <Formula label="ます"><R k="書" r="か" />き + ます</Formula>
              <Formula label="Potential"><R k="書" r="か" />け + る</Formula>
              <Formula label="Volitional"><R k="書" r="か" />こ + う</Formula>
              <Formula label="て / た">く→いて ・ ぐ→いで ・ す→して</Formula>
              <Formula label="">う つ る→って ・ ぬ ぶ む→んで</Formula>
              <Formula label="Exception"><R k="行" r="い" />く → <R k="行" r="い" />って</Formula>
            </div>
          </Row>
        </Card>

        <Card accent="ichidan" glyph="一" title="Ichidan" tag="一段 ・ ru-verbs">
          <Row icon="what" label="What">
            One step: the stem never changes. Conjugate one and you can
            conjugate them all.
          </Row>
          <Row icon="spot" label="Spot it">
            <ul className="list-disc space-y-1 pl-4">
              <li>
                Ends in <span lang="ja">る</span> after an i/e sound:{' '}
                <span lang="ja"><R k="食" r="た" />べる・<R k="見" r="み" />る・<R k="起" r="お" />きる・<R k="寝" r="ね" />る</span>
              </li>
            </ul>
          </Row>
          <Row icon="conjugate" label="Conjugate — drop る, attach">
            <div className="space-y-1">
              <Formula label="ない"><R k="食" r="た" />べ + ない</Formula>
              <Formula label="ます"><R k="食" r="た" />べ + ます</Formula>
              <Formula label="て"><R k="食" r="た" />べ + て</Formula>
              <Formula label="Potential"><R k="食" r="た" />べ + られる</Formula>
              <Formula label="Volitional"><R k="食" r="た" />べ + よう</Formula>
            </div>
          </Row>
        </Card>

        <Card accent="irregular" glyph="不" title="Irregular" tag="する ・ 来る — just these two">
          <Row icon="what" label="What">
            Memorize both. Noun+<span lang="ja">する</span> compounds (
            <span lang="ja"><R k="勉強" r="べんきょう" />する</span>) conjugate
            exactly like <span lang="ja">する</span>.
          </Row>
          <Row icon="conjugate" label="する">
            <div className="space-y-1">
              <Formula label="ない・ます">しない ・ します</Formula>
              <Formula label="て・た">して ・ した</Formula>
              <Formula label="Potential">できる（its own word）</Formula>
            </div>
          </Row>
          <Row icon="conjugate" label="来る — reading changes, kanji doesn't">
            <div className="space-y-1">
              <Formula label="ない"><R k="来" r="こ" />ない</Formula>
              <Formula label="ます・て"><R k="来" r="き" />ます ・ <R k="来" r="き" />て</Formula>
              <Formula label="Potential"><R k="来" r="こ" />られる</Formula>
            </div>
          </Row>
        </Card>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          The る trap — ichidan lookalikes that are godan
        </p>
        {/* flex-wrap, not separators-in-nowrap-spans: adjacent nowrap spans
            with no space between them form one unbreakable run on phones */}
        <p lang="ja" className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 leading-relaxed">
          {TRAPS.map(([k, r]) => (
            <span key={k} className="whitespace-nowrap">
              <R k={k} r={r} />
            </span>
          ))}
        </p>
        <p className="mt-1.5 text-muted-foreground">
          Test with the ない form: <span lang="ja"><R k="帰" r="かえ" />る → <R k="帰" r="かえ" />らない</span>{' '}
          (godan) but <span lang="ja"><R k="変" r="か" />える → <R k="変" r="か" />えない</span> (ichidan).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Form</th>
              <th className="py-1.5 pr-3 font-medium">
                Godan <span lang="ja"><R k="書" r="か" />く</span>
              </th>
              <th className="py-1.5 pr-3 font-medium">
                Ichidan <span lang="ja"><R k="食" r="た" />べる</span>
              </th>
              <th className="py-1.5 pr-3 font-medium">する</th>
              <th className="py-1.5 font-medium">
                <span lang="ja"><R k="来" r="く" />る</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {TABLE.map(([form, godan, ichidan, suru, kuru]) => (
              <tr key={form} className="border-b border-border/60">
                <td className="py-2 pr-3 text-muted-foreground">{form}</td>
                <td className="py-2 pr-3 text-base">{godan}</td>
                <td className="py-2 pr-3 text-base">{ichidan}</td>
                <td className="py-2 pr-3 text-base">{suru}</td>
                <td className="py-2 text-base">{kuru}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConjugationGuide />

      <p className="text-xs text-muted-foreground">
        Every verb&apos;s detail page has the full 22-form table with
        &ldquo;how it&apos;s built&rdquo; rule cards —{' '}
        <Link to="/verbs" className="text-primary underline-offset-2 hover:underline">
          browse the verbs
        </Link>{' '}
        or{' '}
        <Link to="/quiz" className="text-primary underline-offset-2 hover:underline">
          drill these in the quiz
        </Link>
        .
      </p>
    </section>
  )
}
