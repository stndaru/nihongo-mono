import {
  lazy,
  startTransition,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown, ScanText, Sparkles, TriangleAlert } from 'lucide-react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { WordSummaryDialog } from '@/components/parser/WordSummary'
import { TranslationSection, useTranslation } from '@/components/parser/TranslationSection'
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
import { destroyOcrIfLoaded } from '@/lib/ocr/handle'
import { ocrOutcome, type OcrOutcome } from '@/lib/ocr/postprocess'
import {
  MAX_EN_SENTENCE_LEN,
  MAX_SENTENCE_LEN,
  buildParserDicts,
  collectUnlinkedSurfaces,
  linkBeyondWords,
  parseSentence,
  stripNonEnglish,
  stripNonJapanese,
  tokensToSegments,
  uniqueWords,
  type ParsedSegment,
  type ParsedWord,
  type ParserDicts,
  type PosKey,
  type TokenInfo,
} from '@/lib/data/parse-sentence'
import { translateToJapanese } from '@/lib/data/translate'
import type { VocabEntry } from '@/lib/data/types'
import { cn } from '@/lib/utils'

const MAX_LEN = MAX_SENTENCE_LEN
const EN_MAX_LEN = MAX_EN_SENTENCE_LEN
/**
 * The textarea may exceed the parse cap — a whole OCR dump (or long paste)
 * lands intact and gets edited down, with Break Down blocked until it fits —
 * but never this ceiling, which protects the auto-grow box. The committed
 * ?q=/?en= params stay capped at MAX_LEN/EN_MAX_LEN via validateSearch.
 */
const EDIT_CEILING = 2000
const SMART_KEY = 'nihongo-mono:parser-smart'
/** pre-rename key ("Accurate Parsing") — still read so early opt-ins stick */
const LEGACY_SMART_KEY = 'nihongo-mono:parser-accurate'
/** sticky Scan Image opt-in — non-null means the download was announced once */
const OCR_KEY = 'nihongo-mono:parser-ocr'

// the OCR panel (and with it tesseract-wasm) loads only when rendered —
// users who never scan an image download none of it
const OcrPanel = lazy(() => import('@/components/parser/OcrPanel'))

/** Scan Image needs wasm + workers; anything this old hides the feature. */
const OCR_SUPPORTED =
  typeof WebAssembly !== 'undefined' && typeof Worker !== 'undefined'

interface ParserSearch {
  /** JP→EN sentence (the palette's "Break Down as Sentence" hand-off) */
  q?: string
  /** EN→JP mode's English input — fully independent of q */
  en?: string
  /** active direction tab; absent = the default JP→EN */
  dir?: 'en'
}

export const Route = createFileRoute('/parser')({
  validateSearch: (search: Record<string, unknown>): ParserSearch => {
    const q =
      typeof search.q === 'string' ? stripNonJapanese(search.q).slice(0, MAX_LEN) : ''
    const en =
      typeof search.en === 'string'
        ? stripNonEnglish(search.en).trim().slice(0, EN_MAX_LEN)
        : ''
    const out: ParserSearch = {}
    if (q) out.q = q
    if (en) out.en = en
    if (search.dir === 'en') out.dir = 'en'
    return out
  },
  component: ParserPage,
})

const HAS_KANJI = /[㐀-䶿一-鿿]/u

/**
 * Underline color per POS bucket, carried as a custom property so the same
 * value drives text-decoration-color normally AND border-bottom-color when
 * the flex-stack ruby is active (non-default furigana size) — decorations
 * can't propagate into that atomic inline box, so `.parser-underline` in
 * index.css redraws the line as a border. Second map: faded not-in-JLPT tint.
 */
const POS_DECOR: Record<PosKey, string> = {
  verb: '[--pos-line:var(--color-primary)]',
  noun: '[--pos-line:color-mix(in_oklab,var(--color-sky-500)_80%,transparent)]',
  adjective: '[--pos-line:color-mix(in_oklab,var(--color-amber-500)_90%,transparent)]',
  adverb: '[--pos-line:color-mix(in_oklab,var(--color-violet-500)_80%,transparent)]',
  particle: '[--pos-line:color-mix(in_oklab,var(--color-muted-foreground)_50%,transparent)]',
  other: '[--pos-line:color-mix(in_oklab,var(--color-muted-foreground)_50%,transparent)]',
}
const POS_DECOR_FADED: Record<PosKey, string> = {
  verb: '[--pos-line:color-mix(in_oklab,var(--color-primary)_40%,transparent)]',
  noun: '[--pos-line:color-mix(in_oklab,var(--color-sky-500)_35%,transparent)]',
  adjective: '[--pos-line:color-mix(in_oklab,var(--color-amber-500)_40%,transparent)]',
  adverb: '[--pos-line:color-mix(in_oklab,var(--color-violet-500)_35%,transparent)]',
  particle: '',
  other: '',
}

const UNDERLINE = 'parser-underline underline decoration-dotted decoration-(--pos-line) underline-offset-4'

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
          className="z-50 max-w-72 origin-(--radix-tooltip-content-transform-origin) rounded-md border bg-background p-3 text-sm shadow-md duration-100 ease-snap data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95"
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
            'rounded-sm transition-colors duration-100 hover:bg-primary/15 focus-visible:bg-primary/15',
            UNDERLINE,
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
        {word.counterUse && (
          <Badge variant="outline" className="px-1.5 font-normal text-primary">
            Counter here
          </Badge>
        )}
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
              ? cn(UNDERLINE, POS_DECOR_FADED[token.pos])
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

/**
 * The full breakdown pipeline for one Japanese sentence: greedy parse, or
 * (smart mode) kuromoji segmentation plus the async Beyond pass. Extracted
 * so the JP→EN and EN→JP tabs each own an instance — their results live
 * side by side and switching tabs never recomputes or resets either.
 */
function useBreakdown(ja: string | undefined, smart: boolean, dicts: ParserDicts | null) {
  const [result, setResultNow] = useState<{
    segments: ParsedSegment[]
    engine: 'accurate' | 'basic'
  } | null>(null)
  // committing the breakdown renders dozens of ruby+tooltip spans in one go —
  // as a transition React time-slices that work instead of blocking the main
  // thread in a single long task (measured: a 4×-throttled re-parse commit
  // was the page's only >50 ms task)
  const setResult = (r: { segments: ParsedSegment[]; engine: 'accurate' | 'basic' }) =>
    startTransition(() => setResultNow(r))
  const [download, setDownload] = useState<{ done: number; total: number } | null>(null)
  const [analyzerFailed, setAnalyzerFailed] = useState(false)
  const [extLoading, setExtLoading] = useState(false)

  useEffect(() => {
    if (!ja || !dicts) return
    let alive = true
    if (!smart) {
      setResult({ segments: parseSentence(ja, dicts), engine: 'basic' })
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
        const segments = tokensToSegments(tokenizer.tokenize(ja), dicts)
        setResult({ segments, engine: 'accurate' })
        // second pass: content words the JLPT maps missed get looked up in
        // the extended indexes and linked as "Beyond" entries
        const { verbs, words, readings, counters, kanaNative } =
          collectUnlinkedSurfaces(segments)
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
            const vocabHits = findVocabRowsBySurface(vocabRows, words, readings, {
              counters,
              kanaNative,
            })
            if (verbHits.size + vocabHits.entries.size > 0) {
              setResult({
                segments: linkBeyondWords(
                  segments,
                  verbHits,
                  vocabHits.entries,
                  vocabHits.alternates,
                ),
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
        setResult({ segments: parseSentence(ja, dicts), engine: 'basic' })
      })
    return () => {
      alive = false
    }
  }, [ja, dicts, smart])

  return { result, download, analyzerFailed, extLoading }
}

type EnToJaState =
  | { status: 'loading' }
  | {
      status: 'done'
      ja: string
      provider: 'google' | 'mymemory'
      /** the generated Japanese exceeded the parser cap and was trimmed */
      truncated: boolean
    }
  | { status: 'error' }

/**
 * The EN→JP mode's first step: machine-translate the committed English into
 * Japanese (cached per sentence). The cleaned result is what the breakdown
 * pipeline receives.
 */
function useEnToJa(sentence: string | undefined, attempt = 0): EnToJaState | null {
  const [state, setState] = useState<EnToJaState | null>(null)
  useEffect(() => {
    if (!sentence) {
      setState(null)
      return
    }
    let alive = true
    setState({ status: 'loading' })
    translateToJapanese(sentence)
      .then((t) => {
        if (!alive) return
        const clean = stripNonJapanese(t.text)
        const ja = clean.slice(0, MAX_LEN)
        if (!ja) setState({ status: 'error' }) // no Japanese came back at all
        else {
          setState({ status: 'done', ja, provider: t.provider, truncated: clean.length > MAX_LEN })
        }
      })
      .catch(() => {
        if (alive) setState({ status: 'error' })
      })
    return () => {
      alive = false
    }
    // `attempt` re-fires the fetch after an outage — the sentence alone
    // can't when the user re-commits identical text
  }, [sentence, attempt])
  return state
}

function ParserPage() {
  const { q, en, dir: dirParam } = Route.useSearch()
  const dir: 'ja' | 'en' = dirParam ?? 'ja'
  const navigate = Route.useNavigate()

  const [dicts, setDicts] = useState<ParserDicts | null>(null)
  // the JLPT dictionary (~1.9 MB over ten files) loads on intent — first
  // touch of the textarea, or a ?q=/?en= deep link — not on page view, so
  // just reading the page costs nothing
  const [dictsWanted, setDictsWanted] = useState(() => !!q || !!en)
  useEffect(() => {
    if (q || en) setDictsWanted(true)
  }, [q, en])
  useEffect(() => {
    if (!dictsWanted) return
    let alive = true
    Promise.all([loadVerbLevels([5, 4, 3, 2, 1]), loadVocabLevels([5, 4, 3, 2, 1])])
      .then(([verbs, vocab]) => {
        if (alive) setDicts(buildParserDicts(verbs, vocab))
      })
      .catch(() => {
        // a failed load (loader caches self-clear) must not leave the button
        // stuck on "Loading dictionary…" — reset so the next focus retries
        if (alive) setDictsWanted(false)
      })
    return () => {
      alive = false
    }
  }, [dictsWanted])

  // the two direction tabs are fully independent: each keeps its own input
  // text and pipeline state, so switching never resets or transfers anything
  const [text, setText] = useState(q ?? '')
  const [blocked, setBlocked] = useState(false)
  const [enText, setEnText] = useState(en ?? '')
  const [enBlocked, setEnBlocked] = useState(false)
  useEffect(() => {
    if (q) setText(q)
  }, [q])
  useEffect(() => {
    if (en) setEnText(en)
  }, [en])

  // "Smart Parsing" is a sticky opt-in (~17 MB analyzer download) —
  // confirmed once via the dialog, remembered like Include Full Dictionary
  // scan-view state lives up here — the textarea auto-grow effect below
  // needs ocrView as a dependency
  const [ocrView, setOcrView] = useState(false)
  const [ocrMounted, setOcrMounted] = useState(false)
  const [ocrConfirmOpen, setOcrConfirmOpen] = useState(false)
  // keyboard-summoned surfaces don't animate (decision 48)
  const ocrByKeyboard = useRef(false)

  const [smart, setSmart] = useState(
    () => (localStorage.getItem(SMART_KEY) ?? localStorage.getItem(LEGACY_SMART_KEY)) === '1',
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  // enableSmart can start the analyzer download with no sentence committed —
  // page-level progress for that case; the per-tab hooks track their own
  const [manualDownload, setManualDownload] = useState<{
    done: number
    total: number
  } | null>(null)
  const [manualFailed, setManualFailed] = useState(false)
  const [selectedWord, setSelectedWord] = useState<ParsedWord | null>(null)
  // per-tab retry counters: re-committing IDENTICAL text doesn't change the
  // URL param, so after an outage these are the only way to re-fire the
  // translation effects (bumped by Try Again and by the main button when
  // the current state is an error)
  const [jpAttempt, setJpAttempt] = useState(0)
  const [enAttempt, setEnAttempt] = useState(0)
  // fires immediately on ?q= — in parallel with (never waiting on) the dicts
  const translation = useTranslation(q, jpAttempt)
  const [noticeOpen, setNoticeOpen] = useState(false)

  const jp = useBreakdown(q, smart, dicts)
  const enToJa = useEnToJa(en, enAttempt)
  const enBd = useBreakdown(
    enToJa?.status === 'done' ? enToJa.ja : undefined,
    smart,
    dicts,
  )
  const active = dir === 'en' ? enBd : jp
  const result = active.result
  const download = active.download ?? manualDownload
  const analyzerFailed = active.analyzerFailed || manualFailed
  const extLoading = active.extLoading
  const activeText = dir === 'en' ? enText : text
  const maxLen = dir === 'en' ? EN_MAX_LEN : MAX_LEN
  const overLimit = activeText.length > maxLen

  // custom resize handle: the native corner grip is nearly unhittable once
  // the textarea's scrollbar appears, so a full-width drag strip replaces it
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [taHeight, setTaHeight] = useState<number | null>(null)

  // auto-fit the box to its content (paste, typing, ?q= restore). Grow-only:
  // a manually dragged-larger box never snaps back while typing — the drag
  // handle still resizes both ways and double-click resets to the default
  // ocrView is a dep: a scan can set the text while the textarea is hidden
  // (zero scrollHeight) — re-measure when it comes back into view
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta || ta.scrollHeight <= ta.clientHeight) return
    // style.height is border-box; scrollHeight excludes the borders
    setTaHeight(Math.max(128, ta.scrollHeight + ta.offsetHeight - ta.clientHeight))
  }, [text, enText, dir, ocrView])
  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    const ta = taRef.current
    if (!ta) return
    e.preventDefault()
    const startY = e.clientY
    const startH = ta.offsetHeight
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => setTaHeight(Math.max(128, startH + ev.clientY - startY))
    const stop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  const onInput = (raw: string) => {
    setDictsWanted(true)
    if (dir === 'en') {
      const clean = stripNonEnglish(raw)
      setEnBlocked(clean.length !== raw.length)
      setEnText(clean.slice(0, EDIT_CEILING))
      return
    }
    const clean = stripNonJapanese(raw)
    setBlocked(clean.length !== raw.length)
    setText(clean.slice(0, EDIT_CEILING))
  }

  // inputs live in ?q=/?en= so the breakdowns survive navigating to a word's
  // detail page and coming back (and palette hand-offs auto-run). Functional
  // search updates keep the OTHER tab's committed sentence intact.
  const breakDown = () => {
    if (overLimit) return // over-cap text is edited down first, never committed
    if (dir === 'en') {
      const trimmed = enText.trim()
      if (trimmed) {
        // identical text → same ?en= → the effect wouldn't re-fire; when the
        // last translation failed, the click must mean "retry"
        if (trimmed === en && enToJa?.status === 'error') setEnAttempt((a) => a + 1)
        navigate({ search: (prev) => ({ ...prev, en: trimmed, dir: 'en' }), replace: true })
      }
      return
    }
    const trimmed = text.trim()
    if (trimmed) {
      if (trimmed === q && translation?.status === 'error') setJpAttempt((a) => a + 1)
      navigate({ search: (prev) => ({ ...prev, q: trimmed }), replace: true })
    }
  }

  const setDir = (d: 'ja' | 'en') => {
    if (d === dir) return
    navigate({
      search: (prev) => ({ ...prev, dir: d === 'en' ? 'en' : undefined }),
      replace: true,
    })
  }

  const enableSmart = () => {
    localStorage.setItem(SMART_KEY, '1')
    setManualFailed(false)
    setSmart(true) // re-runs the parse effects when a sentence is present
    // start the download right away — the user just approved it
    if (!tokenizerReady()) {
      setManualDownload({ done: 0, total: 12 })
      loadTokenizer((done, total) => setManualDownload({ done, total }))
        .then(() => setManualDownload(null))
        .catch(() => {
          setManualDownload(null)
          setManualFailed(true)
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

  // "Scan Image" (OCR) mirrors the Smart Parsing gating: a consent dialog
  // announces the download once, then the sticky key skips straight in.
  // It toggles the INPUT VIEW — the scan surface replaces the textarea
  // (never both at once), and neither side resets on a toggle: the panel
  // stays mounted (hidden) so an accidental flip loses no image, and the
  // typed text lives in route state regardless.
  const toggleOcr = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (ocrView) {
      setOcrView(false)
      return
    }
    ocrByKeyboard.current = e.detail === 0
    if (localStorage.getItem(OCR_KEY) !== null) {
      setOcrMounted(true)
      setOcrView(true)
    } else {
      setOcrConfirmOpen(true)
    }
  }
  const confirmOcr = () => {
    localStorage.setItem(OCR_KEY, '1')
    setOcrConfirmOpen(false)
    setOcrMounted(true)
    setOcrView(true)
  }
  // free the OCR worker's wasm heap when leaving the page — no-op unless
  // the lazy chunk actually loaded this visit
  useEffect(() => () => destroyOcrIfLoaded(), [])

  /**
   * OCR result hand-off. `clean` already passed the mode's cleaner; land it
   * in the active tab and break down immediately when it fits the cap —
   * committing before the dicts finish loading is safe, useBreakdown re-runs
   * when they arrive. Over the cap: the text stays editable, Break Down is
   * already blocked by overLimit, and the panel shows what happened.
   */
  const applyOcrText = (clean: string): OcrOutcome => {
    setDictsWanted(true)
    const capped = clean.slice(0, EDIT_CEILING)
    if (dir === 'en') {
      setEnBlocked(false)
      setEnText(capped)
    } else {
      setBlocked(false)
      setText(capped)
    }
    const outcome = ocrOutcome(capped, dir === 'en' ? EN_MAX_LEN : MAX_LEN)
    if (outcome === 'commit') {
      const trimmed = capped.trim()
      if (dir === 'en') {
        navigate({ search: (prev) => ({ ...prev, en: trimmed, dir: 'en' }), replace: true })
      } else {
        navigate({ search: (prev) => ({ ...prev, q: trimmed }), replace: true })
      }
    }
    // text landed → flip back to the text view so it's visible/editable;
    // on empty/error the scan surface stays up with its notice
    if (outcome !== 'empty') setOcrView(false)
    return outcome
  }

  const words = useMemo(() => (result ? uniqueWords(result.segments) : []), [result])

  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Sentence Parser</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a Japanese sentence — or, on the English tab, English text to
            machine-translate first — and break it down into the words it&apos;s
            built from — verbs (conjugated ones included), nouns, adjectives,
            adverbs, and more. Hover a highlighted word for a quick summary;
            click it for the full detail page.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm">
          <button
            type="button"
            onClick={() => setNoticeOpen((o) => !o)}
            aria-expanded={noticeOpen}
            className="flex w-full items-center gap-1.5 px-3.5 py-3 text-left font-medium text-amber-700 dark:text-amber-400"
          >
            <TriangleAlert className="size-4 shrink-0" /> Important Notice
            <ChevronDown
              className={cn(
                'ml-auto size-4 shrink-0 transition-transform duration-100',
                noticeOpen && 'rotate-180',
              )}
            />
          </button>
          {noticeOpen && (
            <ul className="list-disc space-y-1 pr-3.5 pb-3 pl-8 text-muted-foreground">
              <li>
                The default breakdown is heuristic dictionary matching, not a full
                grammar analyzer — incoherent sentences, typos, or unusual
                spellings will produce an inaccurate breakdown. Turning on{' '}
                <span className="font-medium">Smart Parsing</span> (a one-time
                ~17&nbsp;MB download) switches to a proper morphological analyzer,
                which is much better but still not infallible.
              </li>
              <li>
                The Japanese tab accepts <span lang="ja">かな</span>,{' '}
                <span lang="ja">漢字</span>, and numbers (<span lang="ja">3人</span>,{' '}
                <span lang="ja">２０時</span>). Romaji is not accepted — type{' '}
                <span lang="ja">たべた</span>, not &quot;tabeta&quot;.
              </li>
              <li>
                The <span className="font-medium">English → Japanese</span> tab
                accepts English only: the sentence is machine-translated to
                Japanese first, and the breakdown parses that generated
                Japanese. Incoherent, grammatically incorrect, or non-English
                input will yield an inaccurate translation and breakdown — this
                tool only parses; it never fixes input mistakes.
              </li>
              <li>
                Only JLPT-listed words are clickable in the default mode. With
                Smart Parsing, other dictionary words link too (marked{' '}
                <span className="font-medium">Beyond</span>), and anything not in
                the dictionary still shows its reading and part of speech on
                hover.
              </li>
            </ul>
          )}
        </div>

        <div className="space-y-2">
          {/* direction tabs: two independent features — each keeps its own
              input and result; switching never resets or transfers them */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Translation direction"
              className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-sm"
            >
              {(
                [
                  ['ja', 'Japanese → English'],
                  ['en', 'English → Japanese'],
                ] as const
              ).map(([d, label]) => (
                <button
                  key={d}
                  role="tab"
                  type="button"
                  aria-selected={dir === d}
                  onClick={() => setDir(d)}
                  className={cn(
                    'rounded-md px-3 py-1.5 transition-colors duration-100',
                    dir === d
                      ? 'bg-background font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* input-view toggle: typing ↔ scanning an image — it sits with
                the input controls, not among the parse actions, because it
                swaps WHAT the input area is rather than doing anything */}
            <Chip
              active={ocrView}
              onClick={toggleOcr}
              disabled={!OCR_SUPPORTED}
              title={
                OCR_SUPPORTED
                  ? ocrView
                    ? 'back to typing (the scanned image is kept)'
                    : 'scan text out of an image — on-device OCR (one-time ~3.5 MB download)'
                  : "this browser can't run the on-device OCR engine (WebAssembly required)"
              }
            >
              <span className="flex items-center gap-1">
                <ScanText className="size-3" /> Scan Image
              </span>
            </Chip>
          </div>
          {dir === 'en' && (
            <p className="text-xs text-muted-foreground">
              English input only — the sentence is machine-translated to Japanese,
              then broken down.
            </p>
          )}
          <div className={cn(ocrView && 'hidden')}>
            <textarea
              ref={taRef}
              value={activeText}
              onChange={(e) => onInput(e.target.value)}
              onFocus={() => setDictsWanted(true)}
              lang={dir === 'en' ? 'en' : 'ja'}
              rows={4}
              style={taHeight ? { height: `${taHeight}px` } : undefined}
              placeholder={
                dir === 'en'
                  ? 'The best part of traveling is, after all, eating the local specialties.'
                  : '旅行の楽しみは、何といってもやはり、その土地の名物料理を食べることだろう。'
              }
              className="min-h-32 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-lg outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <div
              onPointerDown={startResize}
              onDoubleClick={() => setTaHeight(null)}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize the sentence input"
              title="Drag to resize — double-click to reset"
              className="group flex h-4 w-full cursor-ns-resize touch-none items-center justify-center"
            >
              <div className="h-1 w-16 rounded-full bg-border transition-colors duration-100 group-hover:bg-muted-foreground/40" />
            </div>
          </div>
          {/* mounted once, then only hidden — a toggle never drops the
              scanned image, the warm engine, or an in-flight recognition */}
          {ocrMounted && (
            <div className={cn(!ocrView && 'hidden')}>
              <Suspense
                fallback={<div className="h-24 animate-pulse rounded-lg border bg-muted/30" />}
              >
                <OcrPanel
                  dir={dir}
                  visible={ocrView}
                  onText={applyOcrText}
                  onClose={() => setOcrView(false)}
                  animateIn={!ocrByKeyboard.current}
                />
              </Suspense>
            </div>
          )}
          <div
            className={cn('flex flex-wrap items-center justify-between gap-3', ocrView && 'hidden')}
          >
            <p className="text-xs text-muted-foreground">
              {dir === 'ja' && blocked && (
                <span className="text-destructive">
                  Non-Japanese characters were removed — kana, kanji, and numbers
                  only.{' '}
                </span>
              )}
              {dir === 'en' && enBlocked && (
                <span className="text-destructive">
                  Non-English characters were removed — this side accepts English
                  only.{' '}
                </span>
              )}
              <span className={overLimit ? 'font-medium text-destructive' : undefined}>
                {activeText.length}/{maxLen}
              </span>
              {overLimit && (
                <span className="text-destructive">
                  {' '}
                  — {activeText.length - maxLen} over the limit; shorten the text
                  to break it down
                </span>
              )}
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
              <Button
                onClick={breakDown}
                disabled={!dicts || !activeText.trim() || overLimit}
              >
                {dicts || !dictsWanted
                  ? dir === 'en'
                    ? 'Translate & Break Down'
                    : 'Break Down'
                  : 'Loading dictionary…'}
              </Button>
            </div>
          </div>
          {dir === 'en' && enToJa?.status === 'loading' && (
            <p className="text-xs text-muted-foreground">Translating to Japanese…</p>
          )}
          {dir === 'en' && enToJa?.status === 'error' && (
            <p className="text-xs text-destructive">
              The translation services couldn&apos;t produce Japanese —{' '}
              <button
                type="button"
                onClick={() => setEnAttempt((a) => a + 1)}
                className="cursor-pointer underline underline-offset-2"
              >
                try again
              </button>
              , or{' '}
              <a
                className="underline underline-offset-2"
                href={`https://translate.google.com/?sl=en&tl=ja&text=${encodeURIComponent(en ?? '')}&op=translate`}
                target="_blank"
                rel="noopener noreferrer"
              >
                open Google Translate
              </a>{' '}
              and paste the result into the Japanese tab.
            </p>
          )}
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

        {/* EN→JP: the generated Japanese is the sentence being parsed —
            shown above its breakdown with an honest provenance note */}
        {dir === 'en' && enToJa?.status === 'done' && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Japanese Translation</h2>
            <p lang="ja" className="rounded-lg border p-4 text-xl/relaxed">
              {enToJa.ja}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Machine translation via{' '}
              {enToJa.provider === 'google' ? 'Google Translate' : 'MyMemory'} — may be
              imperfect; the breakdown below parses this generated sentence.
              {enToJa.truncated && ` Trimmed to the parser's ${MAX_LEN}-character limit.`}
            </p>
          </section>
        )}

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

            {/* JP→EN only — in EN→JP mode the English is the user's input */}
            {dir === 'ja' && (
              <TranslationSection
                sentence={q ?? ''}
                state={translation}
                onRetry={() => setJpAttempt((a) => a + 1)}
              />
            )}

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
                // grid-cols-1 (minmax(0,1fr)): an implicit auto column grows past the
                // viewport when a row's single-line width exceeds it (long glosses)
                <div className="grid grid-cols-1 gap-1.5">
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

        <Dialog open={ocrConfirmOpen} onOpenChange={setOcrConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enable Image Scanning?</DialogTitle>
              <DialogDescription>
                This downloads the Tesseract OCR engine (~1.8&nbsp;MB) plus a
                recognition model for the active tab (Japanese ~1.5&nbsp;MB,
                English ~2&nbsp;MB) — one-time, cached by your browser
                afterwards. Scanning runs entirely on this device; your images
                never leave the browser. Works best on clear, horizontal
                printed text.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOcrConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmOcr}>Download &amp; Enable</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipPrimitive.Provider>
  )
}
