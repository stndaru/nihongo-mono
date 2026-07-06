import { describe, expect, it } from 'vitest'
import { bumpStreak, streakAtRisk, streakBroken } from './streak'

const fresh = { current: 0, best: 0, lastActiveDay: null }

describe('bumpStreak', () => {
  it('starts at 1 on the first session', () => {
    expect(bumpStreak(fresh, '2026-07-07')).toEqual({
      current: 1,
      best: 1,
      lastActiveDay: '2026-07-07',
    })
  })

  it('is a no-op for a second session the same day', () => {
    const s = { current: 3, best: 5, lastActiveDay: '2026-07-07' }
    expect(bumpStreak(s, '2026-07-07')).toBe(s)
  })

  it('extends when the last session was yesterday', () => {
    expect(
      bumpStreak({ current: 3, best: 3, lastActiveDay: '2026-07-06' }, '2026-07-07'),
    ).toEqual({ current: 4, best: 4, lastActiveDay: '2026-07-07' })
  })

  it('handles month boundaries', () => {
    expect(
      bumpStreak({ current: 1, best: 9, lastActiveDay: '2026-06-30' }, '2026-07-01').current,
    ).toBe(2)
  })

  it('resets to 1 after a gap, keeping best', () => {
    expect(
      bumpStreak({ current: 7, best: 7, lastActiveDay: '2026-07-01' }, '2026-07-07'),
    ).toEqual({ current: 1, best: 7, lastActiveDay: '2026-07-07' })
  })
})

describe('streak status', () => {
  it('at risk when last activity was before today', () => {
    expect(streakAtRisk({ current: 3, best: 3, lastActiveDay: '2026-07-06' }, '2026-07-07')).toBe(true)
    expect(streakAtRisk({ current: 3, best: 3, lastActiveDay: '2026-07-07' }, '2026-07-07')).toBe(false)
    expect(streakAtRisk(fresh, '2026-07-07')).toBe(false)
  })

  it('broken when last activity was before yesterday', () => {
    expect(streakBroken({ current: 3, best: 3, lastActiveDay: '2026-07-05' }, '2026-07-07')).toBe(true)
    expect(streakBroken({ current: 3, best: 3, lastActiveDay: '2026-07-06' }, '2026-07-07')).toBe(false)
  })
})
