import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import * as fs from 'node:fs/promises'

// AIDEV-NOTE: We mock child_process.spawn to avoid needing yt-dlp installed in tests
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 1024000 }),
}))

import { spawn } from 'node:child_process'
import { downloadAudio, classifyYtdlpError } from '../youtube'

function createMockProcess() {
  const proc = new EventEmitter() as ChildProcess & {
    stderr: EventEmitter
    stdout: EventEmitter
    kill: ReturnType<typeof vi.fn>
  }
  proc.stderr = new EventEmitter()
  proc.stdout = new EventEmitter()
  proc.kill = vi.fn()
  return proc
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('downloadAudio', () => {
  it('calls yt-dlp with correct arguments', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const promise = downloadAudio('https://www.youtube.com/watch?v=abc123', vi.fn())

    // Simulate successful output and exit
    proc.stdout.emit(
      'data',
      Buffer.from('{"title":"Test Video","duration":120,"filename":"/tmp/mixtape-abc123.m4a"}\n'),
    )
    proc.emit('close', 0)

    const result = await promise
    expect(spawn).toHaveBeenCalledWith(
      'yt-dlp',
      expect.arrayContaining([
        '--extract-audio',
        '--audio-format',
        'm4a',
        '--audio-quality',
        '0',
        'https://www.youtube.com/watch?v=abc123',
      ]),
      expect.any(Object),
    )
    expect(result).toEqual(
      expect.objectContaining({
        title: 'Test Video',
        duration: 120,
      }),
    )
  })

  it('reports progress from stderr output', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)
    const onProgress = vi.fn()

    const promise = downloadAudio('https://www.youtube.com/watch?v=abc123', onProgress)

    proc.stderr.emit('data', Buffer.from('[download]  25.0% of 10.00MiB'))
    proc.stderr.emit('data', Buffer.from('[download]  50.0% of 10.00MiB'))
    proc.stderr.emit('data', Buffer.from('[download]  75.0% of 10.00MiB'))
    proc.stderr.emit('data', Buffer.from('[download] 100% of 10.00MiB'))
    proc.stdout.emit(
      'data',
      Buffer.from('{"title":"Test","duration":60,"filename":"/tmp/mixtape-test.m4a"}\n'),
    )
    proc.emit('close', 0)

    await promise
    expect(onProgress).toHaveBeenCalledWith(25)
    expect(onProgress).toHaveBeenCalledWith(50)
    expect(onProgress).toHaveBeenCalledWith(75)
    expect(onProgress).toHaveBeenCalledWith(100)
  })

  it('cleans up temp file on failure', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const promise = downloadAudio('https://www.youtube.com/watch?v=abc123', vi.fn())

    proc.stderr.emit('data', Buffer.from('ERROR: Video unavailable'))
    proc.emit('close', 1)

    await expect(promise).rejects.toThrow()
    // unlink should be attempted for cleanup
    expect(fs.unlink).toHaveBeenCalled()
  })

  it('rejects on non-zero exit code', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const promise = downloadAudio('https://www.youtube.com/watch?v=abc123', vi.fn())

    proc.stderr.emit('data', Buffer.from('ERROR: something went wrong'))
    proc.emit('close', 1)

    await expect(promise).rejects.toThrow()
  })
})

describe('classifyYtdlpError', () => {
  it('classifies private video errors', () => {
    expect(classifyYtdlpError('ERROR: Private video')).toBe('VIDEO_PRIVATE')
    expect(classifyYtdlpError('Video is private')).toBe('VIDEO_PRIVATE')
  })

  it('classifies age-restricted video errors', () => {
    expect(classifyYtdlpError('ERROR: Sign in to confirm your age')).toBe('VIDEO_AGE_RESTRICTED')
  })

  it('classifies region-locked video errors', () => {
    expect(classifyYtdlpError('ERROR: not available in your country')).toBe('VIDEO_REGION_LOCKED')
    expect(classifyYtdlpError('blocked it in your country')).toBe('VIDEO_REGION_LOCKED')
  })

  it('classifies not-found errors', () => {
    expect(classifyYtdlpError('ERROR: Video unavailable')).toBe('VIDEO_NOT_FOUND')
    expect(classifyYtdlpError('This video is no longer available')).toBe('VIDEO_NOT_FOUND')
  })

  it('returns DOWNLOAD_FAILED for unknown errors', () => {
    expect(classifyYtdlpError('ERROR: some random error')).toBe('DOWNLOAD_FAILED')
  })
})
