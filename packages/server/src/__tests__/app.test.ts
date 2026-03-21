import { describe, expect, it } from 'vitest'
import { createApp } from '../app'

const app = createApp()

describe('GET /api/health', () => {
  it('returns status ok with a version string', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(
      expect.objectContaining({
        status: 'ok',
        version: expect.any(String),
      }),
    )
  })
})

describe('POST /api/jobs', () => {
  it('returns SSE stream with init event for a valid request', async () => {
    const res = await app.request('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        cardId: 'card-123',
        yotoToken: 'tok-abc',
      }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('rejects a non-YouTube URL with 400', async () => {
    const res = await app.request('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: 'https://vimeo.com/12345',
        cardId: 'card-123',
        yotoToken: 'tok-abc',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects a request with missing fields with 400', async () => {
    const res = await app.request('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtubeUrl: 'https://www.youtube.com/watch?v=abc' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/jobs/:id', () => {
  it('returns 404 for a non-existent job', async () => {
    const res = await app.request('/api/jobs/non-existent', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/jobs', () => {
  it('returns an array of jobs', async () => {
    const res = await app.request('/api/jobs')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('jobs')
    expect(Array.isArray(body.jobs)).toBe(true)
  })
})
