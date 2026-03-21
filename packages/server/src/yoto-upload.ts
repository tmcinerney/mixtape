import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { PipelineError } from '@mixtape/shared'

// AIDEV-NOTE: Yoto API base from yoto.dev/api docs
const YOTO_API_BASE = 'https://api.yotoplay.com'

interface UploadOptions {
  pollIntervalMs?: number
  timeoutMs?: number
}

type ProgressStep = 'upload' | 'transcode'

// AIDEV-NOTE: Actual API response shapes from yoto-mcp — SDK types don't match
interface UploadUrlResponse {
  uploadUrl: string | null
  uploadId: string
}

interface TranscodeResponse {
  progress?: { phase: string; percent: number }
  transcodedSha256?: string
  transcodedInfo?: { duration: number; fileSize: number }
}

export async function computeSha256(filePath: string): Promise<string> {
  const content = await readFile(filePath)
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Upload an audio file to Yoto's S3 and poll for transcode completion.
 *
 * AIDEV-NOTE: Uses raw fetch matching the endpoints from yoto.dev/api and
 * the patterns in yoto-mcp/src/tools/media.ts:
 * - GET /media/transcode/audio/uploadUrl?sha256=...&filename=...
 * - PUT to presigned S3 URL with Content-Type: audio/mpeg
 * - GET /media/transcode/audio/{uploadId} to poll transcode
 */
export async function uploadToYoto(
  filePath: string,
  token: string,
  onProgress: (step: ProgressStep, pct: number) => void,
  options: UploadOptions = {},
): Promise<string> {
  const { pollIntervalMs = 10_000, timeoutMs = 15 * 60 * 1000 } = options

  // Step 1: Compute SHA256 of the file
  const sha256 = await computeSha256(filePath)
  const filename = basename(filePath)

  // Step 2: Request presigned upload URL from Yoto API
  const params = new URLSearchParams({ sha256, filename })
  const uploadResponse = await fetch(`${YOTO_API_BASE}/media/transcode/audio/uploadUrl?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!uploadResponse.ok) {
    throw new PipelineError(
      `Failed to get upload URL: ${uploadResponse.status}`,
      'UPLOAD_URL_FAILED',
    )
  }

  // AIDEV-NOTE: raw API wraps in { upload: { ... } } — SDK unwraps this
  const { upload } = (await uploadResponse.json()) as { upload: UploadUrlResponse }
  const { uploadUrl, uploadId } = upload

  // If uploadUrl is null, file already exists on Yoto — skip upload
  if (!uploadUrl) {
    onProgress('upload', 100)
    // Poll transcode with uploadId to get the transcodedSha256
    return await pollTranscode(token, uploadId ?? sha256, onProgress, pollIntervalMs, timeoutMs)
  }

  // Step 3: PUT file to S3 presigned URL
  // AIDEV-NOTE: Always audio/mpeg — Yoto's transcoder detects actual format.
  // Do NOT include Authorization header — it causes S3 to reject the request.
  onProgress('upload', 0)
  const fileContent = await readFile(filePath)

  const s3Response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'audio/mpeg' },
    body: fileContent,
  })

  if (!s3Response.ok) {
    throw new PipelineError(`S3 upload failed: ${s3Response.status}`, 'S3_UPLOAD_FAILED')
  }

  onProgress('upload', 100)

  // Step 4: Poll for transcode completion
  return await pollTranscode(token, uploadId ?? sha256, onProgress, pollIntervalMs, timeoutMs)
}

async function pollTranscode(
  token: string,
  uploadId: string,
  onProgress: (step: ProgressStep, pct: number) => void,
  pollIntervalMs: number,
  timeoutMs: number,
): Promise<string> {
  onProgress('transcode', 0)
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const statusResponse = await fetch(
      // AIDEV-NOTE: endpoint from SDK source: /media/upload/{uploadId}/transcoded
      `${YOTO_API_BASE}/media/upload/${uploadId}/transcoded`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    if (!statusResponse.ok) {
      throw new PipelineError(
        `Transcode status check failed: ${statusResponse.status}`,
        'TRANSCODE_CHECK_FAILED',
      )
    }

    // AIDEV-NOTE: raw API wraps in { transcode: { ... } } — SDK unwraps this
    const raw = (await statusResponse.json()) as { transcode: TranscodeResponse }
    const data = raw.transcode

    if (data.progress?.phase === 'complete' && data.transcodedSha256) {
      onProgress('transcode', 100)
      return `yoto:#${data.transcodedSha256}`
    }

    if (data.progress?.percent) {
      onProgress('transcode', data.progress.percent)
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  throw new PipelineError('Transcode timed out after 15 minutes', 'TRANSCODE_TIMEOUT')
}
