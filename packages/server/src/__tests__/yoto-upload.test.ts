import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}))

// AIDEV-NOTE: Mock global fetch for Yoto API calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { uploadToYoto, computeSha256 } from '../yoto-upload'

const FAKE_FILE_CONTENT = Buffer.from('fake audio content')
const FAKE_SHA256 = createHash('sha256').update(FAKE_FILE_CONTENT).digest('hex')

// AIDEV-NOTE: Helper to create mock responses matching the real Yoto API shape.
// Upload URL: { upload: { uploadUrl, uploadId } }
// Transcode: { transcode: { progress, transcodedSha256, transcodedInfo } }
function uploadUrlResponse(uploadUrl: string | null, uploadId = 'upload-123') {
  return {
    ok: true,
    json: async () => ({ upload: { uploadUrl, uploadId } }),
  }
}

function transcodeResponse(phase: string, transcodedSha256: string | null = null, percent = 0) {
  return {
    ok: true,
    json: async () => ({
      transcode: { progress: { phase, percent }, transcodedSha256 },
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readFile).mockResolvedValue(FAKE_FILE_CONTENT)
})

describe('computeSha256', () => {
  it('computes SHA256 hex digest of file contents', async () => {
    const hash = await computeSha256('/tmp/test.m4a')
    expect(hash).toBe(FAKE_SHA256)
    expect(readFile).toHaveBeenCalledWith('/tmp/test.m4a')
  })
})

describe('uploadToYoto', () => {
  it('requests a presigned URL with correct params', async () => {
    mockFetch.mockResolvedValueOnce(uploadUrlResponse('https://s3.example.com/presigned'))
    mockFetch.mockResolvedValueOnce({ ok: true }) // S3 PUT
    mockFetch.mockResolvedValueOnce(transcodeResponse('complete', 'transcoded-hash-abc'))

    const onProgress = vi.fn()
    await uploadToYoto('/tmp/test.m4a', 'test-token', onProgress)

    // First call should be the GET for presigned URL
    const [url, opts] = mockFetch.mock.calls[0]!
    expect(url).toContain('/media/transcode/audio/uploadUrl')
    expect(url).toContain(`sha256=${FAKE_SHA256}`)
    expect(opts.headers['Authorization']).toBe('Bearer test-token')
  })

  it('PUTs to S3 with audio/mpeg content type', async () => {
    mockFetch.mockResolvedValueOnce(uploadUrlResponse('https://s3.example.com/presigned'))
    mockFetch.mockResolvedValueOnce({ ok: true }) // S3 PUT
    mockFetch.mockResolvedValueOnce(transcodeResponse('complete', 'transcoded-hash-abc'))

    await uploadToYoto('/tmp/test.m4a', 'test-token', vi.fn())

    const [s3Url, s3Opts] = mockFetch.mock.calls[1]!
    expect(s3Url).toBe('https://s3.example.com/presigned')
    expect(s3Opts.method).toBe('PUT')
    expect(s3Opts.headers['Content-Type']).toBe('audio/mpeg')
  })

  it('skips upload when uploadUrl is null (file already exists)', async () => {
    mockFetch.mockResolvedValueOnce(uploadUrlResponse(null, 'upload-existing'))
    // Transcode poll — file already exists so it should be complete
    mockFetch.mockResolvedValueOnce(transcodeResponse('complete', 'already-transcoded-hash'))

    const onProgress = vi.fn()
    const result = await uploadToYoto('/tmp/test.m4a', 'test-token', onProgress)

    // Two calls: presigned URL request + transcode poll (no S3 PUT)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toBe('yoto:#already-transcoded-hash')
  })

  it('polls transcode status until complete', async () => {
    mockFetch.mockResolvedValueOnce(uploadUrlResponse('https://s3.example.com/presigned'))
    mockFetch.mockResolvedValueOnce({ ok: true }) // S3 PUT
    // First poll: pending
    mockFetch.mockResolvedValueOnce(transcodeResponse('pending', null, 50))
    // Second poll: complete
    mockFetch.mockResolvedValueOnce(transcodeResponse('complete', 'transcoded-hash-xyz'))

    const result = await uploadToYoto('/tmp/test.m4a', 'test-token', vi.fn(), {
      pollIntervalMs: 10,
    })

    expect(result).toBe('yoto:#transcoded-hash-xyz')
    // 4 calls: presigned URL, S3 PUT, poll 1, poll 2
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('fires progress callbacks at each step', async () => {
    mockFetch.mockResolvedValueOnce(uploadUrlResponse('https://s3.example.com/presigned'))
    mockFetch.mockResolvedValueOnce({ ok: true }) // S3 PUT
    mockFetch.mockResolvedValueOnce(transcodeResponse('complete', 'transcoded-hash'))

    const onProgress = vi.fn()
    await uploadToYoto('/tmp/test.m4a', 'test-token', onProgress)

    const steps = onProgress.mock.calls.map((args) => args[0] as string)
    expect(steps).toContain('upload')
    expect(steps).toContain('transcode')
  })

  it('throws on transcode timeout', async () => {
    mockFetch.mockResolvedValueOnce(uploadUrlResponse('https://s3.example.com/presigned'))
    mockFetch.mockResolvedValueOnce({ ok: true }) // S3 PUT
    // Always pending
    mockFetch.mockResolvedValue(transcodeResponse('pending'))

    await expect(
      uploadToYoto('/tmp/test.m4a', 'test-token', vi.fn(), {
        pollIntervalMs: 1,
        timeoutMs: 50,
      }),
    ).rejects.toThrow(/transcode.*timed out/i)
  })
})
