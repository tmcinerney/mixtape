import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../cover-matcher', () => ({
  matchCovers: vi.fn(),
}))

import { matchCovers } from '../cover-matcher'
import { coverRoutes } from '../routes/cover'

const AUTH_HEADER = { Authorization: 'Bearer tok-abc' }

const mockCovers = [
  'https://cdn.yoto.io/myo-cover/star_blue.gif',
  'https://cdn.yoto.io/myo-cover/rocket_red.gif',
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(matchCovers).mockResolvedValue(mockCovers)
})

describe('GET /api/cover/match', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await coverRoutes.request('/api/cover/match?title=dragons')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns covers array for a valid title', async () => {
    const res = await coverRoutes.request('/api/cover/match?title=dragons', {
      headers: AUTH_HEADER,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ covers: mockCovers })
    expect(matchCovers).toHaveBeenCalledWith('dragons', 5)
  })

  it('handles empty title gracefully', async () => {
    const res = await coverRoutes.request('/api/cover/match', { headers: AUTH_HEADER })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('covers')
    expect(Array.isArray(body.covers)).toBe(true)
    expect(matchCovers).toHaveBeenCalledWith('', 5)
  })

  it('returns covers when title query param is empty string', async () => {
    const res = await coverRoutes.request('/api/cover/match?title=', { headers: AUTH_HEADER })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ covers: mockCovers })
    expect(matchCovers).toHaveBeenCalledWith('', 5)
  })
})
