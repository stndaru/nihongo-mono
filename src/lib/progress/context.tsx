import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { requestAutoSync } from '@/lib/sync/bootstrap'
import {
  applySession,
  emptyProgress,
  loadProgress,
  saveProgress,
  type ProgressData,
  type SessionResultInput,
} from './store'

/** Fired by the Drive sync engine after it writes merged data to
 *  localStorage — the provider re-reads instead of re-saving. Kept as a
 *  string literal here so listening doesn't pull in the sync chunk. */
const EXTERNAL_CHANGE_EVENT = 'nihongo-mono:progress-external-change'

interface ProgressApi {
  progress: ProgressData
  recordSession: (input: SessionResultInput) => void
  replaceProgress: (data: ProgressData) => void
  resetProgress: () => void
}

const ProgressContext = createContext<ProgressApi | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressData>(() => loadProgress())

  const update = useCallback((next: ProgressData) => {
    setProgress(next)
    saveProgress(next)
  }, [])

  // the sync engine writes merged remote data straight to localStorage
  // (it can't reach this state) — refresh from storage when it says so
  useEffect(() => {
    const refresh = () => setProgress(loadProgress())
    window.addEventListener(EXTERNAL_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(EXTERNAL_CHANGE_EVENT, refresh)
  }, [])

  const api = useMemo<ProgressApi>(
    () => ({
      progress,
      recordSession: (input) => {
        update(applySession(loadProgress(), input))
        // fire-and-forget Drive sync (no-op unless the user linked Drive);
        // the local save above already happened, so nothing can be lost
        requestAutoSync()
      },
      replaceProgress: update,
      resetProgress: () => update(emptyProgress()),
    }),
    [progress, update],
  )

  return <ProgressContext.Provider value={api}>{children}</ProgressContext.Provider>
}

export function useProgress(): ProgressApi {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used inside <ProgressProvider>')
  return ctx
}
