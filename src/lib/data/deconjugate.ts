/**
 * Query-time deconjugation: turns a conjugated verb/adjective form back into
 * candidate dictionary forms, so searching "tabeta" (食べた) finds 食べる and
 * "samukatta" finds 寒い. Runs ONCE per query (not per word) and the search
 * scan just checks membership in the returned Set — no index growth, no
 * per-row work, so search stays fast with 200k+ rows live.
 *
 * The rules are deliberately over-generating: a candidate that isn't a real
 * word simply matches nothing. BFS with a small depth bound unwinds stacked
 * endings (食べさせられませんでした).
 */

/** a/i/e/o-row kana → the dictionary u-row kana of the same godan row. */
const A2U: Record<string, string> = {
  か: 'く', が: 'ぐ', さ: 'す', た: 'つ', な: 'ぬ', ば: 'ぶ', ま: 'む', ら: 'る', わ: 'う',
}
const I2U: Record<string, string> = {
  き: 'く', ぎ: 'ぐ', し: 'す', ち: 'つ', に: 'ぬ', び: 'ぶ', み: 'む', り: 'る', い: 'う',
}
const E2U: Record<string, string> = {
  け: 'く', げ: 'ぐ', せ: 'す', て: 'つ', ね: 'ぬ', べ: 'ぶ', め: 'む', れ: 'る', え: 'う',
}
const O2U: Record<string, string> = {
  こ: 'く', ご: 'ぐ', そ: 'す', と: 'つ', の: 'ぬ', ぼ: 'ぶ', も: 'む', ろ: 'る', お: 'う',
}

/** ます-stem → dictionary forms (たべ→たべる; のみ→のむ). */
function fromMasuStem(stem: string): string[] {
  if (!stem) return []
  const out = [stem + 'る']
  const last = stem[stem.length - 1]
  if (I2U[last]) out.push(stem.slice(0, -1) + I2U[last])
  if (stem.endsWith('し')) out.push(stem.slice(0, -1) + 'する')
  if (stem.endsWith('き')) out.push(stem.slice(0, -1) + 'くる')
  return out
}

/** ない-stem → dictionary forms (たべ→たべる; かか→かく). */
function fromNaiStem(stem: string): string[] {
  if (!stem) return []
  const out = [stem + 'る']
  const last = stem[stem.length - 1]
  if (A2U[last]) out.push(stem.slice(0, -1) + A2U[last])
  if (stem.endsWith('し')) out.push(stem.slice(0, -1) + 'する')
  if (stem.endsWith('こ')) out.push(stem.slice(0, -1) + 'くる')
  return out
}

/** Row-map endings: strip `suffix`, map the new last kana through `rows`. */
function rowEnding(s: string, suffix: string, rows: Record<string, string>): string[] {
  const stem = s.slice(0, -suffix.length)
  const last = stem[stem.length - 1]
  return rows[last] ? [stem.slice(0, -1) + rows[last]] : []
}

interface Rule {
  suffix: string
  /** full replacement strings; may be intermediate forms (re-processed by BFS) */
  apply: (prefix: string, whole: string) => string[]
}

const RULES: Rule[] = [
  // ---- polite chains reduce to ます, then ます reduces to dictionary ----
  { suffix: 'ませんでした', apply: (p) => [p + 'ます'] },
  { suffix: 'ましょう', apply: (p) => [p + 'ます'] },
  { suffix: 'ました', apply: (p) => [p + 'ます'] },
  { suffix: 'ません', apply: (p) => [p + 'ます'] },
  { suffix: 'ます', apply: fromMasuStem },
  // ---- negatives ----
  { suffix: 'なかった', apply: (p) => [p + 'ない'] },
  { suffix: 'なくて', apply: (p) => [p + 'ない'] },
  { suffix: 'なければ', apply: (p) => [p + 'ない'] },
  { suffix: 'くない', apply: (p) => [p + 'い'] }, // adjective (寒くない) — before ない
  { suffix: 'ない', apply: fromNaiStem },
  // ---- want-to ----
  { suffix: 'たくなかった', apply: fromMasuStem },
  { suffix: 'たかった', apply: fromMasuStem },
  { suffix: 'たくない', apply: fromMasuStem },
  { suffix: 'たい', apply: fromMasuStem },
  // ---- い-adjectives ----
  { suffix: 'かった', apply: (p) => [p + 'い'] },
  { suffix: 'くて', apply: (p) => [p + 'い'] },
  { suffix: 'ければ', apply: (p) => [p + 'い'] },
  { suffix: 'く', apply: (p) => [p + 'い'] }, // adverbial 寒く
  // ---- progressive / auxiliaries after て — reduce to the て form ----
  { suffix: 'ています', apply: (p) => [p + 'て'] },
  { suffix: 'ている', apply: (p) => [p + 'て'] },
  { suffix: 'ていた', apply: (p) => [p + 'て'] },
  { suffix: 'てる', apply: (p) => [p + 'て'] },
  { suffix: 'でいる', apply: (p) => [p + 'で'] },
  { suffix: 'でいた', apply: (p) => [p + 'で'] },
  // ---- past / て-form (godan sound changes; +く for the 行く irregular) ----
  { suffix: 'った', apply: (p) => [p + 'う', p + 'つ', p + 'る', p + 'く'] },
  { suffix: 'いた', apply: (p) => [p + 'く'] },
  { suffix: 'いだ', apply: (p) => [p + 'ぐ'] },
  { suffix: 'した', apply: (p) => [p + 'す', p + 'する'] },
  { suffix: 'んだ', apply: (p) => [p + 'ぬ', p + 'ぶ', p + 'む'] },
  { suffix: 'きた', apply: (p) => [p + 'くる'] },
  { suffix: 'って', apply: (p) => [p + 'う', p + 'つ', p + 'る', p + 'く'] },
  { suffix: 'いて', apply: (p) => [p + 'く'] },
  { suffix: 'いで', apply: (p) => [p + 'ぐ'] },
  { suffix: 'して', apply: (p) => [p + 'す', p + 'する'] },
  { suffix: 'んで', apply: (p) => [p + 'ぬ', p + 'ぶ', p + 'む'] },
  { suffix: 'きて', apply: (p) => [p + 'くる'] },
  { suffix: 'た', apply: (p) => [p + 'る'] }, // ichidan past (たべた)
  { suffix: 'て', apply: (p) => [p + 'る'] }, // ichidan て (たべて)
  // ---- conditionals ----
  { suffix: 'たら', apply: (p) => [p + 'た'] },
  { suffix: 'だら', apply: (p) => [p + 'だ'] },
  { suffix: 'えば', apply: (_p, w) => rowEnding(w, 'ば', E2U) },
  { suffix: 'けば', apply: (_p, w) => rowEnding(w, 'ば', E2U) },
  { suffix: 'げば', apply: (_p, w) => rowEnding(w, 'ば', E2U) },
  { suffix: 'せば', apply: (_p, w) => rowEnding(w, 'ば', E2U) },
  { suffix: 'てば', apply: (_p, w) => rowEnding(w, 'ば', E2U) },
  { suffix: 'ねば', apply: (_p, w) => rowEnding(w, 'ば', E2U) },
  { suffix: 'べば', apply: (_p, w) => rowEnding(w, 'ば', E2U) },
  { suffix: 'めば', apply: (_p, w) => rowEnding(w, 'ば', E2U) },
  { suffix: 'れば', apply: (p, w) => [...rowEnding(w, 'ば', E2U), p + 'る'] },
  // ---- volitional ----
  { suffix: 'よう', apply: (p) => [p + 'る'] },
  { suffix: 'こう', apply: (_p, w) => rowEnding(w, 'う', O2U) },
  { suffix: 'ごう', apply: (_p, w) => rowEnding(w, 'う', O2U) },
  { suffix: 'そう', apply: (_p, w) => rowEnding(w, 'う', O2U) },
  { suffix: 'とう', apply: (_p, w) => rowEnding(w, 'う', O2U) },
  { suffix: 'のう', apply: (_p, w) => rowEnding(w, 'う', O2U) },
  { suffix: 'ぼう', apply: (_p, w) => rowEnding(w, 'う', O2U) },
  { suffix: 'もう', apply: (_p, w) => rowEnding(w, 'う', O2U) },
  { suffix: 'ろう', apply: (_p, w) => rowEnding(w, 'う', O2U) },
  { suffix: 'おう', apply: (_p, w) => rowEnding(w, 'う', O2U) },
  // ---- passive / potential / causative (reduce to plain-form stems) ----
  { suffix: 'られる', apply: (p) => [p + 'る'] },
  { suffix: 'させる', apply: (p) => [p + 'る', p + 'する'] },
  { suffix: 'される', apply: (p) => [p + 'する', ...fromNaiStem(p)] },
  { suffix: 'れる', apply: (p) => [p + 'る', ...fromNaiStem(p)] },
  { suffix: 'せる', apply: fromNaiStem },
  // ---- irregulars ----
  { suffix: 'できる', apply: (p) => [p + 'する'] },
  { suffix: 'こない', apply: (p) => [p + 'くる'] },
  { suffix: 'しない', apply: (p) => [p + 'する'] },
  { suffix: 'よかった', apply: (p) => [p + 'いい'] },
  { suffix: 'よくない', apply: (p) => [p + 'いい'] },
  { suffix: 'よければ', apply: (p) => [p + 'いい'] },
]

const MAX_DEPTH = 4
const MAX_CANDIDATES = 48

/**
 * A query can also be an INCOMPLETE conjugation the user is still typing —
 * "tabera" (たべら) is the start of たべられる, and its last kana points
 * straight back at the dictionary ending (ら → る). Applied once to the raw
 * query only; feeding these into the BFS rules would explode it.
 */
function stemCandidates(qKana: string): string[] {
  const last = qKana[qKana.length - 1]
  const head = qKana.slice(0, -1)
  const out: string[] = []
  for (const rows of [A2U, I2U, E2U, O2U]) {
    if (rows[last]) out.push(head + rows[last])
  }
  // ます/ない-stem of an ichidan verb typed bare (たべ → たべる)
  if (I2U[last] || E2U[last]) out.push(qKana + 'る')
  return out
}

/**
 * All plausible dictionary forms of `qKana` (a hiragana-normalized query),
 * excluding the query itself. Empty set for queries too short to conjugate.
 */
export function deconjugate(qKana: string): Set<string> {
  const out = new Set<string>()
  if (qKana.length < 2) return out
  const seen = new Set<string>([qKana])
  for (const cand of stemCandidates(qKana)) {
    if (!seen.has(cand)) {
      seen.add(cand)
      out.add(cand)
    }
  }
  let frontier = [qKana]
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const s of frontier) {
      for (const rule of RULES) {
        if (!s.endsWith(rule.suffix) || s.length <= rule.suffix.length - 1) continue
        for (const cand of rule.apply(s.slice(0, -rule.suffix.length), s)) {
          if (cand.length < 2 || seen.has(cand)) continue
          seen.add(cand)
          out.add(cand)
          if (out.size >= MAX_CANDIDATES) return out
          next.push(cand)
        }
      }
    }
    frontier = next
  }
  return out
}
