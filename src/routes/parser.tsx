import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ScanText, Sparkles, TriangleAlert } from 'lucide-react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { WordSummaryDialog } from '@/components/parser/WordSummary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Furigana } from '@/components/verbs/Furigana'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import { PosBadge } from '@/components/vocab/PosBadge'
import { findVerbRowsBySurface, findVocabRowsBySurface } from '@/lib/data/ext-search'
import {
  loadVerbExtIndex,
  loadVerbLevels,
  loadVocabExtIndex,
  loadVocabLevels,
} from '@/lib/data/loader'
import { loadTokenizer, tokenizerReady } from '@/lib/data/kuromoji'
import {
  buildParserDicts,
  collectUnlinkedSurfaces,
  linkBeyondWords,
  parseSentence,
  stripNonJapanese,
  tokensToSegments,
  uniqueWords,
  type ParsedSegment,
  type ParsedWord,
  type ParserDicts,
  type PosKey,
  type TokenInfo,
} from '@/lib/data/parse-sentence'
import type { VocabEntry } from '@/lib/data/types'
import { cn } from '@/lib/utils'

const MAX_LEN = 100
const SMART_KEY = 'nihongo-mono:parser-smart'
/** pre-rename key ("Accurate Parsing") — still read so early opt-ins stick */
const LEGACY_SMART_KEY = 'nihongo-mono:parser-accurate'

interface ParserSearch {
  /** pre-filled sentence (the palette's "Break Down as Sentence" hand-off) */
  q?: string
}

export const Route = createFileRoute('/parser')({
  validateSearch: (search: Record<string, unknown>): ParserSearch => {
    const q =
      typeof search.q === 'string' ? stripNonJapanese(search.q).slice(0, MAX_LEN) : ''
    return q ? { q } : {}
  },
  component: ParserPage,
})

const HAS_KANJI = /[㐀-䶿一-鿿]/u

/** Underline color per POS bucket; second map is the faded not-in-JLPT tint. */
const POS_DECOR: Record<PosKey, string> = {
  verb: 'decoration-primary',
  noun: 'decoration-sky-500/80',
  adjective: 'decoration-amber-500/90',
  adverb: 'decoration-violet-500/80',
  particle: 'decoration-muted-foreground/50',
  other: 'decoration-muted-foreground/50',
}
const POS_DECOR_FADED: Record<PosKey, string> = {
  verb: 'decoration-primary/40',
  noun: 'decoration-sky-500/35',
  adjective: 'decoration-amber-500/40',
  adverb: 'decoration-violet-500/35',
  particle: '',
  other: '',
}

const LEGEND: { key: PosKey; label: string; swatch: string }[] = [
  { key: 'verb', label: 'Verb', swatch: 'bg-primary' },
  { key: 'noun', label: 'Noun', swatch: 'bg-sky-500/80' },
  { key: 'adjective', label: 'Adjective', swatch: 'bg-amber-500/90' },
  { key: 'adverb', label: 'Adverb', swatch: 'bg-violet-500/80' },
]

function wordPosKey(word: ParsedWord): PosKey {
  if (word.isVerb) return 'verb'
  const pos = (word.entry as VocabEntry).pos
  if (pos === 'adj-i' || pos === 'adj-na') return 'adjective'
  if (pos === 'adverb') return 'adverb'
  if (pos === 'noun') return 'noun'
  if (pos === 'particle' || pos === 'conjunction') return 'particle'
  return 'other'
}

/** Surface text, with whole-word ruby when kuromoji supplied a reading. */
function SegText({ text, token }: { text: string; token?: TokenInfo }) {
  if (token?.reading && token.reading !== text && HAS_KANJI.test(text)) {
    return (
      <ruby>
        {text}
        <rt>{token.reading}</rt>
      </ruby>
    )
  }
  return <>{text}</>
}

function TooltipShell({
  trigger,
  children,
}: {
  trigger: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-72 rounded-md border bg-background p-3 text-sm shadow-md duration-100 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {children}
          <TooltipPrimitive.Arrow className="fill-border" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/** A JLPT-linked word: POS-colored underline, hover tooltip, click → summary popup. */
function WordSpan({
  word,
  token,
  onSelect,
}: {
  word: ParsedWord
  token?: TokenInfo
  onSelect: (word: ParsedWord) => void
}) {
  return (
    <TooltipShell
      trigger={
        <button
          type="button"
          onClick={() => onSelect(word)}
          className={cn(
            'rounded-sm underline decoration-dotted underline-offset-4 transition-colors duration-100 hover:bg-primary/15 focus-visible:bg-primary/15',
            POS_DECOR[wordPosKey(word)],
          )}
        >
          <SegText text={word.surface} token={token} />
        </button>
      }
    >
      <div className="flex items-baseline gap-2" lang="ja">
        <span className="font-medium">{word.entry.kanji}</span>
        {word.entry.kana !== word.entry.kanji && (
          <span className="text-xs text-muted-foreground">{word.entry.kana}</span>
        )}
      </div>
      {word.formLabel && (
        <p className="mt-1 text-xs text-primary">
          {word.formLabel === 'Conjugated' ? 'Conjugated form' : word.formLabel} of{' '}
          <span lang="ja">{word.entry.kanji}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {word.entry.gloss.slice(0, 2).join('; ')}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        {word.isVerb ? (
          <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
            Verb
          </Badge>
        ) : (
          <PosBadge pos={(word.entry as VocabEntry).pos} />
        )}
        <LevelBadge level={word.entry.jlpt} />
      </div>
    </TooltipShell>
  )
}

/** A token kuromoji analyzed but no JLPT entry covers — info, no link. */
function TokenSpan({ text, token }: { text: string; token: TokenInfo }) {
  const contentWord = ['verb', 'noun', 'adjective', 'adverb'].includes(token.pos)
  return (
    <TooltipShell
      trigger={
        <span
          className={cn(
            'rounded-sm transition-colors duration-100 hover:bg-muted',
            contentWord
              ? cn('underline decoration-dotted underline-offset-4', POS_DECOR_FADED[token.pos])
              : 'text-muted-foreground',
          )}
        >
          <SegText text={text} token={token} />
        </span>
      }
    >
      <div className="flex items-baseline gap-2" lang="ja">
        <span className="font-medium">{text}</span>
        {token.reading && token.reading !== text && (
          <span className="text-xs text-muted-foreground">{token.reading}</span>
        )}
      </div>
      {token.baseForm && (
        <p className="mt-1 text-xs text-muted-foreground">
          Dictionary form: <span lang="ja">{token.baseForm}</span>
        </p>
      )}
      <div className="mt-1.5 flex items-center gap-1.5">
        <Badge variant="outline" className="px-1.5 font-normal text-muted-foreground">
          {token.posLabel}
        </Badge>
        {contentWord && (
          <span className="text-xs text-muted-foreground">no dictionary entry</span>
        )}
      </div>
    </TooltipShell>
  )
}

function ParserPage() {
  const { q } = Route.useSearch()
  const navigate = Route.useNavigate()

  const [dicts, setDicts] = useState<ParserDicts | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([loadVerbLevels([5, 4, 3, 2, 1]), loadVocabLevels([5, 4, 3, 2, 1])]).then(
      ([verbs, vocab]) => {
        if (alive) setDicts(buildParserDicts(verbs, vocab))
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const [text, setText] = useState(q ?? '')
  const [blocked, setBlocked] = useState(false)
  const [result, setResult] = useState<{
    segments: ParsedSegment[]
    engine: 'accurate' | 'basic'
  } | null>(null)

  // "Smart Parsing" is a sticky opt-in (~17 MB analyzer download) —
  // confirmed once via the dialog, remembered like Include Full Dictionary
  const [smart, setSmart] = useState(
    () => (localStorage.getItem(SMART_KEY) ?? localStorage.getItem(LEGACY_SMART_KEY)) === '1',
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [download, setDownload] = useState<{ done: number; total: number } | null>(null)
  const [analyzerFailed, setAnalyzerFailed] = useState(false)
  const [extLoading, setExtLoading] = useState(false)
  const [selectedWord, setSelectedWord] = useState<ParsedWord | null>(null)

  const onInput = (raw: string) => {
    const clean = stripNonJapanese(raw).slice(0, MAX_LEN)
    setBlocked(clean.length !== raw.length)
    setText(clean)
  }

  // the sentence lives in ?q= so the breakdown survives navigating to a
  // word's detail page and coming back (and palette hand-offs auto-run)
  const breakDown = () => {
    const trimmed = text.trim()
    if (trimmed) navigate({ search: { q: trimmed }, replace: true })
  }

  useEffect(() => {
    if (!q || !dicts) return
    let alive = true
    setText(q)
    if (!smart) {
      setResult({ segments: parseSentence(q, dicts), engine: 'basic' })
      return
    }
    if (!tokenizerReady()) setDownload({ done: 0, total: 12 })
    loadTokenizer((done, total) => {
      if (alive) setDownload({ done, total })
    })
      .then((tokenizer) => {
        if (!alive) return
        setDownload(null)
        setAnalyzerFailed(false)
        const segments = tokensToSegments(tokenizer.tokenize(q), dicts)
        setResult({ segments, engine: 'accurate' })
        // second pass: content words the JLPT maps missed get looked up in
        // the extended indexes and linked as "Beyond" entries
        const { verbs, words } = collectUnlinkedSurfaces(segments)
        if (verbs.size + words.size === 0) return
        setExtLoading(true)
        // only fetch the index that actually has misses — the vocab index
        // alone is ~5.5 MB, the verb one ~0.6 MB
        Promise.all([
          verbs.size > 0 ? loadVerbExtIndex() : Promise.resolve([]),
          words.size > 0 ? loadVocabExtIndex() : Promise.resolve([]),
        ])
          .then(([verbRows, vocabRows]) => {
            if (!alive) return
            const verbHits = findVerbRowsBySurface(verbRows, verbs)
            const vocabHits = findVocabRowsBySurface(vocabRows, words)
            if (verbHits.size + vocabHits.size > 0) {
              setResult({
                segments: linkBeyondWords(segments, verbHits, vocabHits),
                engine: 'accurate',
              })
            }
          })
          .catch(() => {}) // no Beyond links is a degraded state, not an error
          .finally(() => {
            if (alive) setExtLoading(false)
          })
      })
      .catch(() => {
        if (!alive) return
        setDownload(null)
        setAnalyzerFailed(true)
        setResult({ segments: parseSentence(q, dicts), engine: 'basic' })
      })
    return () => {
      alive = false
    }
  }, [q, dicts, smart])

  const enableSmart = () => {
    localStorage.setItem(SMART_KEY, '1')
    setAnalyzerFailed(false)
    setSmart(true) // re-runs the parse effect when a sentence is present
    // start the download right away — the user just approved it
    if (!tokenizerReady()) {
      setDownload({ done: 0, total: 12 })
      loadTokenizer((done, total) => setDownload({ done, total }))
        .then(() => setDownload(null))
        .catch(() => {
          setDownload(null)
          setAnalyzerFailed(true)
        })
    }
  }

  const toggleSmart = () => {
    if (smart) {
      setSmart(false)
      localStorage.setItem(SMART_KEY, '0')
      return
    }
    // the confirm dialog exists to announce the download — skip it when the
    // analyzer is already loaded this session or was confirmed before
    // (the dictionary sits in the browser's HTTP cache)
    const confirmedBefore =
      localStorage.getItem(SMART_KEY) !== null ||
      localStorage.getItem(LEGACY_SMART_KEY) !== null
    if (tokenizerReady() || confirmedBefore) enableSmart()
    else setConfirmOpen(true)
  }

  const confirmSmart = () => {
    setConfirmOpen(false)
    enableSmart()
  }

  const words = useMemo(() => (result ? uniqueWords(result.segments) : []), [result])

  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Sentence Parser</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a Japanese sentence and break it down into the words it&apos;s
            built from — verbs (conjugated ones included), nouns, adjectives,
            adverbs, and more. Hover a highlighted word for a quick summary;
            click it for the full detail page.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
            <TriangleAlert className="size-4 shrink-0" /> Before you rely on it
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
            <li>
              The default breakdown is heuristic dictionary matching, not a full
              grammar analyzer — incoherent sentences, typos, or unusual
              spellings will produce an inaccurate breakdown. Turning on{' '}
              <span className="font-medium">Smart Parsing</span> (a one-time
              ~17&nbsp;MB download) switches to a proper morphological analyzer,
              which is much better but still not infallible.
            </li>
            <li>
              Japanese input only: <span lang="ja">かな</span> and{' '}
              <span lang="ja">漢字</span>. Romaji is not accepted — type{' '}
              <span lang="ja">たべた</span>, not &quot;tabeta&quot;.
            </li>
            <li>
              Only JLPT-listed words are clickable in the default mode. With
              Smart Parsing, other dictionary words link too (marked{' '}
              <span className="font-medium">Beyond</span>), and anything not in
              the dictionary still shows its reading and part of speech on
              hover.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => onInput(e.target.value)}
            lang="ja"
            rows={4}
            placeholder="旅行の楽しみは、何といってもやはり、その土地の名物料理を食べることだろう。"
            className="min-h-32 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-lg outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {blocked && (
                <span className="text-destructive">
                  Non-Japanese characters were removed — kana and kanji only.{' '}
                </span>
              )}
              {text.length}/{MAX_LEN}
            </p>
            <div className="flex items-center gap-2">
              <Chip
                active={smart}
                onClick={toggleSmart}
                title="segment with the kuromoji morphological analyzer (one-time ~17 MB download)"
              >
                <span className="flex items-center gap-1">
                  <Sparkles className="size-3" /> Smart Parsing
                </span>
              </Chip>
              <Button onClick={breakDown} disabled={!dicts || !text.trim()}>
                {dicts ? 'Break Down' : 'Loading dictionary…'}
              </Button>
            </div>
          </div>
          {download && (
            <p className="text-xs text-muted-foreground">
              Downloading the analyzer… {download.done}/{download.total} files (one-time,
              cached afterwards)
            </p>
          )}
          {analyzerFailed && (
            <p className="text-xs text-destructive">
              The analyzer couldn&apos;t be downloaded — showing the basic
              dictionary-match breakdown instead.
            </p>
          )}
          {extLoading && (
            <p className="text-xs text-muted-foreground">
              Checking the full dictionary for words outside the JLPT lists…
            </p>
          )}
        </div>

        {result && (
          <>
            <section>
              <h2 className="mb-2 text-lg font-semibold">Breakdown</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Dotted words are recognized — hover for a quick look, click for a
                summary popup.
              </p>
              <p lang="ja" className="rounded-lg border p-4 text-2xl/loose">
                {result.segments.map((seg, i) =>
                  seg.word ? (
                    <WordSpan key={i} word={seg.word} token={seg.token} onSelect={setSelectedWord} />
                  ) : seg.token ? (
                    <TokenSpan key={i} text={seg.text} token={seg.token} />
                  ) : (
                    <span key={i} className="text-muted-foreground">
                      {seg.text}
                    </span>
                  ),
                )}
              </p>
              {result.engine === 'accurate' ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {LEGEND.map((l) => (
                    <span key={l.key} className="flex items-center gap-1">
                      <span className={cn('h-0.5 w-4 rounded-full', l.swatch)} />
                      {l.label}
                    </span>
                  ))}
                  <span>· faded underline = not in the dictionary · gray = particles &amp; endings</span>
                </div>
              ) : (
                !smart && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tip: enable Smart Parsing for analyzer-grade segmentation,
                    furigana on every word, and hover info for non-JLPT words.
                  </p>
                )
              )}
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold">
                Words Found{words.length > 0 ? ` (${words.length})` : ''}
              </h2>
              {words.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing recognized — the sentence may use words outside the JLPT
                  lists, or an unusual spelling.
                </p>
              ) : (
                <div className="grid gap-1.5">
                  {words.map((word) => (
                    <button
                      key={`${word.entry.id}:${word.surface}`}
                      type="button"
                      onClick={() => setSelectedWord(word)}
                      className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-md border p-2.5 text-left transition-colors duration-100 hover:border-primary/50 hover:bg-primary/5"
                    >
                      <Furigana segments={word.entry.furigana} className="shrink-0 text-base" />
                      {word.formLabel && (
                        <span lang="ja" className="text-sm text-muted-foreground">
                          {word.surface}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {word.entry.gloss.join('; ')}
                      </span>
                      {word.formLabel && (
                        <Badge variant="outline" className="px-1.5 font-normal text-primary">
                          {word.formLabel === 'Conjugated' ? 'Conjugated form' : word.formLabel}
                        </Badge>
                      )}
                      {word.isVerb ? (
                        <Badge
                          variant="outline"
                          className="px-1.5 font-normal text-muted-foreground"
                        >
                          Verb
                        </Badge>
                      ) : (
                        <PosBadge pos={(word.entry as VocabEntry).pos} />
                      )}
                      <LevelBadge level={word.entry.jlpt} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {!result && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ScanText className="size-3.5" />
            Tip: the Ctrl/Cmd+K search offers &quot;Break Down as Sentence&quot; when a
            Japanese query matches no word.
          </p>
        )}

        <WordSummaryDialog word={selectedWord} onClose={() => setSelectedWord(null)} />

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enable Smart Parsing?</DialogTitle>
              <DialogDescription>
                This downloads the kuromoji morphological analyzer and its IPADIC
                dictionary — a one-time download of about 17&nbsp;MB, cached by
                your browser afterwards (plus a ~6&nbsp;MB full-dictionary index
                the first time a sentence contains words outside the JLPT
                lists). Sentences are then segmented by a real analyzer: better
                word boundaries, furigana on every word, and clickable entries
                even beyond the JLPT lists.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmSmart}>Download &amp; Enable</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipPrimitive.Provider>
  )
}
