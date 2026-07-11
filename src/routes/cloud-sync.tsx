/**
 * The Drive sync explainer + privacy/consent page (decision 70). Linked
 * from the connect dialog BEFORE the user consents, from Settings, and
 * from About — and it doubles as the privacy-policy URL the Google OAuth
 * consent screen asks for. Plain-language first, legal notes at the end.
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, Cloud, FolderClosed, ShieldCheck } from 'lucide-react'
import { FILE_NAME, FOLDER_NAME } from '@/lib/sync/constants'

export const Route = createFileRoute('/cloud-sync')({
  component: CloudSyncPage,
})

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

function CloudSyncPage() {
  return (
    <div className="max-w-2xl">
      <Link
        to="/settings"
        className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Settings
      </Link>
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Cloud className="size-6 text-primary" /> Cloud Sync — How It Works &
        Privacy
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Cloud sync is an <span className="font-medium text-foreground">optional</span>,
        off-by-default feature that stores your quiz progress in{' '}
        <span className="font-medium text-foreground">your own Google Drive</span> so
        you can continue on another browser or device. Until you connect it,
        nothing about your study data ever leaves this browser. This page is
        the full explanation of what connecting does — it is also the privacy
        notice you are consenting to when you click “Sign in with Google”.
      </p>

      <Section title="How syncing works">
        <p>
          When you connect, you sign in with Google in a popup that goes
          directly from your browser to Google. The app then creates a folder
          in your Drive and keeps one small file in it (a few kilobytes of
          quiz statistics). After that, syncing is automatic: every time you
          finish a quiz session, and once each time you open the app, the
          file is updated in the background. You can also sync manually from
          Settings.
        </p>
        <p>
          Syncing merges rather than overwrites: the app downloads the Drive
          copy, combines it with this browser&apos;s progress, and uploads the
          result — so practicing on two devices adds up instead of one
          erasing the other. When you connect a browser that already has a
          different history, you are asked first whether to use the Drive
          copy or start fresh; nothing syncs until you choose.
        </p>
      </Section>

      <Section title="Where your data lives in Drive">
        <p className="flex items-center gap-2">
          <FolderClosed className="size-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium text-foreground">
              My Drive › {FOLDER_NAME} › {FILE_NAME}
            </span>{' '}
            — a normal, visible folder that belongs to you.
          </span>
        </p>
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>
            <span className="font-medium text-foreground">
              Please don&apos;t move, rename, edit, or delete this folder or
              file.
            </span>{' '}
            The app finds your progress by that folder and file — tampering
            with them can make syncing fail or cause progress to be replaced
            or lost. If the file is deleted, the app recreates it from the
            current browser&apos;s progress on the next sync, which may not be
            the copy you wanted to keep.
          </span>
        </p>
      </Section>

      <Section title="What the app can and cannot access">
        <p>
          The app requests Google&apos;s narrowest Drive permission
          (<span className="font-medium text-foreground">drive.file</span>): it can
          only see and change{' '}
          <span className="font-medium text-foreground">
            files it created itself
          </span>{' '}
          — never your other Drive files, and it does not request your email
          address or profile. The sign-in token stays inside this browser
          only (so refreshes and restarts keep you signed in): it is never
          shared with other sites, expires within an hour on Google&apos;s
          side, and is revoked when you disconnect. After 24 hours without
          any syncing you are signed out automatically and asked to sign in
          again.
        </p>
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            Everything happens between your browser and Google. nihongo mono
            has no server and no database — it cannot see, collect, store,
            sell, or process your data, your identity, or your Google
            account. There is nothing on our side to breach.
          </span>
        </p>
      </Section>

      <Section title="What data is synced">
        <p>
          Quiz statistics only: per-word answer counts, per-conjugation-form
          tallies, your recent session results (up to 100), and your streak.
          No personal information, no names, no free-form text, and no
          information about your Google account is ever written to the file.
        </p>
      </Section>

      <Section title="Your controls">
        <p>
          <span className="font-medium text-foreground">Disconnect</span> anytime in{' '}
          <Link to="/settings" className="text-primary underline-offset-2 hover:underline">
            Settings
          </Link>{' '}
          — the link is removed and the app&apos;s access token revoked; your
          progress stays in this browser and in your Drive. To remove the
          app&apos;s access from Google&apos;s side entirely, visit{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            myaccount.google.com/permissions
          </a>
          . You may delete the {FOLDER_NAME} folder from Drive whenever you
          want (after disconnecting, to avoid it being recreated). Settings
          also offers file export/import, which works with or without cloud
          sync — keeping an exported backup is always a good idea.
        </p>
      </Section>

      <Section title="Disclaimers & legal notes">
        <p>
          This feature — like the rest of nihongo mono — is free, open-source
          software provided{' '}
          <span className="font-medium text-foreground">
            “as is” and “as available”, without warranty of any kind
          </span>
          , express or implied, including but not limited to fitness for a
          particular purpose and non-infringement. To the maximum extent
          permitted by applicable law, the authors and contributors accept no
          liability for any loss of data, loss of progress, or any direct,
          indirect, incidental, or consequential damages arising from use of
          the sync feature. Please keep exported backups of progress you care
          about.
        </p>
        <p>
          Google Drive and Google sign-in are services of Google LLC and are
          governed by{' '}
          <a
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Google&apos;s Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Privacy Policy
          </a>
          . nihongo mono is an independent project and is not affiliated
          with, sponsored, or endorsed by Google. You are responsible for
          your own Google account, its security, and your Drive storage
          quota; Google may change or limit its services independently of
          this app.
        </p>
        <p>
          The sync code is open source (MIT licence) and can be audited in
          the{' '}
          <a
            href="https://github.com/stndaru/nihongo-mono/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            repository
          </a>
          . This page describes the feature&apos;s current behavior; if the
          behavior changes materially, this page will be updated to match.
          Data-source licences and credits are on the{' '}
          <Link to="/about" className="text-primary underline-offset-2 hover:underline">
            About page
          </Link>
          .
        </p>
      </Section>
    </div>
  )
}
