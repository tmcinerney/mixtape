import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'

// AIDEV-NOTE: Mock child_process.spawn to avoid needing yt-dlp installed in tests
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

// Mock suggestTitle and sanitizeTitle for isolation from OpenAI dependency
vi.mock('../suggest-title', () => ({
  suggestTitle: vi.fn((title: string) => Promise.resolve(`suggested: ${title}`)),
}))

vi.mock('../sanitize-title', () => ({
  sanitizeTitle: vi.fn((title: string) => `sanitized: ${title}`),
}))

import { spawn } from 'node:child_process'
import { extractMetadata } from '../youtube-metadata'
import { PipelineError } from '@mixtape/shared'

function createMockProcess() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = new EventEmitter() as any
  proc.stderr = new EventEmitter()
  proc.stdout = new EventEmitter()
  proc.kill = vi.fn()
  proc.pid = 12345
  proc.stdin = null
  proc.stdio = [null, proc.stdout, proc.stderr]
  return proc as ChildProcess & {
    stderr: EventEmitter
    stdout: EventEmitter
    kill: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractMetadata - single video', () => {
  it('calls yt-dlp with --dump-json for a single video URL', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const promise = extractMetadata('https://www.youtube.com/watch?v=abc123', 'video')

    proc.stdout.emit(
      'data',
      Buffer.from(JSON.stringify({ id: 'abc123', title: 'My Video', duration: 213 })),
    )
    proc.emit('close', 0)

    await promise

    expect(spawn).toHaveBeenCalledWith(
      'yt-dlp',
      ['--dump-json', 'https://www.youtube.com/watch?v=abc123'],
      expect.any(Object),
    )
  })

  it('returns a single-track ExtractedMetadata for a video', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const promise = extractMetadata('https://www.youtube.com/watch?v=abc123', 'video')

    proc.stdout.emit(
      'data',
      Buffer.from(JSON.stringify({ id: 'abc123', title: 'My Video', duration: 213 })),
    )
    proc.emit('close', 0)

    const result = await promise

    expect(result.type).toBe('video')
    expect(result.tracks).toHaveLength(1)
    expect(result.tracks[0]).toEqual({
      videoId: 'abc123',
      title: 'sanitized: My Video',
      suggestedTitle: 'suggested: My Video',
      duration: 213,
    })
    expect(result.totalDuration).toBe(213)
    expect(result.truncatedAt).toBeUndefined()
    // suggestedTitle on the card comes from suggestTitle
    expect(result.suggestedTitle).toBe('suggested: My Video')
    expect(result.title).toBe('sanitized: My Video')
  })
})

describe('extractMetadata - playlist', () => {
  it('calls yt-dlp with --flat-playlist --dump-single-json for a playlist URL', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const playlistJson = JSON.stringify({
      title: 'My Playlist',
      entries: [
        { id: 'aaa', title: 'Track 1', duration: 120 },
        { id: 'bbb', title: 'Track 2', duration: 180 },
      ],
    })

    const promise = extractMetadata('https://www.youtube.com/playlist?list=PLxxx', 'playlist')

    proc.stdout.emit('data', Buffer.from(playlistJson))
    proc.emit('close', 0)

    await promise

    expect(spawn).toHaveBeenCalledWith(
      'yt-dlp',
      ['--flat-playlist', '--dump-single-json', 'https://www.youtube.com/playlist?list=PLxxx'],
      expect.any(Object),
    )
  })

  it('returns all tracks with correct metadata for a playlist', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const playlistJson = JSON.stringify({
      title: 'My Playlist',
      entries: [
        { id: 'aaa', title: 'Track 1', duration: 120 },
        { id: 'bbb', title: 'Track 2', duration: 180 },
      ],
    })

    const promise = extractMetadata('https://www.youtube.com/playlist?list=PLxxx', 'playlist')

    proc.stdout.emit('data', Buffer.from(playlistJson))
    proc.emit('close', 0)

    const result = await promise

    expect(result.type).toBe('playlist')
    expect(result.title).toBe('sanitized: My Playlist')
    expect(result.suggestedTitle).toBe('suggested: My Playlist')
    expect(result.tracks).toHaveLength(2)
    // AIDEV-NOTE: Per-track suggestedTitle uses sanitizeTitle only (no AI call).
    // AI title cleaning per track is deferred to the import job.
    expect(result.tracks[0]).toEqual({
      videoId: 'aaa',
      title: 'sanitized: Track 1',
      suggestedTitle: 'sanitized: Track 1',
      duration: 120,
    })
    expect(result.tracks[1]).toEqual({
      videoId: 'bbb',
      title: 'sanitized: Track 2',
      suggestedTitle: 'sanitized: Track 2',
      duration: 180,
    })
    expect(result.totalDuration).toBe(300)
    expect(result.truncatedAt).toBeUndefined()
  })

  it('defaults null duration entries to 0', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const playlistJson = JSON.stringify({
      title: 'Playlist',
      entries: [
        { id: 'aaa', title: 'Track 1', duration: null },
        { id: 'bbb', title: 'Track 2', duration: 180 },
      ],
    })

    const promise = extractMetadata('https://www.youtube.com/playlist?list=PLxxx', 'playlist')

    proc.stdout.emit('data', Buffer.from(playlistJson))
    proc.emit('close', 0)

    const result = await promise

    expect(result.tracks[0]!.duration).toBe(0)
    expect(result.totalDuration).toBe(180)
  })
})

describe('extractMetadata - truncation', () => {
  it('sets truncatedAt when cumulative duration exceeds 18000s', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    // 3 tracks: first two total 17500s, third pushes over 18000s
    const entries = [
      { id: 'a', title: 'Track 1', duration: 9000 },
      { id: 'b', title: 'Track 2', duration: 8500 },
      { id: 'c', title: 'Track 3', duration: 3600 },
    ]
    const playlistJson = JSON.stringify({ title: 'Long Playlist', entries })

    const promise = extractMetadata('https://www.youtube.com/playlist?list=PLlong', 'playlist')

    proc.stdout.emit('data', Buffer.from(playlistJson))
    proc.emit('close', 0)

    const result = await promise

    // cumulative after index 0: 9000, after index 1: 17500, after index 2: 21100 (exceeds 18000)
    expect(result.truncatedAt).toBe(2)
    // All 3 tracks are returned but truncatedAt signals where to cut
    expect(result.tracks).toHaveLength(3)
  })

  it('sets truncatedAt to 100 when track count exceeds 100', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    // 101 short tracks (won't trigger duration limit)
    const entries = Array.from({ length: 101 }, (_, i) => ({
      id: `id${i}`,
      title: `Track ${i + 1}`,
      duration: 60,
    }))
    const playlistJson = JSON.stringify({ title: 'Big Playlist', entries })

    const promise = extractMetadata('https://www.youtube.com/playlist?list=PLbig', 'playlist')

    proc.stdout.emit('data', Buffer.from(playlistJson))
    proc.emit('close', 0)

    const result = await promise

    expect(result.truncatedAt).toBe(100)
    expect(result.tracks).toHaveLength(101)
  })

  it('count truncation takes precedence when both limits would trigger', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    // 101 long tracks — count limit (100) hits before duration limit (18000s at 180s/track = 100 tracks)
    const entries = Array.from({ length: 101 }, (_, i) => ({
      id: `id${i}`,
      title: `Track ${i + 1}`,
      duration: 200,
    }))
    const playlistJson = JSON.stringify({ title: 'Big Long Playlist', entries })

    const promise = extractMetadata('https://www.youtube.com/playlist?list=PLbiglong', 'playlist')

    proc.stdout.emit('data', Buffer.from(playlistJson))
    proc.emit('close', 0)

    const result = await promise

    expect(result.truncatedAt).toBe(100)
  })
})

describe('extractMetadata - error handling', () => {
  it('rejects with PipelineError on yt-dlp non-zero exit', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const promise = extractMetadata('https://www.youtube.com/watch?v=abc123', 'video')

    proc.stderr.emit('data', Buffer.from('ERROR: Video unavailable'))
    proc.emit('close', 1)

    await expect(promise).rejects.toThrow(PipelineError)
  })

  it('rejects with a classified error code', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const promise = extractMetadata('https://www.youtube.com/watch?v=abc123', 'video')

    proc.stderr.emit('data', Buffer.from('ERROR: Private video'))
    proc.emit('close', 1)

    const err = await promise.catch((e) => e)
    expect(err).toBeInstanceOf(PipelineError)
    expect((err as PipelineError).code).toBe('VIDEO_PRIVATE')
  })

  it('rejects with PipelineError on spawn error', async () => {
    const proc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(proc as unknown as ChildProcess)

    const promise = extractMetadata('https://www.youtube.com/watch?v=abc123', 'video')

    proc.emit('error', new Error('ENOENT: yt-dlp not found'))

    await expect(promise).rejects.toThrow(PipelineError)
  })
})
