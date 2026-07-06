export interface StreakData {
  current: number
  best: number
  /** YYYY-MM-DD in local time; null before the first session */
  lastActiveDay: string | null
}

export function todayLocal(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return todayLocal(new Date(y, m - 1, d - 1))
}

/**
 * Called when a session completes. Same day: unchanged; yesterday: extend;
 * anything older (or first ever): restart at 1. Write-time only — the streak
 * is never decremented by merely opening the app.
 */
export function bumpStreak(streak: StreakData, today = todayLocal()): StreakData {
  if (streak.lastActiveDay === today) return streak
  const current = streak.lastActiveDay === dayBefore(today) ? streak.current + 1 : 1
  return { current, best: Math.max(streak.best, current), lastActiveDay: today }
}

/** True when the streak will reset unless the user studies today. */
export function streakAtRisk(streak: StreakData, today = todayLocal()): boolean {
  return streak.current > 0 && streak.lastActiveDay !== null && streak.lastActiveDay !== today
}

/** True when the streak is already broken (last activity before yesterday). */
export function streakBroken(streak: StreakData, today = todayLocal()): boolean {
  return (
    streak.lastActiveDay !== null &&
    streak.lastActiveDay !== today &&
    streak.lastActiveDay !== dayBefore(today)
  )
}
