import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// AIDEV-NOTE: Auth0 mock must be defined before module-under-test is imported.
// Using a factory fn so each test can override mockIsAuthenticated.
let mockIsAuthenticated = true
const mockLoginWithRedirect = vi.fn()
const mockGetAccessTokenSilently = vi.fn().mockResolvedValue('test-token')

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: vi.fn(() => ({
    isAuthenticated: mockIsAuthenticated,
    getAccessTokenSilently: mockGetAccessTokenSilently,
    loginWithRedirect: mockLoginWithRedirect,
  })),
}))

const mockFetchMetadata = vi.fn()
const mockStartImport = vi.fn()
const mockCancelJob = vi.fn()
vi.mock('../api/client', () => ({
  fetchMetadata: (...args: unknown[]) => mockFetchMetadata(...args),
  startImport: (...args: unknown[]) => mockStartImport(...args),
  cancelJob: (...args: unknown[]) => mockCancelJob(...args),
}))

const mockClassifyUrl = vi.fn()
vi.mock('@mixtape/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mixtape/shared')>()
  return { ...original, classifyUrl: (...args: unknown[]) => mockClassifyUrl(...args) }
})

import { useImportFlow } from '../hooks/use-import-flow'
import type { useAuth0 as UseAuth0Type } from '@auth0/auth0-react'
const { useAuth0 } = (await import('@auth0/auth0-react')) as { useAuth0: typeof UseAuth0Type }

// Helper to create a mock EventSource-like object
function makeMockEventSource() {
  const listeners: Record<string, Array<(e: Event) => void>> = {}

  const eventSource = {
    addEventListener: vi.fn((type: string, cb: (e: Event) => void) => {
      if (!listeners[type]) listeners[type] = []
      listeners[type].push(cb)
    }),
    close: vi.fn(),
    // Helper to fire an event from test code
    emit(type: string, data: unknown) {
      const cbs = listeners[type] ?? []
      const event = new MessageEvent(type, { data: JSON.stringify(data) })
      cbs.forEach((cb) => cb(event))
    },
  }

  return eventSource
}

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PLtest123'
const AMBIGUOUS_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest123'

const MOCK_VIDEO_METADATA = {
  type: 'video' as const,
  title: 'Never Gonna Give You Up',
  suggestedTitle: 'Never Gonna Give You Up',
  coverOptions: ['https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg'],
  totalDuration: 213,
  tracks: [
    {
      videoId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      suggestedTitle: 'Never Gonna Give You Up',
      duration: 213,
    },
  ],
}

const MOCK_PLAYLIST_METADATA = {
  type: 'playlist' as const,
  title: 'My Playlist',
  suggestedTitle: 'My Playlist',
  coverOptions: ['https://example.com/cover.jpg'],
  totalDuration: 600,
  tracks: [
    { videoId: 'vid1', title: 'Track 1', suggestedTitle: 'Track 1', duration: 200 },
    { videoId: 'vid2', title: 'Track 2', suggestedTitle: 'Track 2', duration: 400 },
  ],
}

describe('useImportFlow', () => {
  beforeEach(() => {
    mockIsAuthenticated = true
    mockLoginWithRedirect.mockClear()
    mockGetAccessTokenSilently.mockClear().mockResolvedValue('test-token')
    mockFetchMetadata.mockClear()
    mockStartImport.mockClear()
    mockCancelJob.mockClear()
    mockClassifyUrl.mockClear()
    vi.mocked(useAuth0).mockImplementation(
      () =>
        ({
          isAuthenticated: mockIsAuthenticated,
          getAccessTokenSilently: mockGetAccessTokenSilently,
          loginWithRedirect: mockLoginWithRedirect,
        }) as unknown as ReturnType<typeof UseAuth0Type>,
    )
  })

  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts in idle state', () => {
    const { result } = renderHook(() => useImportFlow())
    expect(result.current.state).toBe('idle')
    expect(result.current.metadata).toBeNull()
    expect(result.current.ambiguousUrl).toBeNull()
    expect(result.current.progress).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.result).toBeNull()
  })

  // ── submitUrl ──────────────────────────────────────────────────────────────

  it('transitions to extracting when video URL is submitted', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'video', videoId: 'dQw4w9WgXcQ' })
    // AIDEV-NOTE: Use a never-resolving promise so we can observe the intermediate
    // 'extracting' state before it transitions to 'confirming'.
    let resolveMetadata!: (v: unknown) => void
    mockFetchMetadata.mockReturnValue(
      new Promise((res) => {
        resolveMetadata = res
      }),
    )

    const { result } = renderHook(() => useImportFlow())

    act(() => {
      result.current.submitUrl(VIDEO_URL)
    })

    // Must flush microtasks (getAccessTokenSilently) but not the metadata fetch
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.state).toBe('extracting')
    expect(mockFetchMetadata).toHaveBeenCalledWith(VIDEO_URL, 'test-token')

    // Let it finish so we don't leak async work
    await act(async () => {
      resolveMetadata(MOCK_VIDEO_METADATA)
    })
  })

  it('transitions to extracting when playlist URL is submitted', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    let resolveMetadata!: (v: unknown) => void
    mockFetchMetadata.mockReturnValue(
      new Promise((res) => {
        resolveMetadata = res
      }),
    )

    const { result } = renderHook(() => useImportFlow())

    act(() => {
      result.current.submitUrl(PLAYLIST_URL)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.state).toBe('extracting')

    await act(async () => {
      resolveMetadata(MOCK_PLAYLIST_METADATA)
    })
  })

  it('transitions to disambiguating when URL is ambiguous', async () => {
    mockClassifyUrl.mockReturnValue({
      type: 'ambiguous',
      videoId: 'dQw4w9WgXcQ',
      listId: 'PLtest123',
    })

    const { result } = renderHook(() => useImportFlow())

    act(() => {
      result.current.submitUrl(AMBIGUOUS_URL)
    })

    expect(result.current.state).toBe('disambiguating')
    expect(result.current.ambiguousUrl).toEqual({ videoId: 'dQw4w9WgXcQ', listId: 'PLtest123' })
  })

  it('sets error and stays idle when URL is rejected', async () => {
    mockClassifyUrl.mockReturnValue({
      type: 'rejected',
      reason: "Watch Later playlists can't be imported",
    })

    const { result } = renderHook(() => useImportFlow())

    act(() => {
      result.current.submitUrl('https://www.youtube.com/playlist?list=WL')
    })

    expect(result.current.state).toBe('idle')
    expect(result.current.error).toBe("Watch Later playlists can't be imported")
  })

  it('calls loginWithRedirect when not authenticated', async () => {
    mockIsAuthenticated = false
    vi.mocked(useAuth0).mockImplementation(
      () =>
        ({
          isAuthenticated: false,
          getAccessTokenSilently: mockGetAccessTokenSilently,
          loginWithRedirect: mockLoginWithRedirect,
        }) as unknown as ReturnType<typeof UseAuth0Type>,
    )

    mockClassifyUrl.mockReturnValue({ type: 'video', videoId: 'dQw4w9WgXcQ' })

    const { result } = renderHook(() => useImportFlow())

    act(() => {
      result.current.submitUrl(VIDEO_URL)
    })

    expect(mockLoginWithRedirect).toHaveBeenCalled()
    expect(result.current.state).toBe('idle')
  })

  // ── extracting → confirming ────────────────────────────────────────────────

  it('transitions to confirming when metadata is resolved', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'video', videoId: 'dQw4w9WgXcQ' })
    mockFetchMetadata.mockResolvedValue(MOCK_VIDEO_METADATA)

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(VIDEO_URL)
    })

    expect(result.current.state).toBe('confirming')
    expect(result.current.metadata).toEqual(MOCK_VIDEO_METADATA)
  })

  it('transitions to idle with error when metadata fetch fails', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'video', videoId: 'dQw4w9WgXcQ' })
    mockFetchMetadata.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(VIDEO_URL)
    })

    expect(result.current.state).toBe('idle')
    expect(result.current.error).toBe('Network error')
  })

  // ── disambiguate ───────────────────────────────────────────────────────────

  it('transitions to extracting when disambiguate called with playlist', async () => {
    mockClassifyUrl.mockReturnValue({
      type: 'ambiguous',
      videoId: 'dQw4w9WgXcQ',
      listId: 'PLtest123',
    })
    // AIDEV-NOTE: Never-resolving promise to catch the intermediate extracting state
    let resolveMetadata!: (v: unknown) => void
    mockFetchMetadata.mockReturnValue(
      new Promise((res) => {
        resolveMetadata = res
      }),
    )

    const { result } = renderHook(() => useImportFlow())

    act(() => {
      result.current.submitUrl(AMBIGUOUS_URL)
    })

    expect(result.current.state).toBe('disambiguating')

    act(() => {
      result.current.disambiguate('playlist')
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.state).toBe('extracting')
    expect(mockFetchMetadata).toHaveBeenCalledWith(
      'https://www.youtube.com/playlist?list=PLtest123',
      'test-token',
    )

    await act(async () => {
      resolveMetadata(MOCK_PLAYLIST_METADATA)
    })
  })

  it('transitions to extracting when disambiguate called with video', async () => {
    mockClassifyUrl.mockReturnValue({
      type: 'ambiguous',
      videoId: 'dQw4w9WgXcQ',
      listId: 'PLtest123',
    })
    let resolveMetadata!: (v: unknown) => void
    mockFetchMetadata.mockReturnValue(
      new Promise((res) => {
        resolveMetadata = res
      }),
    )

    const { result } = renderHook(() => useImportFlow())

    act(() => {
      result.current.submitUrl(AMBIGUOUS_URL)
    })

    act(() => {
      result.current.disambiguate('video')
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.state).toBe('extracting')
    expect(mockFetchMetadata).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'test-token',
    )

    await act(async () => {
      resolveMetadata(MOCK_VIDEO_METADATA)
    })
  })

  it('disambiguate resolves to confirming after metadata fetched', async () => {
    mockClassifyUrl.mockReturnValue({
      type: 'ambiguous',
      videoId: 'dQw4w9WgXcQ',
      listId: 'PLtest123',
    })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const { result } = renderHook(() => useImportFlow())

    act(() => {
      result.current.submitUrl(AMBIGUOUS_URL)
    })

    await act(async () => {
      result.current.disambiguate('playlist')
    })

    expect(result.current.state).toBe('confirming')
    expect(result.current.metadata).toEqual(MOCK_PLAYLIST_METADATA)
  })

  // ── confirmImport ──────────────────────────────────────────────────────────

  it('transitions to importing when confirmImport is called', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    expect(result.current.state).toBe('confirming')

    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })

    expect(result.current.state).toBe('importing')
    expect(mockStartImport).toHaveBeenCalled()
  })

  // ── SSE progress events ────────────────────────────────────────────────────

  it('updates progress on track-start event', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })

    act(() => {
      mockEventSource.emit('track-start', {
        type: 'track-start',
        index: 0,
        total: 2,
        title: 'Track 1',
      })
    })

    expect(result.current.progress).toMatchObject({
      currentTrack: 0,
      totalTracks: 2,
      currentTitle: 'Track 1',
    })
  })

  it('updates trackProgress on track-progress event', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })

    act(() => {
      mockEventSource.emit('track-start', {
        type: 'track-start',
        index: 0,
        total: 2,
        title: 'Track 1',
      })
      mockEventSource.emit('track-progress', {
        type: 'track-progress',
        step: 'download',
        progress: 50,
      })
    })

    expect(result.current.progress?.trackProgress).toEqual({ step: 'download', progress: 50 })
  })

  it('adds to completedTracks on track-complete event', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })

    act(() => {
      mockEventSource.emit('track-start', {
        type: 'track-start',
        index: 0,
        total: 2,
        title: 'Track 1',
      })
      mockEventSource.emit('track-complete', { type: 'track-complete', index: 0 })
    })

    expect(result.current.completedTracks).toHaveLength(1)
    expect(result.current.completedTracks[0]).toMatchObject({ index: 0, status: 'done' })
  })

  it('adds to completedTracks with status skipped on track-skipped event', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })

    act(() => {
      mockEventSource.emit('track-skipped', {
        type: 'track-skipped',
        index: 1,
        title: 'Track 2',
        reason: 'Too long',
      })
    })

    expect(result.current.completedTracks).toHaveLength(1)
    expect(result.current.completedTracks[0]).toMatchObject({
      index: 1,
      title: 'Track 2',
      status: 'skipped',
      reason: 'Too long',
    })
  })

  it('stores cardId from card-created event', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })

    act(() => {
      mockEventSource.emit('card-created', { type: 'card-created', cardId: 'new-card-id' })
    })

    // CardId stored internally; it will surface in the result on complete
    act(() => {
      mockEventSource.emit('complete', {
        type: 'complete',
        cardId: 'new-card-id',
        imported: 2,
        skipped: [],
      })
    })

    expect(result.current.state).toBe('complete')
    expect(result.current.result).toMatchObject({ cardId: 'new-card-id', imported: 2, skipped: [] })
  })

  it('transitions to complete state on complete event', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })

    act(() => {
      mockEventSource.emit('complete', {
        type: 'complete',
        cardId: 'card-123',
        imported: 2,
        skipped: [],
      })
    })

    expect(result.current.state).toBe('complete')
    expect(result.current.result).toMatchObject({ cardId: 'card-123', imported: 2 })
  })

  it('transitions to error state on error event', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })

    act(() => {
      mockEventSource.emit('error', { type: 'error', message: 'Import failed' })
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toBe('Import failed')
  })

  // ── cancel ─────────────────────────────────────────────────────────────────

  it('cancel during importing transitions to cancelled, not idle', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)
    mockCancelJob.mockResolvedValue(undefined)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })

    expect(result.current.state).toBe('importing')

    await act(async () => {
      result.current.cancel()
    })

    expect(result.current.state).toBe('cancelled')
    expect(mockEventSource.close).toHaveBeenCalled()
    expect(mockCancelJob).toHaveBeenCalledWith('job-1', 'test-token')
  })

  it('transitions to cancelled state on server cancelled event', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })

    act(() => {
      mockEventSource.emit('cancelled', { type: 'cancelled', cardId: 'card-123', imported: 1 })
    })

    expect(result.current.state).toBe('cancelled')
    expect(result.current.result).toMatchObject({ cardId: 'card-123', imported: 1 })
  })

  // ── reset ──────────────────────────────────────────────────────────────────

  it('reset from confirming returns to idle and clears state', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'video', videoId: 'dQw4w9WgXcQ' })
    mockFetchMetadata.mockResolvedValue(MOCK_VIDEO_METADATA)

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(VIDEO_URL)
    })
    expect(result.current.state).toBe('confirming')

    act(() => {
      result.current.reset()
    })

    expect(result.current.state).toBe('idle')
    expect(result.current.metadata).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.completedTracks).toHaveLength(0)
  })

  it('reset from complete returns to idle', async () => {
    mockClassifyUrl.mockReturnValue({ type: 'playlist', listId: 'PLtest123' })
    mockFetchMetadata.mockResolvedValue(MOCK_PLAYLIST_METADATA)

    const mockEventSource = makeMockEventSource()
    mockStartImport.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useImportFlow())

    await act(async () => {
      result.current.submitUrl(PLAYLIST_URL)
    })
    await act(async () => {
      result.current.confirmImport({
        cardTitle: 'My Playlist',
        tracks: MOCK_PLAYLIST_METADATA.tracks,
      })
    })
    act(() => {
      mockEventSource.emit('complete', {
        type: 'complete',
        cardId: 'card-123',
        imported: 2,
        skipped: [],
      })
    })

    expect(result.current.state).toBe('complete')

    act(() => {
      result.current.reset()
    })

    expect(result.current.state).toBe('idle')
    expect(result.current.result).toBeNull()
    expect(result.current.completedTracks).toHaveLength(0)
  })
})
