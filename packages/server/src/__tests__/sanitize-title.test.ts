import { describe, expect, it } from 'vitest'
import { sanitizeTitle } from '../sanitize-title'

describe('sanitizeTitle', () => {
  it('trims whitespace', () => {
    expect(sanitizeTitle('  hello world  ')).toBe('hello world')
  })

  it('strips (Official Music Video)', () => {
    expect(sanitizeTitle('Song Name (Official Music Video)')).toBe('Song Name')
  })

  it('strips [Official Video]', () => {
    expect(sanitizeTitle('Song Name [Official Video]')).toBe('Song Name')
  })

  it('strips (Official Audio)', () => {
    expect(sanitizeTitle('Song Name (Official Audio)')).toBe('Song Name')
  })

  it('strips (Lyrics)', () => {
    expect(sanitizeTitle('Song Name (Lyrics)')).toBe('Song Name')
  })

  it('strips [Lyric]', () => {
    expect(sanitizeTitle('Song Name [Lyric]')).toBe('Song Name')
  })

  it('strips (Visualizer)', () => {
    expect(sanitizeTitle('Song Name (Visualizer)')).toBe('Song Name')
  })

  it('strips [HD]', () => {
    expect(sanitizeTitle('Song Name [HD]')).toBe('Song Name')
  })

  it('strips [4K]', () => {
    expect(sanitizeTitle('Song Name [4K]')).toBe('Song Name')
  })

  it('strips | Topic suffix', () => {
    expect(sanitizeTitle('Song Name | Topic')).toBe('Song Name')
  })

  it('strips - Topic suffix', () => {
    expect(sanitizeTitle('Song Name - Topic')).toBe('Song Name')
  })

  it('strips HTML tags', () => {
    expect(sanitizeTitle('Hello <b>World</b>')).toBe('Hello World')
  })

  it('strips control characters', () => {
    expect(sanitizeTitle('Hello\x00World\x1F')).toBe('HelloWorld')
  })

  it('collapses multiple spaces', () => {
    expect(sanitizeTitle('Hello   World')).toBe('Hello World')
  })

  it('truncates at 100 characters', () => {
    const long = 'A'.repeat(120)
    expect(sanitizeTitle(long).length).toBe(100)
  })

  it('handles multiple noise patterns', () => {
    expect(sanitizeTitle('Song Name (Official Music Video) [HD]')).toBe('Song Name')
  })

  it('is case-insensitive for patterns', () => {
    expect(sanitizeTitle('Song Name (OFFICIAL MUSIC VIDEO)')).toBe('Song Name')
  })

  it('preserves emoji', () => {
    expect(sanitizeTitle('🎵 Song Name')).toBe('🎵 Song Name')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeTitle('')).toBe('')
  })
})
