import { describe, expect, it, vi, beforeEach } from 'vitest'

// AIDEV-NOTE: Mock global fetch for Yoto API calls — same pattern as yoto-upload.test.ts
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { createCard, addChapterToCard } from '../yoto-cards'

function mockResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body }
}

function makeExistingCard(chapters: unknown[] = []) {
  return {
    card: {
      cardId: 'card-abc',
      content: {
        activity: 'yoto_Player',
        restricted: true,
        version: '1',
        config: { resumeTimeout: 2592000, onlineOnly: false },
        chapters,
      },
      metadata: { title: 'Test Card' },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createCard', () => {
  it('calls POST /content with correct payload structure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ card: { cardId: 'card-123' } }))

    await createCard('My Playlist', undefined, 'test-token')

    const [url, opts] = mockFetch.mock.calls[0]!
    expect(url).toBe('https://api.yotoplay.com/content')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Authorization']).toBe('Bearer test-token')
    expect(opts.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(opts.body as string)
    expect(body.content.activity).toBe('yoto_Player')
    expect(body.content.restricted).toBe(true)
    expect(body.content.version).toBe('1')
    expect(body.content.chapters).toEqual([])
    expect(body.content.config.resumeTimeout).toBe(2592000)
    expect(body.title).toBe('My Playlist')
  })

  it('returns cardId from response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ card: { cardId: 'card-xyz' } }))

    const cardId = await createCard('Title', undefined, 'token')

    expect(cardId).toBe('card-xyz')
  })

  it('sets metadata.cover.imageL when coverUrl is provided', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ card: { cardId: 'card-123' } }))

    await createCard('My Playlist', 'https://cdn.example.com/cover.jpg', 'test-token')

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string)
    expect(body.metadata.cover).toEqual({ imageL: 'https://cdn.example.com/cover.jpg' })
  })

  it('omits cover from metadata when coverUrl is undefined', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ card: { cardId: 'card-123' } }))

    await createCard('My Playlist', undefined, 'test-token')

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string)
    expect(body.metadata.cover).toBeUndefined()
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, false))

    await expect(createCard('Title', undefined, 'token')).rejects.toThrow(/Failed to create card/)
  })
})

describe('addChapterToCard', () => {
  it('fetches existing card via GET /content/{cardId}', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeExistingCard()))
    mockFetch.mockResolvedValueOnce(mockResponse({})) // PUT

    await addChapterToCard(
      'card-abc',
      { title: 'Track 1', mediaUrl: 'yoto:#abc123', index: 0 },
      'test-token',
    )

    const [getUrl, getOpts] = mockFetch.mock.calls[0]!
    expect(getUrl).toBe('https://api.yotoplay.com/content/card-abc')
    expect(getOpts.headers['Authorization']).toBe('Bearer test-token')
    expect(getOpts.method).toBeUndefined() // GET has no method set
  })

  it('calls POST /content (upsert) with merged chapters', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeExistingCard()))
    mockFetch.mockResolvedValueOnce(mockResponse({})) // POST upsert

    await addChapterToCard(
      'card-abc',
      { title: 'Track 1', mediaUrl: 'yoto:#abc123', index: 0 },
      'test-token',
    )

    const [postUrl, postOpts] = mockFetch.mock.calls[1]!
    expect(postUrl).toBe('https://api.yotoplay.com/content?skipMediaFileCheck=true')
    expect(postOpts.method).toBe('POST')
    expect(postOpts.headers['Authorization']).toBe('Bearer test-token')
    expect(postOpts.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(postOpts.body as string)
    expect(body.content.chapters).toHaveLength(1)
    expect(body.content.chapters[0].title).toBe('Track 1')
  })

  it('uses zero-padded key for chapter index', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeExistingCard()))
    mockFetch.mockResolvedValueOnce(mockResponse({}))

    await addChapterToCard(
      'card-abc',
      { title: 'Track 1', mediaUrl: 'yoto:#abc123', index: 0 },
      'test-token',
    )

    const body = JSON.parse(mockFetch.mock.calls[1]![1].body as string)
    expect(body.content.chapters[0].key).toBe('00')
  })

  it('uses zero-padded key for chapter index > 9', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeExistingCard()))
    mockFetch.mockResolvedValueOnce(mockResponse({}))

    await addChapterToCard(
      'card-abc',
      { title: 'Track 12', mediaUrl: 'yoto:#abc123', index: 11 },
      'test-token',
    )

    const body = JSON.parse(mockFetch.mock.calls[1]![1].body as string)
    expect(body.content.chapters[0].key).toBe('11')
  })

  it('includes display.icon16x16 when iconUrl is provided', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeExistingCard()))
    mockFetch.mockResolvedValueOnce(mockResponse({}))

    await addChapterToCard(
      'card-abc',
      {
        title: 'Track 1',
        mediaUrl: 'yoto:#abc123',
        index: 0,
        iconUrl: 'https://cdn.example.com/icon.png',
      },
      'test-token',
    )

    const body = JSON.parse(mockFetch.mock.calls[1]![1].body as string)
    expect(body.content.chapters[0].display).toEqual({
      icon16x16: 'https://cdn.example.com/icon.png',
    })
  })

  it('omits display when iconUrl is not provided', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeExistingCard()))
    mockFetch.mockResolvedValueOnce(mockResponse({}))

    await addChapterToCard(
      'card-abc',
      { title: 'Track 1', mediaUrl: 'yoto:#abc123', index: 0 },
      'test-token',
    )

    const body = JSON.parse(mockFetch.mock.calls[1]![1].body as string)
    expect(body.content.chapters[0].display).toBeUndefined()
  })

  it('retries once on PUT failure and succeeds on retry', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeExistingCard()))
    mockFetch.mockResolvedValueOnce(mockResponse({}, false)) // first PUT fails
    mockFetch.mockResolvedValueOnce(mockResponse({})) // retry succeeds

    await expect(
      addChapterToCard(
        'card-abc',
        { title: 'Track 1', mediaUrl: 'yoto:#abc123', index: 0 },
        'test-token',
      ),
    ).resolves.toBeUndefined()

    // GET + 2x PUT = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('throws after second PUT failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(makeExistingCard()))
    mockFetch.mockResolvedValueOnce(mockResponse({}, false)) // first PUT fails
    mockFetch.mockResolvedValueOnce(mockResponse({}, false)) // retry also fails

    await expect(
      addChapterToCard(
        'card-abc',
        { title: 'Track 1', mediaUrl: 'yoto:#abc123', index: 0 },
        'test-token',
      ),
    ).rejects.toThrow(/Failed to update card after retry/)
  })

  it('throws when initial GET fails', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, false))

    await expect(
      addChapterToCard(
        'card-abc',
        { title: 'Track 1', mediaUrl: 'yoto:#abc123', index: 0 },
        'test-token',
      ),
    ).rejects.toThrow(/Failed to fetch card/)
  })
})
