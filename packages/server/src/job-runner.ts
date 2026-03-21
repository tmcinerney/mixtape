import { unlink } from 'node:fs/promises'
import type { JobProgress } from '@mixtape/shared'
import { downloadAudio } from './youtube'
import { uploadToYoto } from './yoto-upload'
import { sanitizeTitle } from './sanitize-title'
import { suggestTitle } from './suggest-title'

export interface JobConfig {
  youtubeUrl: string
  cardId: string
  yotoToken: string
}

/**
 * Orchestrate the full download -> upload pipeline for a single job.
 * Emits SSE-compatible progress events via the onEvent callback.
 * Supports cancellation via AbortSignal.
 *
 * AIDEV-NOTE: Temp file cleanup happens in the finally block regardless of outcome.
 */
export async function runJob(
  config: JobConfig,
  onEvent: (event: JobProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  let tempFilePath: string | undefined

  try {
    // Check for cancellation before starting
    if (signal?.aborted) {
      throw new Error('Job cancelled before start')
    }

    // Step 1: Download audio
    const downloadResult = await downloadAudio(config.youtubeUrl, (pct) => {
      onEvent({ step: 'download', progress: pct })
    })

    tempFilePath = downloadResult.filePath

    // Check for cancellation between steps
    if (signal?.aborted) {
      throw new Error('Job cancelled after download')
    }

    // AIDEV-NOTE: Run AI title suggestion in parallel with Yoto upload.
    // The ~500ms AI call overlaps with S3 upload + transcode polling.
    const [mediaUrl, suggested] = await Promise.all([
      uploadToYoto(downloadResult.filePath, config.yotoToken, (step, pct) => {
        onEvent({ step, progress: pct })
      }),
      suggestTitle(downloadResult.title),
    ])

    // Step 3: Emit complete event with both title variants
    const title = sanitizeTitle(downloadResult.title)
    onEvent({ step: 'complete', mediaUrl, title, suggestedTitle: suggested })

    return mediaUrl
  } catch (err) {
    const error = err as Error & { code?: string }
    onEvent({
      step: 'error',
      message: error.message,
      code: error.code ?? 'UNKNOWN_ERROR',
    })
    throw err
  } finally {
    // Always clean up temp files
    if (tempFilePath) {
      try {
        await unlink(tempFilePath)
      } catch {
        // File may already be cleaned up, ignore
      }
    }
  }
}
