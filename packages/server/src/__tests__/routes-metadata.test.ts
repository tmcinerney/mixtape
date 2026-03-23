import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../youtube-metadata', () => ({
  extractMetadata: vi.fn(),
}))

vi.mock('../cover-matcher', () => ({
  matchCovers: vi.fn(),
}))

vi.mock('@mixtape/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mixtape/shared')>()
  return {
    ...actual,
    classifyUrl: vi.fn(),
  }
})

import { extractMetadata } from '../youtube-metadata'
import { matchCovers } from '../cover-matcher'
import { classifyUrl } from '@mixtape/shared'
import { metadataRoutes } from '../routes/metadata'

const AUTH_HEADER = { Authorization: 'Bearer tok-abc' }

const mockMetadata = {
  type: 'video' as const,
  title: 'Test Video',
  suggestedTitle: 'Test Video',
  totalDuration: 180,
  tracks: [{ videoId: 'abc123', title: 'Test Video', suggestedTitle: 'Test Video', duration: 180 }],
}

const mockCovers = [
  'https://cdn.yoto.io/myo-cover/star_blue.gif',
  'https://cdn.yoto.io/myo-cover/rocket_red.gif',
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(matchCovers).mockResolvedValue(mockCovers)
})

describe('GET /api/metadata', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await metadataRoutes.request(
      '/api/metadata?url=https://www.youtube.com/watch?v=abc',
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns 400 when url parameter is missing', async () => {
    const res = await metadataRoutes.request('/api/metadata', { headers: AUTH_HEADER })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('url parameter is required')
  })

  it('returns 400 for an invalid URL', async () => {
    const res = await metadataRoutes.request('/api/metadata?url=not-a-url', {
      headers: AUTH_HEADER,
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid URL')
  })

  it('returns 400 for a rejected URL (Watch Later)', async () => {
    vi.mocked(classifyUrl).mockReturnValue({
      type: 'rejected',
      reason: "Watch Later playlists can't be imported",
    })

    const res = await metadataRoutes.request(
      '/api/metadata?url=https://www.youtube.com/watch?v=abc&list=WL',
      { headers: AUTH_HEADER },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Watch Later')
  })

  it('returns 200 with ambiguous shape for ambiguous URLs', async () => {
    vi.mocked(classifyUrl).mockReturnValue({
      type: 'ambiguous',
      videoId: 'abc123',
      listId: 'PL456',
    })

    const res = await metadataRoutes.request(
      '/api/metadata?url=https://www.youtube.com/watch?v=abc123&list=PL456',
      { headers: AUTH_HEADER },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ type: 'ambiguous', videoId: 'abc123', listId: 'PL456' })
  })

  it('returns 200 with metadata and coverOptions for a valid video URL', async () => {
    vi.mocked(classifyUrl).mockReturnValue({ type: 'video', videoId: 'abc123' })
    vi.mocked(extractMetadata).mockResolvedValue(mockMetadata)

    const res = await metadataRoutes.request(
      '/api/metadata?url=https://www.youtube.com/watch?v=abc123',
      { headers: AUTH_HEADER },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ...mockMetadata, coverOptions: mockCovers })
    expect(extractMetadata).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc123', 'video')
    expect(matchCovers).toHaveBeenCalledWith(mockMetadata.suggestedTitle, 5)
  })

  it('returns 500 when extractMetadata throws', async () => {
    vi.mocked(classifyUrl).mockReturnValue({ type: 'video', videoId: 'abc123' })
    vi.mocked(extractMetadata).mockRejectedValue(new Error('yt-dlp failed'))

    const res = await metadataRoutes.request(
      '/api/metadata?url=https://www.youtube.com/watch?v=abc123',
      { headers: AUTH_HEADER },
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('yt-dlp failed')
  })

  it('returns 500 with fallback message when non-Error is thrown', async () => {
    vi.mocked(classifyUrl).mockReturnValue({ type: 'video', videoId: 'abc123' })
    vi.mocked(extractMetadata).mockRejectedValue('string error')

    const res = await metadataRoutes.request(
      '/api/metadata?url=https://www.youtube.com/watch?v=abc123',
      { headers: AUTH_HEADER },
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to extract metadata')
  })
})
