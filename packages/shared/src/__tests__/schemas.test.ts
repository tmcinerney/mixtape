import { describe, expect, it } from 'vitest'
import { JobRequestSchema, JobProgressSchema, JobStatusSchema } from '../schemas'

describe('JobRequestSchema', () => {
  it('accepts a valid youtube.com URL with cardId and yotoToken', () => {
    const result = JobRequestSchema.safeParse({
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      cardId: 'card-123',
      yotoToken: 'tok-abc',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a youtu.be short URL', () => {
    const result = JobRequestSchema.safeParse({
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      cardId: 'card-123',
      yotoToken: 'tok-abc',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-YouTube URL', () => {
    const result = JobRequestSchema.safeParse({
      youtubeUrl: 'https://vimeo.com/12345',
      cardId: 'card-123',
      yotoToken: 'tok-abc',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid URL', () => {
    const result = JobRequestSchema.safeParse({
      youtubeUrl: 'not-a-url',
      cardId: 'card-123',
      yotoToken: 'tok-abc',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing cardId', () => {
    const result = JobRequestSchema.safeParse({
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      yotoToken: 'tok-abc',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing yotoToken', () => {
    const result = JobRequestSchema.safeParse({
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      cardId: 'card-123',
    })
    expect(result.success).toBe(false)
  })
})

describe('JobProgressSchema', () => {
  it('accepts a download progress event', () => {
    const result = JobProgressSchema.safeParse({ step: 'download', progress: 50 })
    expect(result.success).toBe(true)
  })

  it('accepts a convert progress event', () => {
    const result = JobProgressSchema.safeParse({ step: 'convert', progress: 75 })
    expect(result.success).toBe(true)
  })

  it('accepts an upload progress event', () => {
    const result = JobProgressSchema.safeParse({ step: 'upload', progress: 100 })
    expect(result.success).toBe(true)
  })

  it('accepts a transcode progress event', () => {
    const result = JobProgressSchema.safeParse({ step: 'transcode', progress: 0 })
    expect(result.success).toBe(true)
  })

  it('accepts a complete event with mediaUrl', () => {
    const result = JobProgressSchema.safeParse({ step: 'complete', mediaUrl: 'yoto:#abc123' })
    expect(result.success).toBe(true)
  })

  it('accepts an error event with message and code', () => {
    const result = JobProgressSchema.safeParse({
      step: 'error',
      message: 'Video not found',
      code: 'VIDEO_NOT_FOUND',
    })
    expect(result.success).toBe(true)
  })

  it('rejects progress below 0', () => {
    const result = JobProgressSchema.safeParse({ step: 'download', progress: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects progress above 100', () => {
    const result = JobProgressSchema.safeParse({ step: 'download', progress: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown step', () => {
    const result = JobProgressSchema.safeParse({ step: 'unknown', progress: 50 })
    expect(result.success).toBe(false)
  })

  it('rejects complete event without mediaUrl', () => {
    const result = JobProgressSchema.safeParse({ step: 'complete' })
    expect(result.success).toBe(false)
  })

  it('rejects error event without message', () => {
    const result = JobProgressSchema.safeParse({ step: 'error', code: 'SOME_CODE' })
    expect(result.success).toBe(false)
  })
})

describe('JobStatusSchema', () => {
  it.each(['queued', 'running', 'complete', 'failed', 'cancelled'] as const)(
    'accepts "%s"',
    (status) => {
      const result = JobStatusSchema.safeParse(status)
      expect(result.success).toBe(true)
    },
  )

  it('rejects an invalid status', () => {
    const result = JobStatusSchema.safeParse('pending')
    expect(result.success).toBe(false)
  })
})
