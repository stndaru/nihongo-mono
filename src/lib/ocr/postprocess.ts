/**
 * Pure text post-processing for the parser's Scan Image (OCR) feature —
 * turns raw Tesseract output into text the active tab accepts.
 */
import { stripNonEnglish, stripNonJapanese } from '@/lib/data/parse-sentence'

/**
 * Japanese mode: keep only the parser-allowed characters, then drop ALL
 * whitespace. Tesseract inserts spurious spaces/newlines between CJK
 * glyphs, and Japanese carries no meaningful whitespace — but JA_ALLOWED
 * deliberately keeps `\s` (typed input may hold it), so stripNonJapanese
 * alone is not enough.
 */
export function cleanOcrJapanese(raw: string): string {
  return stripNonJapanese(raw).replace(/\s+/gu, '')
}

/**
 * English mode: keep only English-typable characters, then collapse the
 * page layout's line breaks and double spaces into single spaces.
 */
export function cleanOcrEnglish(raw: string): string {
  return stripNonEnglish(raw).replace(/\s+/gu, ' ').trim()
}

export type OcrOutcome = 'empty' | 'over-limit' | 'commit'

/**
 * The auto-breakdown decision for a cleaned OCR result: nothing usable →
 * 'empty'; fits the mode's parse cap → 'commit' (break down immediately);
 * else 'over-limit' (text lands in the box, the user edits it down).
 */
export function ocrOutcome(clean: string, max: number): OcrOutcome {
  if (!clean.trim()) return 'empty'
  return clean.length > max ? 'over-limit' : 'commit'
}
