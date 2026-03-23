import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PipelineError } from '@mixtape/shared'

vi.mock('../youtube', () => ({
  downloadAudio: vi.fn(),
}))

vi.mock('../yoto-upload', () => ({
  uploadToYoto: vi.fn(),
}))

vi.mock('../yoto-cards', () => ({
  createCard: vi.fn(),
  addChapterToCard: vi.fn(),
}))

vi.mock('../suggest-title', () => ({
  suggestTitle: vi.fn().mockResolvedValue('Cleaned Title'),
}))

vi.mock('node:fs/promises', () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}))

import { downloadAudio } from '../youtube'
import { uploadToYoto } from '../yoto-upload'
import { createCard, addChapterToCard } from '../yoto-cards'
import { runImport, type ImportConfig } from '../import-runner'

const baseTrack = { videoId: 'abc123', title: 'Track One' }

const singleTrackExistingCard: ImportConfig = {
  url: 'https://www.youtube.com/watch?v=abc123',
  cardId: 'card-existing',
  tracks: [baseTrack],
  yotoToken: 'tok-abc',
}

const multiTrackNewCard: ImportConfig = {
  url: 'https://www.youtube.com/playlist?list=PL123',
  cardTitle: 'My Playlist',
  tracks: [
    { videoId: 'v1', title: 'Track 1' },
    { videoId: 'v2', title: 'Track 2' },
    { videoId: 'v3', title: 'Track 3' },
  ],
  yotoToken: 'tok-abc',
}

function mockSuccessfulDownload() {
  vi.mocked(downloadAudio).mockResolvedValue({
    filePath: '/tmp/test.m4a',
    title: 'Track One',
    duration: 120,
    fileSize: 1024,
  })
}

function mockSuccessfulUpload() {
  vi.mocked(uploadToYoto).mockResolvedValue('yoto:#sha256abc')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(addChapterToCard).mockResolvedValue(undefined)
})

describe('runImport', () => {
  describe('single track, existing card', () => {
    it('emits track-start, track-progress steps, track-complete, complete — no card-created', async () => {
      vi.mocked(downloadAudio).mockImplementation(async (_url, onProgress) => {
        onProgress(50)
        onProgress(100)
        return { filePath: '/tmp/test.m4a', title: 'Track One', duration: 120, fileSize: 1024 }
      })
      vi.mocked(uploadToYoto).mockImplementation(async (_path, _token, onProgress) => {
        onProgress('upload', 50)
        onProgress('upload', 100)
        onProgress('transcode', 100)
        return 'yoto:#sha256abc'
      })

      const onEvent = vi.fn()
      await runImport(singleTrackExistingCard, onEvent)

      const types = onEvent.mock.calls.map(([e]) => e.type)
      expect(types).not.toContain('card-created')
      expect(types).toContain('track-start')
      expect(types).toContain('track-progress')
      expect(types).toContain('track-complete')
      expect(types[types.length - 1]).toBe('complete')

      const startEvent = onEvent.mock.calls.find(([e]) => e.type === 'track-start')?.[0]
      expect(startEvent).toMatchObject({ type: 'track-start', index: 0, total: 1 })

      const completeEvent = onEvent.mock.calls.find(([e]) => e.type === 'complete')?.[0]
      expect(completeEvent).toMatchObject({ type: 'complete', imported: 1, skipped: [] })

      expect(createCard).not.toHaveBeenCalled()
    })
  })

  describe('multi-track, new card', () => {
    it('emits card-created first, then processes all tracks, complete with imported count', async () => {
      vi.mocked(createCard).mockResolvedValue('card-new-123')
      mockSuccessfulDownload()
      mockSuccessfulUpload()

      const onEvent = vi.fn()
      await runImport(multiTrackNewCard, onEvent)

      const types = onEvent.mock.calls.map(([e]) => e.type)
      expect(types[0]).toBe('card-created')

      const cardCreated = onEvent.mock.calls[0]![0]
      expect(cardCreated).toMatchObject({ type: 'card-created', cardId: 'card-new-123' })

      const completeEvent = onEvent.mock.calls.find(([e]) => e.type === 'complete')?.[0]
      expect(completeEvent).toMatchObject({
        type: 'complete',
        cardId: 'card-new-123',
        imported: 3,
        skipped: [],
      })

      expect(createCard).toHaveBeenCalledWith('My Playlist', undefined, 'tok-abc')
      expect(addChapterToCard).toHaveBeenCalledTimes(3)
    })
  })

  describe('track failure (best-effort)', () => {
    it('skips failing track and continues processing remaining tracks', async () => {
      vi.mocked(createCard).mockResolvedValue('card-456')
      const error = new PipelineError('Video not found', 'VIDEO_NOT_FOUND')

      vi.mocked(downloadAudio)
        .mockResolvedValueOnce({
          filePath: '/tmp/t1.m4a',
          title: 'T1',
          duration: 60,
          fileSize: 512,
        })
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          filePath: '/tmp/t3.m4a',
          title: 'T3',
          duration: 60,
          fileSize: 512,
        })
      mockSuccessfulUpload()

      const onEvent = vi.fn()
      await runImport(multiTrackNewCard, onEvent)

      const skippedEvents = onEvent.mock.calls
        .filter(([e]) => e.type === 'track-skipped')
        .map(([e]) => e)
      expect(skippedEvents).toHaveLength(1)
      expect(skippedEvents[0]).toMatchObject({
        type: 'track-skipped',
        index: 1,
        reason: 'Video unavailable',
      })

      const completeEvent = onEvent.mock.calls.find(([e]) => e.type === 'complete')?.[0]
      expect(completeEvent).toMatchObject({
        imported: 2,
        skipped: expect.arrayContaining([expect.objectContaining({ reason: 'Video unavailable' })]),
      })
    })
  })

  describe('download retry', () => {
    it('retries on network error and succeeds on second attempt', async () => {
      mockSuccessfulDownload()
      // First call throws a generic network error, second succeeds
      vi.mocked(downloadAudio)
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce({
          filePath: '/tmp/test.m4a',
          title: 'Track One',
          duration: 120,
          fileSize: 1024,
        })
      mockSuccessfulUpload()

      const onEvent = vi.fn()
      await runImport(singleTrackExistingCard, onEvent)

      expect(downloadAudio).toHaveBeenCalledTimes(2)
      const completeEvent = onEvent.mock.calls.find(([e]) => e.type === 'complete')?.[0]
      expect(completeEvent).toMatchObject({ imported: 1 })
    })
  })

  describe('download retry exhausted', () => {
    it('skips the track when both retry attempts fail', async () => {
      vi.mocked(downloadAudio).mockRejectedValue(new Error('persistent network error'))
      mockSuccessfulUpload()

      const onEvent = vi.fn()
      await runImport(singleTrackExistingCard, onEvent)

      expect(downloadAudio).toHaveBeenCalledTimes(2)
      const skippedEvents = onEvent.mock.calls.filter(([e]) => e.type === 'track-skipped')
      expect(skippedEvents).toHaveLength(1)

      const completeEvent = onEvent.mock.calls.find(([e]) => e.type === 'complete')?.[0]
      expect(completeEvent).toMatchObject({ imported: 0 })
    })
  })

  describe('cancellation', () => {
    it('emits cancelled after completing track 1 when signal is aborted', async () => {
      vi.mocked(createCard).mockResolvedValue('card-cancel')
      const controller = new AbortController()

      vi.mocked(downloadAudio).mockImplementation(async () => {
        // Abort after the first track download starts
        controller.abort()
        return { filePath: '/tmp/test.m4a', title: 'Track 1', duration: 120, fileSize: 1024 }
      })
      mockSuccessfulUpload()

      const config: ImportConfig = {
        url: 'https://www.youtube.com/playlist?list=PL123',
        cardTitle: 'Test Card',
        tracks: [
          { videoId: 'v1', title: 'Track 1' },
          { videoId: 'v2', title: 'Track 2' },
        ],
        yotoToken: 'tok-abc',
      }

      const onEvent = vi.fn()
      await runImport(config, onEvent, controller.signal)

      const types = onEvent.mock.calls.map(([e]) => e.type)
      expect(types).toContain('cancelled')
      expect(types).not.toContain('complete')

      const cancelledEvent = onEvent.mock.calls.find(([e]) => e.type === 'cancelled')?.[0]
      // Track 1 completed before cancellation was checked between tracks
      expect(cancelledEvent).toMatchObject({ type: 'cancelled', imported: 1 })
    })
  })

  describe('card creation failure', () => {
    it('emits error event and throws when card creation fails', async () => {
      vi.mocked(createCard).mockRejectedValue(new Error('API error: 503'))

      const config: ImportConfig = {
        url: 'https://www.youtube.com/playlist?list=PL123',
        cardTitle: 'New Card',
        tracks: [{ videoId: 'v1', title: 'Track 1' }],
        yotoToken: 'tok-abc',
      }

      const onEvent = vi.fn()
      await expect(runImport(config, onEvent)).rejects.toThrow('API error: 503')

      const errorEvent = onEvent.mock.calls.find(([e]) => e.type === 'error')?.[0]
      expect(errorEvent).toMatchObject({ type: 'error', message: 'API error: 503' })
    })
  })
})
