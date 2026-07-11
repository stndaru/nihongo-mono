/**
 * Three-way reconciliation for continuous sync. `mergeProgress` (the
 * import merge) is ADDITIVE — union-ing two independent histories once.
 * Repeated syncs can't use it: local and remote share almost all history,
 * and adding them would double every counter on every sync.
 *
 * Instead each successful sync stores the merged state as the BASE
 * snapshot, and the next sync computes: result = remote + (local − base).
 * Counters get the local delta added onto the remote value; sessions get
 * local additions appended; anchoring on remote means a "start fresh"
 * reset made on another device propagates instead of resurrecting.
 */
import { SESSION_CAP, type ProgressData } from '@/lib/progress/store'

type VerbStat = ProgressData['verbs'][string]

const delta = (local: number, base: number) => Math.max(0, local - base)

function mergeKind(
  a: VerbStat['kind'],
  b: VerbStat['kind'],
): VerbStat['kind'] {
  if (!a) return b
  if (!b) return a
  return a === b ? a : 'both'
}

export function merge3(
  base: ProgressData,
  local: ProgressData,
  remote: ProgressData,
): ProgressData {
  // verbs: remote value + what this device added since the last sync
  const verbs: ProgressData['verbs'] = {}
  for (const id of new Set([...Object.keys(local.verbs), ...Object.keys(remote.verbs)])) {
    const l = local.verbs[id]
    const r = remote.verbs[id]
    const b = base.verbs[id]
    if (!l) {
      verbs[id] = r! // remote-only (another device learned it)
      continue
    }
    if (!r) {
      // missing remotely: either brand-new here, or deleted remotely (a
      // reset elsewhere). Keep only what THIS device did since base.
      const localDelta: VerbStat = b
        ? {
            seen: delta(l.seen, b.seen),
            correct: delta(l.correct, b.correct),
            wrong: delta(l.wrong, b.wrong),
            lastSeen: l.lastSeen,
            kind: l.kind,
            run: l.run,
          }
        : l
      if (localDelta.seen > 0) verbs[id] = localDelta
      continue
    }
    const bSeen = b?.seen ?? 0
    const newer = l.lastSeen >= r.lastSeen ? l : r
    verbs[id] = {
      seen: r.seen + delta(l.seen, bSeen),
      correct: r.correct + delta(l.correct, b?.correct ?? 0),
      wrong: r.wrong + delta(l.wrong, b?.wrong ?? 0),
      lastSeen: newer.lastSeen,
      kind: mergeKind(l.kind, r.kind),
      run: newer.run,
    }
  }

  // forms: same counter reconciliation
  const forms: ProgressData['forms'] = {}
  const formKeys = new Set([
    ...Object.keys(local.forms),
    ...Object.keys(remote.forms),
  ]) as Set<keyof ProgressData['forms']>
  for (const form of formKeys) {
    const l = local.forms[form]
    const r = remote.forms[form]
    const b = base.forms[form]
    if (!l) {
      forms[form] = r
      continue
    }
    if (!r) {
      const seen = b ? delta(l.seen, b.seen) : l.seen
      if (seen > 0) forms[form] = { seen, correct: b ? delta(l.correct, b.correct) : l.correct }
      continue
    }
    forms[form] = {
      seen: r.seen + delta(l.seen, b?.seen ?? 0),
      correct: r.correct + delta(l.correct, b?.correct ?? 0),
    }
  }

  // sessions: remote list + local records added since base (multiset diff —
  // two identical sessions on one day are legitimately distinct records)
  const counts = new Map<string, number>()
  for (const s of base.sessions) {
    const k = JSON.stringify(s)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const localNew = local.sessions.filter((s) => {
    const k = JSON.stringify(s)
    const n = counts.get(k) ?? 0
    if (n > 0) {
      counts.set(k, n - 1)
      return false
    }
    return true
  })
  const sessions = [...remote.sessions, ...localNew]
    .sort((x, y) => x.date.localeCompare(y.date))
    .slice(-SESSION_CAP)

  // streak: one timeline wins (the more recently active device);
  // best is a high-water mark across everything
  const streak =
    (local.streak.lastActiveDay ?? '') >= (remote.streak.lastActiveDay ?? '')
      ? local.streak
      : remote.streak
  return {
    version: 1,
    verbs,
    sessions,
    streak: { ...streak, best: Math.max(local.streak.best, remote.streak.best) },
    forms,
  }
}
