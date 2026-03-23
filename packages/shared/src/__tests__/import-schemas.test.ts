import { describe, expect, it } from 'vitest'
import {
  MetadataResponseSchema,
  ImportJobRequestSchema,
  ImportProgressSchema,
} from '../import-schemas'

describe('MetadataResponseSchema', () => {
  it('accepts a valid single-video response', () => {
    const result = MetadataResponseSchema.safeParse({
      type: 'video',
      title: 'Rick Astley - Never Gonna Give You Up',
      suggestedTitle: 'Never Gonna Give You Up',
      coverOptions: ['https://cdn.yoto.io/myo-cover/star_lilac.gif'],
      totalDuration: 213,
      tracks: [
        {
          videoId: 'dQw4w9WgXcQ',
          title: 'Rick Astley - Never Gonna Give You Up',
          suggestedTitle: 'Never Gonna Give You Up',
          duration: 213,
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a playlist response with truncation', () => {
    const result = MetadataResponseSchema.safeParse({
      type: 'playlist',
      title: 'Bedtime Stories Collection',
      suggestedTitle: 'Bedtime Stories',
      coverOptions: [
        'https://cdn.yoto.io/myo-cover/book_lilac.gif',
        'https://cdn.yoto.io/myo-cover/star_blue.gif',
      ],
      totalDuration: 18600,
      truncatedAt: 47,
      tracks: [
        { videoId: 'abc123', title: 'Story One', suggestedTitle: 'Story One', duration: 120 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid type', () => {
    const result = MetadataResponseSchema.safeParse({
      type: 'channel',
      title: 'test',
      suggestedTitle: 'test',
      coverOptions: [],
      totalDuration: 0,
      tracks: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('ImportJobRequestSchema', () => {
  it('accepts a request with cardTitle (new card)', () => {
    const result = ImportJobRequestSchema.safeParse({
      url: 'https://www.youtube.com/watch?v=abc',
      cardTitle: 'My Card',
      coverUrl: 'https://cdn.yoto.io/myo-cover/star_blue.gif',
      tracks: [{ videoId: 'abc', title: 'Track 1' }],
      yotoToken: 'tok-123',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a request with cardId (existing card)', () => {
    const result = ImportJobRequestSchema.safeParse({
      url: 'https://www.youtube.com/watch?v=abc',
      cardId: 'card-456',
      tracks: [{ videoId: 'abc', title: 'Track 1' }],
      yotoToken: 'tok-123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a request with neither cardId nor cardTitle', () => {
    const result = ImportJobRequestSchema.safeParse({
      url: 'https://www.youtube.com/watch?v=abc',
      tracks: [{ videoId: 'abc', title: 'Track 1' }],
      yotoToken: 'tok-123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects cardTitle over 100 chars', () => {
    const result = ImportJobRequestSchema.safeParse({
      url: 'https://www.youtube.com/watch?v=abc',
      cardTitle: 'x'.repeat(101),
      tracks: [{ videoId: 'abc', title: 'Track 1' }],
      yotoToken: 'tok-123',
    })
    expect(result.success).toBe(false)
  })
})

describe('ImportProgressSchema', () => {
  it.each([
    { type: 'card-created', cardId: 'card-1' },
    { type: 'track-start', index: 0, total: 5, title: 'Track 1' },
    { type: 'track-progress', step: 'download', progress: 50 },
    { type: 'track-progress', step: 'upload', progress: 100 },
    { type: 'track-progress', step: 'transcode', progress: 75 },
    { type: 'track-complete', index: 0 },
    { type: 'track-skipped', index: 2, title: 'Bad Track', reason: 'Private video' },
    {
      type: 'complete',
      cardId: 'card-1',
      imported: 4,
      skipped: [{ title: 'Bad', reason: 'Private' }],
    },
    { type: 'cancelled', cardId: 'card-1', imported: 3 },
    { type: 'error', message: 'Something went wrong' },
  ])('accepts valid $type event', (event) => {
    const result = ImportProgressSchema.safeParse(event)
    expect(result.success).toBe(true)
  })

  it('rejects unknown type', () => {
    expect(ImportProgressSchema.safeParse({ type: 'unknown' }).success).toBe(false)
  })

  it('rejects track-progress with invalid step', () => {
    expect(
      ImportProgressSchema.safeParse({ type: 'track-progress', step: 'convert', progress: 50 })
        .success,
    ).toBe(false)
  })
})
