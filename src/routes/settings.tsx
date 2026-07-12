import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { OfflineSection } from '@/components/offline/OfflineSection'
import { CloudSyncSection } from '@/components/sync/CloudSyncSection'
import { Button } from '@/components/ui/button'
import { Chip, ChipGroup } from '@/components/ui/chip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProgress } from '@/lib/progress/context'
import { mergeProgress, parseImported, type ProgressData } from '@/lib/progress/store'
import { downloadProgress, progressFileName, readFileText } from '@/lib/progress/transfer'
import {
  FONT_SIZES,
  getFontPref,
  getFontSizePref,
  getTheme,
  setFontPref,
  setFontSizePref,
  setTheme,
  type FontChoice,
  type FontSize,
  type FontSizeKind,
  type Theme,
} from '@/lib/theme'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { progress, replaceProgress, resetProgress } = useProgress()
  const [theme, setThemeState] = useState<Theme>(() => getTheme())
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<ProgressData | null>(null)
  const [confirmExport, setConfirmExport] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const pickTheme = (t: Theme) => {
    setTheme(t)
    setThemeState(t)
  }

  const [fontJa, setFontJa] = useState<FontChoice>(() => getFontPref('ja'))
  const [fontText, setFontText] = useState<FontChoice>(() => getFontPref('text'))
  const pickFont = (kind: 'ja' | 'text', choice: FontChoice) => {
    setFontPref(kind, choice)
    if (kind === 'ja') setFontJa(choice)
    else setFontText(choice)
  }

  const [fontSizes, setFontSizesState] = useState<Record<FontSizeKind, FontSize>>(() => ({
    global: getFontSizePref('global'),
    ja: getFontSizePref('ja'),
    furigana: getFontSizePref('furigana'),
  }))
  const pickFontSize = (kind: FontSizeKind, size: FontSize) => {
    setFontSizePref(kind, size)
    setFontSizesState((s) => ({ ...s, [kind]: size }))
  }
  const sizeGroups: { kind: FontSizeKind; label: string }[] = [
    { kind: 'global', label: 'Global font size' },
    { kind: 'ja', label: 'Kanji/kana font size' },
    { kind: 'furigana', label: 'Furigana font size' },
  ]

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    try {
      setPendingImport(parseImported(await readFileText(file)))
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Import failed.' })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const applyImport = (mode: 'replace' | 'merge') => {
    if (!pendingImport) return
    replaceProgress(
      mode === 'replace' ? pendingImport : mergeProgress(progress, pendingImport),
    )
    setPendingImport(null)
    setMessage({ kind: 'ok', text: 'Progress imported.' })
  }

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Theme</h2>
        <ChipGroup label="">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <Chip key={t} active={theme === t} onClick={() => pickTheme(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </Chip>
          ))}
        </ChipGroup>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Typography</h2>
        <div className="space-y-2">
          <ChipGroup label="Japanese characters">
            {(['serif', 'sans'] as const).map((c) => (
              <Chip key={c} active={fontJa === c} onClick={() => pickFont('ja', c)}>
                {c === 'serif' ? 'Serif (明朝)' : 'Sans-serif (ゴシック)'}
              </Chip>
            ))}
          </ChipGroup>
          <ChipGroup label="Text content">
            {(['serif', 'sans'] as const).map((c) => (
              <Chip key={c} active={fontText === c} onClick={() => pickFont('text', c)}>
                {c === 'serif' ? 'Serif' : 'Sans-serif'}
              </Chip>
            ))}
          </ChipGroup>
          {sizeGroups.map(({ kind, label }) => (
            <ChipGroup key={kind} label={label}>
              {FONT_SIZES.map(({ value, label: sizeLabel }) => (
                <Chip
                  key={value}
                  active={fontSizes[kind] === value}
                  onClick={() => pickFontSize(kind, value)}
                >
                  {sizeLabel}
                </Chip>
              ))}
            </ChipGroup>
          ))}
        </div>
        <p className="text-lg">
          <span lang="ja">
            <ruby>
              食<rt>た</rt>
            </ruby>
            べる・たべる
          </span>
          <span className="text-muted-foreground">
            {' '}
            — The quick brown fox jumps over the lazy dog
          </span>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Progress data</h2>
        <p className="text-xs text-muted-foreground">
          Your streak, accuracy, and per-verb stats are stored in this
          browser. Export them as a file to move them by hand, or connect
          Google Drive below to sync across devices.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" onClick={() => setConfirmExport(true)}>
            Export Progress…
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Import Progress…
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
        {message && (
          <p
            className={
              message.kind === 'ok' ? 'text-xs text-success' : 'text-xs text-destructive'
            }
          >
            {message.text}
          </p>
        )}
      </section>

      <CloudSyncSection />

      <OfflineSection />

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Danger zone</h2>
        <Button variant="destructive" onClick={() => setConfirmReset(true)}>
          Reset All Progress
        </Button>
      </section>

      {/* export: confirm before the file download starts */}
      <Dialog open={confirmExport} onOpenChange={setConfirmExport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download Progress File?</DialogTitle>
            <DialogDescription>
              Saves your streak, accuracy, and per-word stats —{' '}
              {Object.keys(progress.verbs).length} practiced words across{' '}
              {progress.sessions.length} sessions — to your device as{' '}
              <span className="font-medium text-foreground">{progressFileName()}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmExport(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                downloadProgress(progress)
                setConfirmExport(false)
                setMessage({ kind: 'ok', text: 'Progress file downloaded.' })
              }}
            >
              Download File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* import: replace or merge */}
      <Dialog open={pendingImport !== null} onOpenChange={(o) => !o && setPendingImport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import progress</DialogTitle>
            <DialogDescription>
              The file contains {Object.keys(pendingImport?.verbs ?? {}).length} practiced
              verbs and {pendingImport?.sessions.length ?? 0} sessions. Merge adds its
              counts to this browser&apos;s stats; replace overwrites them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => applyImport('merge')}>
              Merge
            </Button>
            <Button onClick={() => applyImport('replace')}>Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* reset confirm */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset All Progress?</DialogTitle>
            <DialogDescription>
              This deletes your streak, accuracy, and per-verb stats from this browser.
              It cannot be undone — consider exporting first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetProgress()
                setConfirmReset(false)
                setMessage({ kind: 'ok', text: 'Progress reset.' })
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
