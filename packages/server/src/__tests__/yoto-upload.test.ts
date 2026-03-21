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
    // POST to get upload URL
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://s3.example.com/presigned',
        transcodedSha256: null,
      }),
    })
    // PUT to S3
    mockFetch.mockResolvedValueOnce({ ok: true })
    // GET transcode status - complete
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'complete',
        transcodedSha256: 'transcoded-hash-abc',
      }),
    })

    const onProgress = vi.fn()
    await uploadToYoto('/tmp/test.m4a', 'test-token', onProgress)

    // First call should be the presigned URL request
    const [url, opts] = mockFetch.mock.calls[0]!
    expect(url).toContain('/audio/upload')
    expect(opts.headers['Authorization']).toBe('Bearer test-token')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.sha256).toBe(FAKE_SHA256)
    expect(body.contentType).toBe('audio/mpeg')
  })

  it('PUTs to S3 with audio/mpeg content type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://s3.example.com/presigned',
        transcodedSha256: null,
      }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'complete',
        transcodedSha256: 'transcoded-hash-abc',
      }),
    })

    await uploadToYoto('/tmp/test.m4a', 'test-token', vi.fn())

    const [s3Url, s3Opts] = mockFetch.mock.calls[1]!
    expect(s3Url).toBe('https://s3.example.com/presigned')
    expect(s3Opts.method).toBe('PUT')
    expect(s3Opts.headers['Content-Type']).toBe('audio/mpeg')
  })

  it('skips upload when uploadUrl is null (file already exists)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: null,
        transcodedSha256: 'already-transcoded-hash',
      }),
    })

    const onProgress = vi.fn()
    const result = await uploadToYoto('/tmp/test.m4a', 'test-token', onProgress)

    // Only one fetch call (the presigned URL request), no S3 PUT
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).toBe('yoto:#already-transcoded-hash')
  })

  it('polls transcode status until complete', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://s3.example.com/presigned',
        transcodedSha256: null,
      }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true })
    // First poll: pending
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'pending', transcodedSha256: null }),
    })
    // Second poll: complete
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'complete',
        transcodedSha256: 'transcoded-hash-xyz',
      }),
    })

    const result = await uploadToYoto('/tmp/test.m4a', 'test-token', vi.fn(), {
      pollIntervalMs: 10,
    })

    expect(result).toBe('yoto:#transcoded-hash-xyz')
    // 4 calls: presigned URL, S3 PUT, poll 1, poll 2
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('fires progress callbacks at each step', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://s3.example.com/presigned',
        transcodedSha256: null,
      }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'complete',
        transcodedSha256: 'transcoded-hash',
      }),
    })

    const onProgress = vi.fn()
    await uploadToYoto('/tmp/test.m4a', 'test-token', onProgress)

    const steps = onProgress.mock.calls.map(([step]: [string]) => step)
    expect(steps).toContain('upload')
    expect(steps).toContain('transcode')
  })

  it('throws on transcode timeout', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://s3.example.com/presigned',
        transcodedSha256: null,
      }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true })
    // Always pending
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'pending', transcodedSha256: null }),
    })

    await expect(
      uploadToYoto('/tmp/test.m4a', 'test-token', vi.fn(), {
        pollIntervalMs: 1,
        timeoutMs: 50,
      }),
    ).rejects.toThrow(/transcode.*timed out/i)
  })
})
