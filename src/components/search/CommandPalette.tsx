import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { BookOpen, ScanText, Search } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { Furigana } from '@/components/verbs/Furigana'
import { SEARCH_DEBOUNCE_MS } from '@/components/verbs/SearchBox'
import { LevelBadge } from '@/components/verbs/VerbBadges'
import { POS_LABELS } from '@/components/vocab/PosBadge'
import { searchVerbRows, searchVocabRows } from '@/lib/data/ext-search'
import {
  loadVerbExtIndex,
  loadVerbLevels,
  loadVocabExtIndex,
  loadVocabLevels,
} from '@/lib/data/loader'
import { isJapaneseOnly } from '@/lib/data/parse-sentence'
import { searchWordsScored } from '@/lib/data/search'
import type {
  VerbEntry,
  VerbIndexRow,
  VocabEntry,
  VocabIndexRow,
} from '@/lib/data/types'
import { cn } from '@/lib/utils'

type Hit =
  | { kind: 'verb'; word: VerbEntry; score: number }
  | { kind: 'vocab'; word: VocabEntry; score: number }

const LIMIT = 20
const EXT_LIMIT = 8
const ALL_LEVELS = [5, 4, 3, 2, 1] as const

/** Dispatch this window event to open the palette (mobile floating button). */
export const OPEN_PALETTE_EVENT = 'nihongo-mono:open-palette'

/**
 * Quick-access search (Ctrl/Cmd+K): one input over all JLPT verbs and
 * vocabulary, each hit labeled with its type, Enter/click opens the detail
 * page. The full-dictionary indexes join in only on demand — they're a
 * multi-MB download, so the default palette stays instant and light.
 */
export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const [words, setWords] = useState<{ verbs: VerbEntry[]; vocab: VocabEntry[] } | null>(null)
  const [ext, setExt] = useState<{ verbs: VerbIndexRow[]; vocab: VocabIndexRow[] } | null>(null)
  const [extLoading, setExtLoading] = useState(false)

  const isMac = useMemo(() => navigator.userAgent.includes('Mac'), [])

  // global shortcut + the mobile floating button's open event
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (isMac ? e.metaKey : e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
    }
  }, [isMac])

  // JLPT tiers load on first open (module-cached afterwards)
  useEffect(() => {
    if (!open || words) return
    let alive = true
    Promise.all([loadVerbLevels(ALL_LEVELS), loadVocabLevels(ALL_LEVELS)]).then(
      ([verbs, vocab]) => {
        if (alive) setWords({ verbs, vocab })
      },
    )
    return () => {
      alive = false
    }
  }, [open, words])

  useEffect(() => {
    // shared debounce + non-urgent update — keeps keystrokes responsive
    // while the result list re-renders (see SEARCH_DEBOUNCE_MS)
    const t = setTimeout(() => startTransition(() => setDebounced(query)), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const hits = useMemo((): Hit[] | null => {
    if (!words) return null
    const q = debounced.trim()
    if (!q) return []
    const merged: Hit[] = [
      ...searchWordsScored(words.verbs, q).map(
        (s): Hit => ({ kind: 'verb', word: s.word, score: s.score }),
      ),
      ...searchWordsScored(words.vocab, q).map(
        (s): Hit => ({ kind: 'vocab', word: s.word, score: s.score }),
      ),
    ]
    merged.sort(
      (a, b) => a.score - b.score || Number(b.word.common) - Number(a.word.common),
    )
    let top = merged.slice(0, LIMIT)
    if (ext) {
      top = [
        ...top,
        ...searchVerbRows(ext.verbs, q, {}, EXT_LIMIT).entries.map(
          (word): Hit => ({ kind: 'verb', word, score: 9 }),
        ),
        ...searchVocabRows(ext.vocab, q, {}, EXT_LIMIT).entries.map(
          (word): Hit => ({ kind: 'vocab', word, score: 9 }),
        ),
      ]
    }
    return top
  }, [words, ext, debounced])

  useEffect(() => setActive(0), [hits?.length, debounced])

  const openHit = (hit: Hit) => {
    setOpen(false)
    setQuery('')
    if (hit.kind === 'verb') {
      navigate({ to: '/verbs/$verbId', params: { verbId: hit.word.id } })
    } else {
      navigate({ to: '/vocab/$wordId', params: { wordId: hit.word.id } })
    }
  }

  const loadFullDictionary = () => {
    if (ext || extLoading) return
    setExtLoading(true)
    Promise.all([loadVerbExtIndex(), loadVocabExtIndex()])
      .then(([verbs, vocab]) => setExt({ verbs, vocab }))
      .finally(() => setExtLoading(false))
  }

  const onInputKey = (e: React.KeyboardEvent) => {
    if (!hits || hits.length === 0) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = e.key === 'ArrowDown' ? active + 1 : active - 1
      const clamped = Math.max(0, Math.min(hits.length - 1, next))
      setActive(clamped)
      listRef.current?.children[clamped]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault()
      openHit(hits[active])
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 px-2 font-normal text-muted-foreground sm:pr-1.5"
          aria-label="Search everything"
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border bg-muted px-1 py-px font-sans text-[10px] sm:inline">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[12%] left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border bg-background shadow-lg duration-150 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Search words — kanji, kana, romaji, English, or a conjugated form…"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
            {!query.trim() ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Try “taberu”, “tabeta”, 食べた, or “eat”.
              </p>
            ) : hits === null ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : hits.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                <p>No matches{ext ? '' : ' among JLPT words'}.</p>
                {/* a whole sentence isn't a dictionary lookup — offer the
                    parser, but only for pure-Japanese input (romaji or mixed
                    text would mess with the breakdown) */}
                {isJapaneseOnly(debounced.trim()) && debounced.trim().length <= 100 && (
                  <button
                    type="button"
                    onClick={() => {
                      const q = debounced.trim()
                      setOpen(false)
                      setQuery('')
                      navigate({ to: '/parser', search: { q } })
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
                  >
                    <ScanText className="size-4" /> Break Down as Sentence
                  </button>
                )}
              </div>
            ) : (
              hits.map((hit, i) => (
                <button
                  key={`${hit.kind}:${hit.word.id}`}
                  type="button"
                  onClick={() => openHit(hit)}
                  onMouseMove={() => setActive(i)}
                  className={cn(
                    'flex w-full items-baseline gap-2.5 rounded-md px-2.5 py-2 text-left',
                    i === active && 'bg-muted',
                  )}
                >
                  <Furigana segments={hit.word.furigana} className="shrink-0 text-base" />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {hit.word.gloss[0]}
                  </span>
                  <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
                    {hit.kind === 'verb' ? 'Verb' : POS_LABELS[hit.word.pos]}
                  </span>
                  <LevelBadge level={hit.word.jlpt} className="shrink-0" />
                </button>
              ))
            )}
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>↑↓ to navigate · Enter to open</span>
            {!ext && (
              <button
                type="button"
                onClick={loadFullDictionary}
                className="flex items-center gap-1 text-primary underline-offset-2 hover:underline disabled:opacity-60"
                disabled={extLoading}
              >
                <BookOpen className="size-3.5" />
                {extLoading ? 'Loading full dictionary…' : 'Include Full Dictionary'}
              </button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
