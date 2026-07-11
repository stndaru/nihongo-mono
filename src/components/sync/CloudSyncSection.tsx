/**
 * Settings → "Cloud sync": the primary surface for the Google Drive link
 * (decision 70). The section renders only when an OAuth client id is
 * configured, and the sync engine (plus Google's script) loads on demand
 * inside the click handlers — visiting Settings alone fetches nothing.
 */
import { useState } from 'react'
import { Cloud, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { loadSyncMeta } from '@/lib/sync/meta'
import { syncConfigured } from '@/lib/sync/gis-loader'
import { useSyncStatus } from '@/lib/sync/status-store'
import type { RemoteSummary, SyncEngine } from '@/lib/sync/engine'

const engine = () => import('@/lib/sync/engine').then((m) => m.getEngine())

export function CloudSyncSection() {
  const status = useSyncStatus()
  const [connectOpen, setConnectOpen] = useState(false)
  const [decision, setDecision] = useState<RemoteSummary | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetChecked, setResetChecked] = useState(false)
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  if (!syncConfigured()) return null

  const linked = loadSyncMeta() !== null
  const busy = status.phase === 'connecting' || status.phase === 'syncing'

  const run = async (fn: (e: SyncEngine) => Promise<void>) => {
    setNote(null)
    try {
      await fn(await engine())
    } catch (err) {
      setNote({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong.',
      })
    }
  }

  const startConnect = () =>
    run(async (e) => {
      setConnectOpen(false)
      const result = await e.connect()
      if (result.outcome === 'decision') setDecision(result.remote)
      else setNote({ kind: 'ok', text: 'Connected — your progress is synced to Drive.' })
    })

  const openDecision = () =>
    run(async (e) => {
      setDecision(await e.remoteSummary())
    })

  const useDrive = () =>
    run(async (e) => {
      setDecision(null)
      await e.decideUse()
      setNote({ kind: 'ok', text: 'Drive progress merged into this browser.' })
    })

  const confirmReset = () =>
    run(async (e) => {
      setResetConfirm(false)
      setResetChecked(false)
      setDecision(null)
      await e.decideReset()
      setNote({ kind: 'ok', text: 'Started fresh — Drive now holds this browser’s progress.' })
    })

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Cloud sync</h2>
      <p className="text-xs text-pretty text-muted-foreground">
        Optionally keep your progress in your own Google Drive and continue on
        any device. Syncs automatically after each quiz.
      </p>

      <StatusLine />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!linked && (
          <Button variant="outline" onClick={() => setConnectOpen(true)}>
            <Cloud /> Connect Google Drive
          </Button>
        )}
        {linked && status.phase === 'pending-decision' && (
          <Button onClick={openDecision} disabled={busy}>
            Review Drive Progress…
          </Button>
        )}
        {linked && status.phase === 'needs-reauth' && (
          <Button onClick={() => run((e) => e.manualSync())}>Sign in to Google</Button>
        )}
        {linked && status.phase === 'error' && status.kind === 'remote-invalid' && (
          <Button variant="outline" onClick={() => run((e) => e.overwriteRemote())}>
            Overwrite Drive Copy
          </Button>
        )}
        {linked && status.phase !== 'pending-decision' && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run((e) => e.manualSync())}
          >
            <RefreshCw className={busy ? 'motion-safe:animate-spin' : undefined} /> Sync Now
          </Button>
        )}
        {linked && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              run(async (e) => {
                await e.disconnect()
                setNote({
                  kind: 'ok',
                  text: 'Disconnected. Your progress stays in this browser and in Drive.',
                })
              })
            }
          >
            Disconnect
          </Button>
        )}
      </div>

      {note && (
        <p className={note.kind === 'ok' ? 'text-xs text-success' : 'text-xs text-destructive'}>
          {note.text}
        </p>
      )}

      {/* consent — the one feature where data leaves the browser, so the
          dialog says exactly where it goes and what the app can touch */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <Cloud className="size-4 text-primary" />
              </span>
              Sync Progress with Google Drive?
            </DialogTitle>
            <DialogDescription>
              Continue your streak and stats on any device by keeping them in
              your own Google Drive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <p>
              A small progress file (a few KB) is saved to a{' '}
              <span className="font-medium">“Nihongo Mono” folder</span> in your
              Drive and updated after each quiz session.
            </p>
            <p className="text-muted-foreground">
              The app can only access files it created itself — never the rest
              of your Drive.
            </p>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            Sign-in happens directly between your browser and Google. nihongo
            mono has no server and never sees your data or your account.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startConnect}>
              <Cloud /> Sign in with Google
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* second browser: progress already in Drive — Use or Start Fresh.
          Closing without choosing keeps sync OFF until a choice is made. */}
      <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Progress Found in Drive</DialogTitle>
            <DialogDescription>
              Your Google Drive already holds nihongo mono progress:{' '}
              <span className="font-medium text-foreground">
                {decision?.verbs ?? 0} practiced words
              </span>{' '}
              across{' '}
              <span className="font-medium text-foreground">
                {decision?.sessions ?? 0} sessions
              </span>
              . Choose how this browser should continue — nothing syncs until
              you decide.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-pretty text-muted-foreground">
            “Use Drive progress” adds those stats to this browser’s — nothing
            is lost. “Start fresh” replaces the Drive copy with this browser’s
            current progress instead.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setResetConfirm(true)}
            >
              Start Fresh…
            </Button>
            <Button onClick={useDrive}>Use Drive Progress</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* misclick-proof reset: the destructive action stays disabled until
          the consequence is explicitly acknowledged */}
      <Dialog
        open={resetConfirm}
        onOpenChange={(o) => {
          setResetConfirm(o)
          if (!o) setResetChecked(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace Drive Progress?</DialogTitle>
            <DialogDescription>
              The progress stored in Google Drive will be permanently replaced
              with this browser’s current progress. The Drive copy cannot be
              recovered afterwards.
            </DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox
              checked={resetChecked}
              onCheckedChange={(v) => setResetChecked(v === true)}
              className="mt-0.5"
            />
            I understand the progress in Google Drive will be permanently
            replaced
          </label>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetConfirm(false)
                setResetChecked(false)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={!resetChecked} onClick={confirmReset}>
              Replace Drive Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/** The always-current one-line answer to "is my progress safe in Drive?" */
function StatusLine() {
  const status = useSyncStatus()
  const line = (text: string, tone: 'muted' | 'destructive' = 'muted') => (
    <p className={tone === 'muted' ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
      {text}
    </p>
  )
  switch (status.phase) {
    case 'disconnected':
      return line('Not connected.')
    case 'connecting':
      return line('Connecting to Google…')
    case 'syncing':
      return line('Syncing…')
    case 'synced':
      return line(
        status.lastSyncedAt
          ? `Synced — last sync ${new Date(status.lastSyncedAt).toLocaleString()}`
          : 'Synced.',
      )
    case 'pending-decision':
      return line('Connected, but not syncing yet — review the progress found in Drive first.')
    case 'needs-reauth':
      return line('Sign in to Google to resume sync. Your progress is safe in this browser.')
    case 'error':
      switch (status.kind) {
        case 'rate-limit':
          return line('Sync pending — Google is rate-limiting requests; it will retry.')
        case 'storage-quota':
          return line('Google Drive is out of storage — free some space to resume sync.', 'destructive')
        case 'offline':
          return line('Offline — sync resumes when the connection returns.')
        case 'remote-invalid':
          return line('The Drive copy is unreadable — overwrite it with this browser’s progress to resume.', 'destructive')
        default:
          return line('Sync failed — it will retry after the next quiz, or use Sync Now.', 'destructive')
      }
  }
}
