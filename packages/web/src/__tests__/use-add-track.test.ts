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

describe('useAddTrack', () => {
  beforeEach(() => {
    mockUpdateCard.mockClear()
    mockGetCard.mockClear()
  })

  // AIDEV-NOTE: SDK updateCard takes YotoJson { content, metadata }
  it('adds a track to an empty card', async () => {
    mockGetCard.mockResolvedValue({
      content: { chapters: {} },
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

    expect(mockUpdateCard).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          activity: 'none',
          restricted: false,
          version: 2,
          config: { onlineOnly: true },
          chapters: {
            '00': {
              title: 'My Track',
              format: 'opus',
              channels: 'stereo',
              type: 'audio',
              url: 'https://media.yoto.io/some-file.opus',
            },
          },
        }),
        metadata: { cardId: 'card-1' },
      }),
    )
  })

  it('appends a track after existing chapters', async () => {
    mockGetCard.mockResolvedValue({
      content: {
        chapters: {
          '00': { title: 'First', format: 'opus', channels: 'stereo', type: 'audio', url: 'a' },
          '01': { title: 'Second', format: 'opus', channels: 'stereo', type: 'audio', url: 'b' },
        },
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
    const yotoJson = call[0] as { content: Record<string, unknown> }
    const chapters = yotoJson.content.chapters as Record<string, { title: string }>
    expect(chapters['02']).toEqual({
      title: 'Third Track',
      format: 'opus',
      channels: 'stereo',
      type: 'audio',
      url: 'https://media.yoto.io/third.opus',
    })
    // Existing chapters preserved
    expect(chapters['00']!.title).toBe('First')
    expect(chapters['01']!.title).toBe('Second')
  })

  it('uses zero-padded keys', async () => {
    const existingChapters: Record<string, unknown> = {}
    for (let i = 0; i < 10; i++) {
      existingChapters[String(i).padStart(2, '0')] = {
        title: `Track ${i}`,
        format: 'opus',
        channels: 'stereo',
        type: 'audio',
        url: `url-${i}`,
      }
    }

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
    const yotoJson = call[0] as { content: Record<string, unknown> }
    const chapters = yotoJson.content.chapters as Record<string, { title: string }>
    expect(chapters['10']).toBeDefined()
    expect(chapters['10']!.title).toBe('Eleventh')
  })

  it('includes required card defaults', async () => {
    mockGetCard.mockResolvedValue({
      content: { chapters: {} },
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
    const yotoJson = call[0] as { content: Record<string, unknown> }
    expect(yotoJson.content.activity).toBe('none')
    expect(yotoJson.content.restricted).toBe(false)
    expect(yotoJson.content.version).toBe(2)
    expect(yotoJson.content.config).toEqual({ onlineOnly: true })
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
      resolveGetCard!({ content: { chapters: {} }, metadata: {} })
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
