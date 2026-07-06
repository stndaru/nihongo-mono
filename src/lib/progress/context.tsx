import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  applySession,
  emptyProgress,
  loadProgress,
  saveProgress,
  type ProgressData,
  type SessionResultInput,
} from './store'

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

  const api = useMemo<ProgressApi>(
    () => ({
      progress,
      recordSession: (input) => update(applySession(loadProgress(), input)),
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
