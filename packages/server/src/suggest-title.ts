import OpenAI from 'openai'
import { sanitizeTitle } from './sanitize-title'

// AIDEV-NOTE: Uses gpt-4o-mini for fast, cheap title cleanup. Falls back to
// basic sanitization if the API key is missing or the call fails.
const SYSTEM_PROMPT = `You clean up YouTube video titles into short track names for a children's audio player.

Rules:
- Remove artist names, channel names, and "feat." credits unless the artist IS the track
- Remove quality markers, "Official Video", "Lyrics", brackets, parenthetical noise
- Remove "Read Aloud", "Read Along", "Audiobook", "Full Story" etc. from children's content
- Keep the core title — what a parent would call this track
- Under 50 characters
- Return ONLY the cleaned title, nothing else`

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  if (client) return client
  const apiKey = process.env['OPENAI_API_KEY']
  if (!apiKey) return null
  client = new OpenAI({ apiKey })
  return client
}

/**
 * Suggest a clean track title using AI. Falls back to basic sanitization.
 *
 * AIDEV-NOTE: Called during the pipeline after yt-dlp download completes.
 * The ~500ms latency overlaps with S3 upload/transcode polling, so it's
 * effectively free in the critical path.
 */
export async function suggestTitle(rawTitle: string): Promise<string> {
  const sanitized = sanitizeTitle(rawTitle)

  const openai = getClient()
  if (!openai) {
    // No API key configured — fall back to basic sanitization
    return sanitized
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: rawTitle },
      ],
      max_tokens: 100,
      temperature: 0.3,
    })

    const suggestion = response.choices[0]?.message?.content?.trim()
    if (!suggestion || suggestion.length === 0) {
      return sanitized
    }

    // Enforce the same length limit on AI output
    return suggestion.length > 100 ? suggestion.slice(0, 100).trimEnd() : suggestion
  } catch {
    // AI call failed — fall back to basic sanitization
    return sanitized
  }
}
