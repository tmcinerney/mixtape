import { spawn } from 'node:child_process'
import { PipelineError } from '@mixtape/shared'
import { sanitizeTitle } from './sanitize-title'
import { suggestTitle } from './suggest-title'
import { classifyYtdlpError } from './youtube'

// AIDEV-NOTE: Yoto card limits — 5 hours total duration, 100 tracks max.
// truncatedAt is set to the first index that would exceed either limit.
const MAX_DURATION_SECONDS = 18000 // 5 hours
const MAX_TRACK_COUNT = 100

export interface ExtractedMetadata {
  type: 'video' | 'playlist'
  title: string
  suggestedTitle: string
  totalDuration: number
  truncatedAt?: number
  tracks: Array<{ videoId: string; title: string; suggestedTitle: string; duration: number }>
}

/**
 * Extract metadata from a YouTube URL using yt-dlp without downloading audio.
 *
 * AIDEV-NOTE: Uses spawn (not exec) with explicit arg arrays to avoid shell injection.
 * For videos: --dump-json outputs one JSON object on stdout.
 * For playlists: --flat-playlist --dump-single-json outputs one JSON with an entries array.
 */
export async function extractMetadata(
  url: string,
  type: 'video' | 'playlist',
): Promise<ExtractedMetadata> {
  const args =
    type === 'video' ? ['--dump-json', url] : ['--flat-playlist', '--dump-single-json', url]

  const rawJson = await runYtdlp(args)

  if (type === 'video') {
    return buildVideoMetadata(rawJson)
  } else {
    return buildPlaylistMetadata(rawJson)
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function runYtdlp(args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stdoutOutput = ''
    let stderrOutput = ''

    proc.on('error', (err) => {
      reject(new PipelineError(`Failed to spawn yt-dlp: ${err.message}`, 'DOWNLOAD_FAILED'))
    })

    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutOutput += chunk.toString()
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrOutput += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        const errorCode = classifyYtdlpError(stderrOutput)
        reject(new PipelineError(`yt-dlp failed: ${stderrOutput.trim()}`, errorCode))
        return
      }
      resolve(stdoutOutput)
    })
  })
}

async function buildVideoMetadata(rawJson: string): Promise<ExtractedMetadata> {
  const data = JSON.parse(rawJson.trim()) as { id: string; title: string; duration: number }

  const [cardSuggestedTitle, trackTitle] = await Promise.all([
    suggestTitle(data.title),
    Promise.resolve(sanitizeTitle(data.title)),
  ])
  const cardTitle = sanitizeTitle(data.title)

  return {
    type: 'video',
    title: cardTitle,
    suggestedTitle: cardSuggestedTitle,
    totalDuration: data.duration ?? 0,
    tracks: [
      {
        videoId: data.id,
        title: trackTitle,
        suggestedTitle: cardSuggestedTitle,
        duration: data.duration ?? 0,
      },
    ],
  }
}

async function buildPlaylistMetadata(rawJson: string): Promise<ExtractedMetadata> {
  const data = JSON.parse(rawJson.trim()) as {
    title: string
    entries: Array<{ id: string; title: string; duration: number | null }>
  }

  const cardSuggestedTitle = await suggestTitle(data.title)
  const cardTitle = sanitizeTitle(data.title)

  // AIDEV-NOTE: Per-track suggestedTitle uses sanitizeTitle only (no AI call).
  // AI title cleaning per track is deferred to the import job to avoid N× API calls.
  const tracks = data.entries.map((entry) => {
    const duration = entry.duration ?? 0
    const trackTitle = sanitizeTitle(entry.title)
    return { videoId: entry.id, title: trackTitle, suggestedTitle: trackTitle, duration }
  })

  // AIDEV-NOTE: Determine truncatedAt — count limit checked first, then duration.
  // truncatedAt is the index of the first track that should NOT be included.
  let truncatedAt: number | undefined
  let cumulative = 0

  if (tracks.length > MAX_TRACK_COUNT) {
    truncatedAt = MAX_TRACK_COUNT
  } else {
    for (let i = 0; i < tracks.length; i++) {
      cumulative += tracks[i]!.duration
      if (cumulative > MAX_DURATION_SECONDS) {
        truncatedAt = i
        break
      }
    }
  }

  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0)

  return {
    type: 'playlist',
    title: cardTitle,
    suggestedTitle: cardSuggestedTitle,
    totalDuration,
    ...(truncatedAt !== undefined ? { truncatedAt } : {}),
    tracks,
  }
}
