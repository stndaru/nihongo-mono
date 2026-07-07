import { describe, expect, it } from 'vitest'
import { accuracyOf, formBreakdown, wordStatus } from './analytics'
import { todayLocal } from './streak'
import {
  applySession,
  emptyProgress,
  mergeProgress,
  parseImported,
  type ProgressData,
  type VerbStat,
} from './store'

const today = todayLocal()

describe('applySession', () => {
  it('counts encounters, correct, and wrong per word', () => {
    const next = applySession(emptyProgress(), {
      answers: [
        { verbId: '1', correct: true },
        { verbId: '1', correct: false },
        { verbId: '2', correct: true },
      ],
      forms: [],
    })
    expect(next.verbs['1']).toMatchObject({ seen: 2, correct: 1, wrong: 1, lastSeen: today })
    expect(next.verbs['2']).toMatchObject({ seen: 1, correct: 1, wrong: 0 })
  })

  it('accumulates per-form stats when answers carry a form', () => {
    const first = applySession(emptyProgress(), {
      answers: [
        { verbId: '1', correct: true, form: 'te' },
        { verbId: '2', correct: false, form: 'te' },
        { verbId: '3', correct: true, form: 'past' },
      ],
      forms: ['te', 'past'],
    })
    const next = applySession(first, {
      answers: [{ verbId: '1', correct: false, form: 'te' }],
      forms: ['te'],
    })
    expect(next.forms.te).toEqual({ seen: 3, correct: 1 })
    expect(next.forms.past).toEqual({ seen: 1, correct: 1 })
    expect(next.forms.negative).toBeUndefined()
  })

  it('tracks the consecutive-correct run and resets it on a wrong answer', () => {
    let data = applySession(emptyProgress(), {
      answers: [
        { verbId: '1', correct: true },
        { verbId: '1', correct: true },
      ],
      forms: [],
    })
    expect(data.verbs['1'].run).toBe(2)
    data = applySession(data, { answers: [{ verbId: '1', correct: false }], forms: [] })
    expect(data.verbs['1'].run).toBe(0)
  })

  it('records the quiz kind and widens to "both" across pools', () => {
    let data = applySession(emptyProgress(), {
      answers: [{ verbId: '1', correct: true }],
      forms: [],
    })
    expect(data.verbs['1'].kind).toBe('verb')
    // vocab quiz with a dictionary-form verb keeps the per-answer override
    data = applySession(data, {
      answers: [
        { verbId: '1', correct: true, kind: 'verb' },
        { verbId: '2', correct: true },
      ],
      forms: [],
      kind: 'vocab',
    })
    expect(data.verbs['1'].kind).toBe('verb')
    expect(data.verbs['2'].kind).toBe('vocab')
    // the same id later hit from the other pool → both
    data = applySession(data, {
      answers: [{ verbId: '2', correct: true }],
      forms: [],
      kind: 'verb',
    })
    expect(data.verbs['2'].kind).toBe('both')
  })
})

describe('import migration', () => {
  it('accepts progress files exported before forms/kind/run existed', () => {
    const legacy = {
      version: 1,
      verbs: { '1': { seen: 3, correct: 2, wrong: 1, lastSeen: '2026-01-01' } },
      sessions: [{ date: '2026-01-01', total: 3, correct: 2, forms: ['te'] }],
      streak: { current: 1, best: 2, lastActiveDay: '2026-01-01' },
    }
    const data = parseImported(JSON.stringify(legacy))
    expect(data.forms).toEqual({})
    expect(data.verbs['1'].kind).toBeUndefined()
    // and a session can still be applied on top of it
    const next = applySession(data, {
      answers: [{ verbId: '1', correct: true, form: 'te' }],
      forms: ['te'],
    })
    expect(next.verbs['1']).toMatchObject({ seen: 4, correct: 3, kind: 'verb', run: 1 })
    expect(next.forms.te).toEqual({ seen: 1, correct: 1 })
  })
})

describe('mergeProgress', () => {
  const base = (verbs: Record<string, VerbStat>, forms: ProgressData['forms']): ProgressData => ({
    version: 1,
    verbs,
    sessions: [],
    streak: { current: 0, best: 0, lastActiveDay: null },
    forms,
  })

  it('sums word and form counts, keeps the newer run', () => {
    const a = base(
      { '1': { seen: 2, correct: 2, wrong: 0, lastSeen: '2026-01-02', kind: 'verb', run: 2 } },
      { te: { seen: 2, correct: 1 } },
    )
    const b = base(
      { '1': { seen: 3, correct: 1, wrong: 2, lastSeen: '2026-01-05', kind: 'vocab', run: 0 } },
      { te: { seen: 1, correct: 1 }, past: { seen: 4, correct: 4 } },
    )
    const merged = mergeProgress(a, b)
    expect(merged.verbs['1']).toEqual({
      seen: 5,
      correct: 3,
      wrong: 2,
      lastSeen: '2026-01-05',
      kind: 'both',
      run: 0,
    })
    expect(merged.forms.te).toEqual({ seen: 3, correct: 2 })
    expect(merged.forms.past).toEqual({ seen: 4, correct: 4 })
  })
})

describe('analytics', () => {
  const stat = (partial: Partial<VerbStat>): VerbStat => ({
    seen: 0,
    correct: 0,
    wrong: 0,
    lastSeen: today,
    ...partial,
  })

  it('computes accuracy', () => {
    expect(accuracyOf({ seen: 4, correct: 3 })).toBe(0.75)
    expect(accuracyOf({ seen: 0, correct: 0 })).toBe(0)
  })

  it('buckets word status', () => {
    expect(wordStatus(stat({ seen: 1, correct: 1, run: 1 }))).toBe('new')
    expect(wordStatus(stat({ seen: 4, correct: 2, wrong: 2 }))).toBe('weak')
    expect(wordStatus(stat({ seen: 4, correct: 4, run: 4 }))).toBe('solid')
    // accurate overall but just answered wrong → not solid yet
    expect(wordStatus(stat({ seen: 10, correct: 9, wrong: 1, run: 0 }))).toBe('learning')
    expect(wordStatus(stat({ seen: 3, correct: 2, wrong: 1 }))).toBe('learning')
  })

  it('lists practiced forms weakest first', () => {
    const data: ProgressData = {
      ...emptyProgress(),
      forms: {
        te: { seen: 4, correct: 4 },
        past: { seen: 4, correct: 1 },
        negative: { seen: 2, correct: 1 },
      },
    }
    expect(formBreakdown(data).map((r) => r.form)).toEqual(['past', 'negative', 'te'])
  })
})
