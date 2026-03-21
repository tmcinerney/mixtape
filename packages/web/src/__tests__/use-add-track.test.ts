import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUpdateCard = vi.fn()
const mockGetCard = vi.fn()

vi.mock('../auth/yoto-provider', () => ({
  useYoto: () => ({
    sdk: {
      content: {
        getCard: mockGetCard,
        updateCard: mockUpdateCard,
      },
    },
    isReady: true,
  }),
}))

import { useAddTrack } from '../hooks/use-add-track'

// AIDEV-NOTE: Test helpers matching the real Yoto API chapter format —
// chapters is an array of { key, title, tracks: [{ url, format, ... }] }
function makeChapter(key: string, title: string, url: string) {
  return {
    key,
    title,
    overlayLabel: String(Number(key) + 1),
    tracks: [{ url, format: 'opus', channels: 'stereo', type: 'audio' }],
  }
}

describe('useAddTrack', () => {
  beforeEach(() => {
    mockUpdateCard.mockClear()
    mockGetCard.mockClear()
  })

  it('adds a track to an empty card', async () => {
    mockGetCard.mockResolvedValue({
      content: { chapters: [] },
      metadata: { cardId: 'card-1' },
    })
    mockUpdateCard.mockResolvedValue(undefined)

    const { result } = renderHook(() => useAddTrack())

    await act(async () => {
      await result.current.addTrack({
        cardId: 'card-1',
        mediaUrl: 'https://media.yoto.io/some-file.opus',
        title: 'My Track',
      })
    })

    const call = mockUpdateCard.mock.calls[0]!
    const payload = call[0] as { content: Record<string, unknown>; cardId: string }
    const chapters = payload.content.chapters as { key: string; title: string; tracks: unknown[] }[]

    expect(payload.cardId).toBe('card-1')
    expect(chapters).toHaveLength(1)
    expect(chapters[0]!.key).toBe('00')
    expect(chapters[0]!.title).toBe('My Track')
    expect(chapters[0]!.tracks[0]).toEqual(
      expect.objectContaining({
        url: 'https://media.yoto.io/some-file.opus',
        format: 'opus',
        channels: 'stereo',
        type: 'audio',
      }),
    )
  })

  it('appends a track after existing chapters', async () => {
    mockGetCard.mockResolvedValue({
      content: {
        chapters: [makeChapter('00', 'First', 'a'), makeChapter('01', 'Second', 'b')],
      },
      metadata: {},
    })
    mockUpdateCard.mockResolvedValue(undefined)

    const { result } = renderHook(() => useAddTrack())

    await act(async () => {
      await result.current.addTrack({
        cardId: 'card-1',
        mediaUrl: 'https://media.yoto.io/third.opus',
        title: 'Third Track',
      })
    })

    const call = mockUpdateCard.mock.calls[0]!
    const payload = call[0] as { content: { chapters: { key: string; title: string }[] } }
    const chapters = payload.content.chapters

    expect(chapters).toHaveLength(3)
    expect(chapters[0]!.title).toBe('First')
    expect(chapters[1]!.title).toBe('Second')
    expect(chapters[2]!.key).toBe('02')
    expect(chapters[2]!.title).toBe('Third Track')
  })

  it('uses zero-padded keys', async () => {
    const existingChapters = Array.from({ length: 10 }, (_, i) =>
      makeChapter(String(i).padStart(2, '0'), `Track ${i}`, `url-${i}`),
    )

    mockGetCard.mockResolvedValue({
      content: { chapters: existingChapters },
      metadata: {},
    })
    mockUpdateCard.mockResolvedValue(undefined)

    const { result } = renderHook(() => useAddTrack())

    await act(async () => {
      await result.current.addTrack({
        cardId: 'card-1',
        mediaUrl: 'https://media.yoto.io/eleventh.opus',
        title: 'Eleventh',
      })
    })

    const call = mockUpdateCard.mock.calls[0]!
    const payload = call[0] as { content: { chapters: { key: string; title: string }[] } }
    const last = payload.content.chapters[10]
    expect(last!.key).toBe('10')
    expect(last!.title).toBe('Eleventh')
  })

  it('includes required card defaults', async () => {
    mockGetCard.mockResolvedValue({
      content: { chapters: [] },
      metadata: {},
    })
    mockUpdateCard.mockResolvedValue(undefined)

    const { result } = renderHook(() => useAddTrack())

    await act(async () => {
      await result.current.addTrack({
        cardId: 'card-1',
        mediaUrl: 'url',
        title: 'Test',
      })
    })

    const call = mockUpdateCard.mock.calls[0]!
    const payload = call[0] as { content: Record<string, unknown>; cardId: string }
    expect(payload.cardId).toBe('card-1')
    expect(payload.content.activity).toBe('yoto_Player')
    expect(payload.content.restricted).toBe(true)
    expect(payload.content.version).toBe('1')
    expect(payload.content.config).toEqual(
      expect.objectContaining({ onlineOnly: false, resumeTimeout: 2592000 }),
    )
  })

  it('sets loading state during operation', async () => {
    let resolveGetCard: (value: unknown) => void
    mockGetCard.mockReturnValue(
      new Promise((resolve) => {
        resolveGetCard = resolve
      }),
    )
    mockUpdateCard.mockResolvedValue(undefined)

    const { result } = renderHook(() => useAddTrack())

    expect(result.current.isAdding).toBe(false)

    let addPromise: Promise<void>
    act(() => {
      addPromise = result.current.addTrack({
        cardId: 'card-1',
        mediaUrl: 'url',
        title: 'Test',
      })
    })

    expect(result.current.isAdding).toBe(true)

    await act(async () => {
      resolveGetCard!({ content: { chapters: [] }, metadata: {} })
      await addPromise!
    })

    expect(result.current.isAdding).toBe(false)
  })

  it('surfaces errors from SDK', async () => {
    mockGetCard.mockRejectedValue(new Error('Card not found'))

    const { result } = renderHook(() => useAddTrack())

    await act(async () => {
      await result.current
        .addTrack({ cardId: 'bad', mediaUrl: 'url', title: 'Test' })
        .catch(() => {})
    })

    expect(result.current.error).toBe('Card not found')
  })
})
