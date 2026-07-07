import { Link } from '@tanstack/react-router'

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

function Card({
  title,
  tag,
  children,
}: {
  title: string
  tag: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-baseline gap-2">
        <h3 className="font-semibold">{title}</h3>
        <span lang="ja" className="text-sm text-muted-foreground">
          {tag}
        </span>
      </div>
      <dl className="mt-2.5 space-y-2.5 text-sm">{children}</dl>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 leading-relaxed">{children}</dd>
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
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Verb Types at a Glance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every Japanese verb is one of three types, and the type decides every
          conjugation. Spot the type in this order:{' '}
          <span className="text-foreground">
            1 · する or <span lang="ja">来る</span>? → irregular&ensp;2 ·{' '}
            <span lang="ja">る</span> with an i/e sound before it? → ichidan
            (mind the trap list)&ensp;3 · everything else → godan.
          </span>
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Godan" tag="五段 ・ u-verbs">
          <Row label="What">
            The biggest group (~70% of verbs). The final kana slides across the
            five vowel rows a・i・u・e・o — that slide <em>is</em> the
            conjugation (五段 = &ldquo;five steps&rdquo;).
          </Row>
          <Row label="Spot it">
            Doesn&apos;t end in <span lang="ja">る</span> (
            <span lang="ja"><R k="書" r="か" />く・<R k="飲" r="の" />む・<R k="話" r="はな" />す</span>
            ) — or ends in <span lang="ja">る</span> with an a/u/o sound before
            it (<span lang="ja"><R k="分" r="わ" />かる・<R k="作" r="つく" />る・<R k="乗" r="の" />る</span>).
          </Row>
          <Row label="Conjugate">
            Slide the last kana, then attach:{' '}
            <span lang="ja"><R k="書" r="か" />か+ない・<R k="書" r="か" />き+ます・<R k="書" r="か" />け+る・<R k="書" r="か" />こ+う</span>
            . Te/ta contract by ending:{' '}
            <span lang="ja">く→いて ・ ぐ→いで ・ す→して ・ うつる→って ・ ぬぶむ→んで</span>{' '}
            (one exception: <span lang="ja"><R k="行" r="い" />く→<R k="行" r="い" />って</span>).
          </Row>
        </Card>

        <Card title="Ichidan" tag="一段 ・ ru-verbs">
          <Row label="What">
            One-step verbs: the stem never changes (一段 = &ldquo;one
            step&rdquo;). Conjugate one and you can conjugate them all.
          </Row>
          <Row label="Spot it">
            Ends in <span lang="ja">る</span> with an i/e sound right before it:{' '}
            <span lang="ja"><R k="食" r="た" />べる・<R k="見" r="み" />る・<R k="起" r="お" />きる・<R k="寝" r="ね" />る</span>.
          </Row>
          <Row label="Conjugate">
            Drop <span lang="ja">る</span>, attach the ending:{' '}
            <span lang="ja"><R k="食" r="た" />べ+ない・<R k="食" r="た" />べ+ます・<R k="食" r="た" />べ+て・<R k="食" r="た" />べ+られる・<R k="食" r="た" />べ+よう</span>.
          </Row>
        </Card>

        <Card title="Irregular" tag="する ・ 来る">
          <Row label="What">
            Just two verbs — memorize them. <span lang="ja">する</span> also
            powers thousands of noun+<span lang="ja">する</span> verbs:{' '}
            <span lang="ja"><R k="勉強" r="べんきょう" />する</span> conjugates
            exactly like <span lang="ja">する</span>.
          </Row>
          <Row label="する">
            <span lang="ja">しない・します・して・した</span> — potential is its
            own word: <span lang="ja">できる</span>.
          </Row>
          <Row label="来る">
            The kanji never changes but the reading does:{' '}
            <span lang="ja"><R k="来" r="こ" />ない・<R k="来" r="き" />ます・<R k="来" r="き" />て・<R k="来" r="こ" />られる</span>.
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
