// AIDEV-NOTE: Basic title sanitization that always runs before the AI suggestion.
// Strips common YouTube noise patterns and enforces length limits.

const MAX_TITLE_LENGTH = 100

// Patterns commonly appended to YouTube titles
const NOISE_PATTERNS = [
  /\s*\(official\s*(music\s*)?video\)/i,
  /\s*\(official\s*audio\)/i,
  /\s*\(official\s*lyric\s*video\)/i,
  /\s*\(lyrics?\)/i,
  /\s*\(visuali[sz]er\)/i,
  /\s*\(audio\)/i,
  /\s*\(live\)/i,
  /\s*\[official\s*(music\s*)?video\]/i,
  /\s*\[official\s*audio\]/i,
  /\s*\[lyrics?\]/i,
  /\s*\[visuali[sz]er\]/i,
  /\s*\[audio\]/i,
  /\s*\[HD\]/i,
  /\s*\[HQ\]/i,
  /\s*\[4K\]/i,
  /\s*\[CC\]/i,
  /\s*\|\s*topic$/i,
  /\s*-\s*topic$/i,
]

// Control chars and HTML tags
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g
const HTML_TAGS = /<[^>]*>/g

export function sanitizeTitle(raw: string): string {
  let title = raw.trim()

  // Strip HTML and control characters
  title = title.replace(HTML_TAGS, '')
  title = title.replace(CONTROL_CHARS, '')

  // Remove common YouTube noise suffixes
  for (const pattern of NOISE_PATTERNS) {
    title = title.replace(pattern, '')
  }

  // Collapse multiple spaces
  title = title.replace(/\s{2,}/g, ' ').trim()

  // Enforce hard max length
  if (title.length > MAX_TITLE_LENGTH) {
    title = title.slice(0, MAX_TITLE_LENGTH).trimEnd()
  }

  return title
}
