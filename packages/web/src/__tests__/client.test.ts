import { describe, expect, it, vi, beforeEach } from 'vitest'

// AIDEV-NOTE: We mock fetch globally at the module level so all client functions
// see the same mock instance without needing to import anything from the browser.
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchMetadata, matchCover, startImport } from '../api/client'
import type { MetadataResponse } from '@mixtape/shared'

function makeOkResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    body: null,
  } as unknown as Response
}

function makeErrorResponse(body: unknown, status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    body: null,
  } as unknown as Response
}

const TOKEN = 'test-token'

describe('fetchMetadata', () => {
  beforeEach(() => mockFetch.mockClear())

  it('calls the correct URL with auth header', async () => {
    const metadata: MetadataResponse = {
      type: 'video',
      title: 'Test Video',
      suggestedTitle: 'Test Video',
      coverOptions: ['https://img.example.com/cover.jpg'],
      totalDuration: 240,
      tracks: [
        { videoId: 'abc123', title: 'Test Video', suggestedTitle: 'Test Video', duration: 240 },
      ],
    }
    mockFetch.mockResolvedValue(makeOkResponse(metadata))

    await fetchMetadata('https://www.youtube.com/watch?v=abc123', TOKEN)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/metadata?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc123',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    )
  })

  it('returns parsed metadata on success', async () => {
    const metadata: MetadataResponse = {
      type: 'playlist',
      title: 'My Playlist',
      suggestedTitle: 'My Playlist',
      coverOptions: [],
      totalDuration: 600,
      tracks: [],
    }
    mockFetch.mockResolvedValue(makeOkResponse(metadata))

    const result = await fetchMetadata('https://www.youtube.com/playlist?list=PLxxx', TOKEN)
    expect(result).toEqual(metadata)
  })

  it('throws on non-ok response with error message from body', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse({ error: 'URL not found' }, 422))

    await expect(fetchMetadata('https://www.youtube.com/watch?v=bad', TOKEN)).rejects.toThrow(
      'URL not found',
    )
  })

  it('throws with status code when error body has no error field', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse({}, 500))

    await expect(fetchMetadata('https://www.youtube.com/watch?v=bad', TOKEN)).rejects.toThrow('500')
  })

  it('returns ambiguous result when server responds with type: ambiguous', async () => {
    const ambiguous = { type: 'ambiguous', videoId: 'abc123', listId: 'PLxxx' }
    mockFetch.mockResolvedValue(makeOkResponse(ambiguous))

    const result = await fetchMetadata('https://www.youtube.com/watch?v=abc123&list=PLxxx', TOKEN)
    expect(result).toEqual(ambiguous)
    expect(result.type).toBe('ambiguous')
  })
})

describe('matchCover', () => {
  beforeEach(() => mockFetch.mockClear())

  it('calls the correct URL with auth header', async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ covers: [] }))

    await matchCover('My Album Title', TOKEN)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/cover/match?title=My%20Album%20Title',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    )
  })

  it('returns the covers array', async () => {
    const covers = ['https://cover1.jpg', 'https://cover2.jpg']
    mockFetch.mockResolvedValue(makeOkResponse({ covers }))

    const result = await matchCover('Some Title', TOKEN)
    expect(result).toEqual(covers)
  })

  it('returns empty array when no covers found', async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ covers: [] }))

    const result = await matchCover('Obscure Title', TOKEN)
    expect(result).toEqual([])
  })
})

describe('startImport', () => {
  beforeEach(() => mockFetch.mockClear())

  it('calls POST /api/jobs/import with correct body and auth header', async () => {
    // Minimal SSE stream that immediately emits the init event
    const initPayload = JSON.stringify({ jobId: 'import-job-1' })
    const sseBytes = new TextEncoder().encode(`event: init\ndata: ${initPayload}\n\n`)

    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: sseBytes })
        .mockResolvedValue({ done: true, value: undefined }),
      cancel: vi.fn(),
    }

    const mockBody = { getReader: () => mockReader }

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: mockBody,
    } as unknown as Response)

    const params = {
      url: 'https://www.youtube.com/playlist?list=PLxxx',
      cardId: 'card-1',
      tracks: [{ videoId: 'v1', title: 'Track 1' }],
      yotoToken: 'yoto-token',
    }

    await startImport(params, TOKEN)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/jobs/import',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
        body: JSON.stringify(params),
      }),
    )
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request'),
    } as unknown as Response)

    const params = {
      url: 'https://www.youtube.com/playlist?list=PLxxx',
      cardId: 'card-1',
      tracks: [],
      yotoToken: 'yoto-token',
    }

    await expect(startImport(params, TOKEN)).rejects.toThrow('Failed to start import: 400')
  })

  it('throws when response has no body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    } as unknown as Response)

    const params = {
      url: 'https://www.youtube.com/playlist?list=PLxxx',
      cardId: 'card-1',
      tracks: [],
      yotoToken: 'yoto-token',
    }

    await expect(startImport(params, TOKEN)).rejects.toThrow('No response body for SSE stream')
  })

  it('returns jobId and eventSource from init event', async () => {
    const initPayload = JSON.stringify({ jobId: 'import-job-42' })
    const sseBytes = new TextEncoder().encode(`event: init\ndata: ${initPayload}\n\n`)

    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: sseBytes })
        .mockResolvedValue({ done: true, value: undefined }),
      cancel: vi.fn(),
    }

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => mockReader },
    } as unknown as Response)

    const params = {
      url: 'https://www.youtube.com/playlist?list=PLxxx',
      cardId: 'card-1',
      tracks: [],
      yotoToken: 'yoto-token',
    }

    const { jobId, eventSource } = await startImport(params, TOKEN)

    expect(jobId).toBe('import-job-42')
    expect(typeof eventSource.addEventListener).toBe('function')
    expect(typeof eventSource.close).toBe('function')
  })
})
