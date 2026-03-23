import { unlink } from 'node:fs/promises'
import type { ImportProgress } from '@mixtape/shared'
import { PipelineError } from '@mixtape/shared'
import { createCard, addChapterToCard } from './yoto-cards'
import { downloadAudio } from './youtube'
import { uploadToYoto } from './yoto-upload'
import { suggestTitle } from './suggest-title'

export interface ImportConfig {
  url: string
  cardId?: string
  cardTitle?: string
  coverUrl?: string
  tracks: Array<{ videoId: string; title: string }>
  yotoToken: string
}

// AIDEV-NOTE: Maps yt-dlp error codes to user-friendly skip reasons
function errorCodeToReason(err: unknown): string {
  if (err instanceof PipelineError) {
    switch (err.code) {
      case 'VIDEO_PRIVATE':
        return 'Private video'
      case 'VIDEO_AGE_RESTRICTED':
        return 'Age-restricted'
      case 'VIDEO_REGION_LOCKED':
        return 'Unavailable in your region'
      case 'VIDEO_NOT_FOUND':
        return 'Video unavailable'
      default:
        return 'Download failed'
    }
  }
  return 'Download failed'
}

// AIDEV-NOTE: Permanent PipelineError codes that should not be retried
const PERMANENT_ERROR_CODES = [
  'VIDEO_PRIVATE',
  'VIDEO_AGE_RESTRICTED',
  'VIDEO_REGION_LOCKED',
  'VIDEO_NOT_FOUND',
]

async function withRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) throw err
      // Don't retry permanent failures (VIDEO_PRIVATE, etc.)
      if (err instanceof PipelineError && PERMANENT_ERROR_CODES.includes(err.code)) {
        throw err
      }
    }
  }
  throw new Error('unreachable')
}

export async function runImport(
  config: ImportConfig,
  onEvent: (event: ImportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  let cardId = config.cardId
  let imported = 0
  const skipped: Array<{ title: string; reason: string }> = []

  // Create card if needed
  if (!cardId) {
    try {
      cardId = await createCard(config.cardTitle!, config.coverUrl, config.yotoToken)
      onEvent({ type: 'card-created', cardId })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create card'
      onEvent({ type: 'error', message })
      throw err
    }
  }

  const total = config.tracks.length

  for (let i = 0; i < total; i++) {
    // Check cancellation between tracks
    if (signal?.aborted) {
      onEvent({ type: 'cancelled', cardId: cardId!, imported })
      return
    }

    const track = config.tracks[i]!
    onEvent({ type: 'track-start', index: i, total, title: track.title })

    let tempFilePath: string | undefined
    try {
      // Download with retry-once on transient errors
      const downloadResult = await withRetry(
        () =>
          downloadAudio(`https://www.youtube.com/watch?v=${track.videoId}`, (pct) => {
            onEvent({ type: 'track-progress', step: 'download', progress: pct })
          }),
        1,
      )
      tempFilePath = downloadResult.filePath

      // AIDEV-NOTE: Run AI title suggestion in parallel with upload — ~free in critical path
      // AIDEV-NOTE: No cancellation check here — if download completed we finish the track.
      // Cancellation is checked between tracks to avoid wasting the completed download.
      const [mediaUrl, aiTitle] = await Promise.all([
        uploadToYoto(downloadResult.filePath, config.yotoToken, (step, pct) => {
          onEvent({ type: 'track-progress', step, progress: pct })
        }),
        suggestTitle(track.title),
      ])

      await addChapterToCard(cardId!, { title: aiTitle, mediaUrl, index: i }, config.yotoToken)

      imported++
      onEvent({ type: 'track-complete', index: i })
    } catch (err) {
      const reason = errorCodeToReason(err)
      skipped.push({ title: track.title, reason })
      onEvent({ type: 'track-skipped', index: i, title: track.title, reason })
    } finally {
      if (tempFilePath) {
        try {
          await unlink(tempFilePath)
        } catch {
          /* ignore cleanup errors */
        }
      }
    }
  }

  onEvent({ type: 'complete', cardId: cardId!, imported, skipped })
}
