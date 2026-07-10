import { describe, expect, it } from 'vitest'
import { cleanOcrEnglish, cleanOcrJapanese, ocrOutcome } from './postprocess'

describe('cleanOcrJapanese', () => {
  it('removes the spurious spaces Tesseract puts between CJK glyphs', () => {
    expect(cleanOcrJapanese('日 本 語 を\n勉 強')).toBe('日本語を勉強')
  })

  it('removes full-width spaces and all other whitespace', () => {
    expect(cleanOcrJapanese('今日は　いい天気\t\r\nです')).toBe('今日はいい天気です')
  })

  it('drops latin text scanned from a mixed image, keeps the Japanese', () => {
    expect(cleanOcrJapanese('Chapter 3 旅行の楽しみ page 12')).toBe('3旅行の楽しみ12')
  })

  it('keeps ASCII and full-width digits (ordinary Japanese text)', () => {
    expect(cleanOcrJapanese('３人と3人')).toBe('３人と3人')
  })

  it('keeps Japanese punctuation', () => {
    expect(cleanOcrJapanese('そうですね。はい、どうぞ！')).toBe('そうですね。はい、どうぞ！')
  })

  it('returns empty for latin-only input', () => {
    expect(cleanOcrJapanese('Hello world!')).toBe('')
  })
})

describe('cleanOcrEnglish', () => {
  it('collapses line breaks and runs of spaces into single spaces', () => {
    expect(cleanOcrEnglish('The quick\nbrown  fox\r\njumps')).toBe('The quick brown fox jumps')
  })

  it('drops Japanese from a mixed image, keeps the English', () => {
    expect(cleanOcrEnglish('日本語 Hello world こんにちは')).toBe('Hello world')
  })

  it('trims leading/trailing whitespace', () => {
    expect(cleanOcrEnglish('  padded  ')).toBe('padded')
  })
})

describe('ocrOutcome', () => {
  it('is empty for nothing usable', () => {
    expect(ocrOutcome('', 120)).toBe('empty')
    expect(ocrOutcome('   ', 120)).toBe('empty')
  })

  it('is commit within the cap, including exactly at it', () => {
    expect(ocrOutcome('あ'.repeat(119), 120)).toBe('commit')
    expect(ocrOutcome('あ'.repeat(120), 120)).toBe('commit')
  })

  it('is over-limit one past the cap', () => {
    expect(ocrOutcome('あ'.repeat(121), 120)).toBe('over-limit')
  })
})
