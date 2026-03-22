import { spawn } from 'node:child_process'
import { unlink, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { YtdlpErrorCode, PipelineError } from '@mixtape/shared'

export interface DownloadResult {
  filePath: string
  title: string
  duration: number
  fileSize: number
}

// AIDEV-NOTE: yt-dlp progress lines look like "[download]  25.0% of 10.00MiB"
const PROGRESS_REGEX = /\[download\]\s+(\d+(?:\.\d+)?)%/

/**
 * Classify yt-dlp stderr output into a specific error code.
 */
export function classifyYtdlpError(stderr: string): YtdlpErrorCode {
  const lower = stderr.toLowerCase()

  if (lower.includes('private')) return YtdlpErrorCode.VIDEO_PRIVATE
  if (lower.includes('sign in to confirm your age') || lower.includes('age-restricted'))
    return YtdlpErrorCode.VIDEO_AGE_RESTRICTED
  if (lower.includes('not available in your country') || lower.includes('blocked it in your'))
    return YtdlpErrorCode.VIDEO_REGION_LOCKED
  if (lower.includes('video unavailable') || lower.includes('no longer available'))
    return YtdlpErrorCode.VIDEO_NOT_FOUND

  return YtdlpErrorCode.DOWNLOAD_FAILED
}

/**
 * Download audio from a YouTube URL using yt-dlp.
 * Reports progress via callback and returns metadata about the downloaded file.
 *
 * AIDEV-NOTE: Uses spawn (not exec) with explicit arg array to avoid shell injection.
 * URL is passed as a positional argument to yt-dlp, never interpolated into a shell string.
 */
export async function downloadAudio(
  url: string,
  onProgress: (pct: number) => void,
): Promise<DownloadResult> {
  // AIDEV-NOTE: use %(ext)s so yt-dlp controls the final extension after post-processing
  const tempBase = join(tmpdir(), `mixtape-${crypto.randomUUID()}`)
  const tempTemplate = `${tempBase}.%(ext)s`

  const args = [
    '--extract-audio',
    '--audio-format',
    'm4a',
    '--audio-quality',
    '0',
    '-o',
    tempTemplate,
    '--print',
    'before_dl:{"title":"%(title)s","duration":%(duration)s}',
    '--print',
    'after_move:%(filepath)s',
    url,
  ]

  let stderrOutput = ''
  let stdoutOutput = ''

  return new Promise<DownloadResult>((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] })

    // AIDEV-NOTE: Handle spawn errors (e.g. ENOENT when yt-dlp not installed)
    proc.on('error', (err) => {
      reject(new PipelineError(`Failed to spawn yt-dlp: ${err.message}`, 'DOWNLOAD_FAILED'))
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      const line = chunk.toString()
      stderrOutput += line
      const match = PROGRESS_REGEX.exec(line)
      if (match?.[1]) {
        onProgress(Math.round(parseFloat(match[1])))
      }
    })

    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutOutput += chunk.toString()
    })

    proc.on('close', async (code) => {
      if (code !== 0) {
        // Attempt cleanup of partial download
        try {
          await unlink(`${tempBase}.m4a`)
        } catch {
          // File may not exist yet, ignore
        }
        const errorCode = classifyYtdlpError(stderrOutput)
        reject(new PipelineError(`yt-dlp failed: ${stderrOutput.trim()}`, errorCode))
        return
      }

      try {
        // AIDEV-NOTE: stdout has two --print outputs:
        // Line 1 (before_dl): JSON metadata
        // Line 2 (after_move): final file path
        const lines = stdoutOutput.trim().split('\n')
        const metaLine = lines[0] ?? '{}'
        const filePath = lines[1]?.trim() ?? `${tempBase}.m4a`
        const meta = JSON.parse(metaLine) as { title: string; duration: number }
        const fileStat = await stat(filePath)

        resolve({
          filePath,
          title: meta.title,
          duration: meta.duration,
          fileSize: fileStat.size,
        })
      } catch (err) {
        reject(new PipelineError(`Failed to parse yt-dlp output: ${err}`, 'DOWNLOAD_FAILED'))
      }
    })
  })
}
