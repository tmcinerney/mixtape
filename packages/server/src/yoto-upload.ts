import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PipelineError } from '@mixtape/shared'

// AIDEV-NOTE: Yoto API base URL. Using production API endpoint.
const YOTO_API_BASE = 'https://api.yotoplay.com/card-api/v2'

interface UploadOptions {
  pollIntervalMs?: number
  timeoutMs?: number
}

type ProgressStep = 'upload' | 'transcode'

export async function computeSha256(filePath: string): Promise<string> {
  const content = await readFile(filePath)
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Upload an audio file to Yoto's S3 and poll for transcode completion.
 *
 * AIDEV-NOTE: We use raw fetch instead of @yotoplay/yoto-sdk since the SDK
 * is a frontend dependency and may not work server-side. The token is
 * passed per-job from the frontend.
 *
 * Steps: SHA256 hash -> get presigned URL -> PUT to S3 -> poll transcode
 * Returns mediaUrl in format "yoto:#<transcodedSha256>"
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

  // Step 2: Request presigned upload URL from Yoto API
  const uploadResponse = await fetch(`${YOTO_API_BASE}/audio/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sha256, contentType: 'audio/mpeg' }),
  })

  if (!uploadResponse.ok) {
    throw new PipelineError(
      `Failed to get upload URL: ${uploadResponse.status}`,
      'UPLOAD_URL_FAILED',
    )
  }

  const { uploadUrl, transcodedSha256: existingHash } = (await uploadResponse.json()) as {
    uploadUrl: string | null
    transcodedSha256: string | null
  }

  // If uploadUrl is null, file already exists on Yoto - skip upload
  if (!uploadUrl) {
    return `yoto:#${existingHash}`
  }

  // Step 3: PUT file to S3 presigned URL
  onProgress('upload', 0)
  const fileContent = await readFile(filePath)

  const s3Response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'audio/mpeg',
    },
    body: fileContent,
  })

  if (!s3Response.ok) {
    throw new PipelineError(`S3 upload failed: ${s3Response.status}`, 'S3_UPLOAD_FAILED')
  }

  onProgress('upload', 100)

  // Step 4: Poll for transcode completion
  onProgress('transcode', 0)
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const statusResponse = await fetch(`${YOTO_API_BASE}/audio/transcode/${sha256}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!statusResponse.ok) {
      throw new PipelineError(
        `Transcode status check failed: ${statusResponse.status}`,
        'TRANSCODE_CHECK_FAILED',
      )
    }

    const { status, transcodedSha256 } = (await statusResponse.json()) as {
      status: string
      transcodedSha256: string | null
    }

    if (status === 'complete' && transcodedSha256) {
      onProgress('transcode', 100)
      return `yoto:#${transcodedSha256}`
    }

    if (status === 'failed') {
      throw new PipelineError('Transcode failed on Yoto servers', 'TRANSCODE_FAILED')
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  throw new PipelineError('Transcode timed out after 15 minutes', 'TRANSCODE_TIMEOUT')
}
