import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../youtube', () => ({
  downloadAudio: vi.fn(),
}))

vi.mock('../yoto-upload', () => ({
  uploadToYoto: vi.fn(),
}))

vi.mock('../suggest-title', () => ({
  suggestTitle: vi.fn().mockResolvedValue('Suggested Title'),
}))

vi.mock('node:fs/promises', () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}))

import { downloadAudio } from '../youtube'
import { uploadToYoto } from '../yoto-upload'
import { unlink } from 'node:fs/promises'
import { runJob, type JobConfig } from '../job-runner'

const baseConfig: JobConfig = {
  youtubeUrl: 'https://www.youtube.com/watch?v=abc123',
  cardId: 'card-1',
  yotoToken: 'tok-abc',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runJob', () => {
  it('runs full pipeline: download -> upload -> returns mediaUrl', async () => {
    vi.mocked(downloadAudio).mockImplementation(async (_url, onProgress) => {
      onProgress(50)
      onProgress(100)
      return { filePath: '/tmp/test.m4a', title: 'Test', duration: 120, fileSize: 1024 }
    })

    vi.mocked(uploadToYoto).mockImplementation(async (_path, _token, onProgress) => {
      onProgress('upload', 100)
      onProgress('transcode', 100)
      return 'yoto:#abc123'
    })

    const onEvent = vi.fn()
    const result = await runJob(baseConfig, onEvent)

    expect(result).toBe('yoto:#abc123')
    expect(downloadAudio).toHaveBeenCalledWith(baseConfig.youtubeUrl, expect.any(Function))
    expect(uploadToYoto).toHaveBeenCalledWith(
      '/tmp/test.m4a',
      baseConfig.yotoToken,
      expect.any(Function),
    )
  })

  it('emits SSE-compatible progress events through the pipeline', async () => {
    vi.mocked(downloadAudio).mockImplementation(async (_url, onProgress) => {
      onProgress(50)
      onProgress(100)
      return { filePath: '/tmp/test.m4a', title: 'Test', duration: 120, fileSize: 1024 }
    })

    vi.mocked(uploadToYoto).mockImplementation(async (_path, _token, onProgress) => {
      onProgress('upload', 50)
      onProgress('upload', 100)
      onProgress('transcode', 100)
      return 'yoto:#abc'
    })

    const onEvent = vi.fn()
    await runJob(baseConfig, onEvent)

    const events = onEvent.mock.calls.map(([e]) => e)
    expect(events).toContainEqual({ step: 'download', progress: 50 })
    expect(events).toContainEqual({ step: 'download', progress: 100 })
    expect(events).toContainEqual({ step: 'upload', progress: 50 })
    expect(events).toContainEqual({ step: 'upload', progress: 100 })
    expect(events).toContainEqual({ step: 'transcode', progress: 100 })
    expect(events).toContainEqual(
      expect.objectContaining({
        step: 'complete',
        mediaUrl: 'yoto:#abc',
        suggestedTitle: 'Suggested Title',
      }),
    )
  })

  it('emits error event when download fails', async () => {
    const err = new Error('yt-dlp failed')
    ;(err as { code?: string }).code = 'VIDEO_NOT_FOUND'
    vi.mocked(downloadAudio).mockRejectedValue(err)

    const onEvent = vi.fn()
    await expect(runJob(baseConfig, onEvent)).rejects.toThrow('yt-dlp failed')

    const events = onEvent.mock.calls.map(([e]) => e)
    expect(events).toContainEqual(
      expect.objectContaining({ step: 'error', code: 'VIDEO_NOT_FOUND' }),
    )
  })

  it('emits error event when upload fails', async () => {
    vi.mocked(downloadAudio).mockResolvedValue({
      filePath: '/tmp/test.m4a',
      title: 'Test',
      duration: 120,
      fileSize: 1024,
    })

    const err = new Error('S3 upload failed')
    ;(err as { code?: string }).code = 'S3_UPLOAD_FAILED'
    vi.mocked(uploadToYoto).mockRejectedValue(err)

    const onEvent = vi.fn()
    await expect(runJob(baseConfig, onEvent)).rejects.toThrow('S3 upload failed')

    const events = onEvent.mock.calls.map(([e]) => e)
    expect(events).toContainEqual(
      expect.objectContaining({ step: 'error', code: 'S3_UPLOAD_FAILED' }),
    )
  })

  it('cleans up temp files on success', async () => {
    vi.mocked(downloadAudio).mockResolvedValue({
      filePath: '/tmp/test.m4a',
      title: 'Test',
      duration: 120,
      fileSize: 1024,
    })
    vi.mocked(uploadToYoto).mockResolvedValue('yoto:#abc')

    await runJob(baseConfig, vi.fn())

    expect(unlink).toHaveBeenCalledWith('/tmp/test.m4a')
  })

  it('cleans up temp files on failure', async () => {
    vi.mocked(downloadAudio).mockResolvedValue({
      filePath: '/tmp/test.m4a',
      title: 'Test',
      duration: 120,
      fileSize: 1024,
    })
    vi.mocked(uploadToYoto).mockRejectedValue(new Error('fail'))

    await expect(runJob(baseConfig, vi.fn())).rejects.toThrow()

    expect(unlink).toHaveBeenCalledWith('/tmp/test.m4a')
  })

  it('supports cancellation via AbortSignal', async () => {
    const controller = new AbortController()

    vi.mocked(downloadAudio).mockImplementation(async () => {
      controller.abort()
      return { filePath: '/tmp/test.m4a', title: 'Test', duration: 120, fileSize: 1024 }
    })

    const onEvent = vi.fn()
    await expect(runJob(baseConfig, onEvent, controller.signal)).rejects.toThrow(/cancel/i)
  })
})
