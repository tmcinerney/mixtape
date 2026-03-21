import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockLoginWithRedirect = vi.fn()
const mockGetAccessTokenSilently = vi.fn()

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: mockIsAuthenticated,
    loginWithRedirect: mockLoginWithRedirect,
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}))

vi.mock('../auth/yoto-provider', () => ({
  useYoto: () => ({
    sdk: {
      content: { getMyCards: vi.fn(), getCard: vi.fn(), updateCard: vi.fn() },
    },
    isReady: true,
  }),
}))

const mockStartJob = vi.fn()
const mockCancelJob = vi.fn()
vi.mock('../api/client', () => ({
  startJob: (...args: unknown[]) => mockStartJob(...args),
  cancelJob: (...args: unknown[]) => mockCancelJob(...args),
}))

let mockIsAuthenticated = false

import { useUploadFlow } from '../hooks/use-upload-flow'

describe('useUploadFlow', () => {
  beforeEach(() => {
    mockIsAuthenticated = false
    mockLoginWithRedirect.mockClear()
    mockGetAccessTokenSilently.mockClear()
    mockStartJob.mockClear()
    mockCancelJob.mockClear()
  })

  it('starts in idle state', () => {
    const { result } = renderHook(() => useUploadFlow())
    expect(result.current.state).toBe('idle')
  })

  it('transitions to selecting-card when URL is submitted', () => {
    const { result } = renderHook(() => useUploadFlow())

    act(() => {
      result.current.submitUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    })

    expect(result.current.state).toBe('selecting-card')
    expect(result.current.youtubeUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('triggers login when not authenticated and card is selected', async () => {
    mockIsAuthenticated = false

    const { result } = renderHook(() => useUploadFlow())

    act(() => {
      result.current.submitUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    })

    await act(async () => {
      result.current.selectCard('card-1')
    })

    expect(mockLoginWithRedirect).toHaveBeenCalled()
  })

  it('transitions to uploading when authenticated and card is selected', async () => {
    mockIsAuthenticated = true
    mockGetAccessTokenSilently.mockResolvedValue('test-token')

    // AIDEV-NOTE: mock EventSource-like object returned from startJob
    const mockEventSource = {
      addEventListener: vi.fn(),
      close: vi.fn(),
    }
    mockStartJob.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })

    const { result } = renderHook(() => useUploadFlow())

    act(() => {
      result.current.submitUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    })

    await act(async () => {
      result.current.selectCard('card-1')
    })

    expect(result.current.state).toBe('uploading')
    expect(mockStartJob).toHaveBeenCalledWith(
      {
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        cardId: 'card-1',
        yotoToken: 'test-token',
      },
      'test-token',
    )
  })

  it('transitions to error state when job start fails', async () => {
    mockIsAuthenticated = true
    mockGetAccessTokenSilently.mockResolvedValue('test-token')
    mockStartJob.mockRejectedValue(new Error('Server error'))

    const { result } = renderHook(() => useUploadFlow())

    act(() => {
      result.current.submitUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    })

    await act(async () => {
      result.current.selectCard('card-1')
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toBe('Server error')
  })

  it('returns to idle when cancelled', async () => {
    mockIsAuthenticated = true
    mockGetAccessTokenSilently.mockResolvedValue('test-token')

    const mockEventSource = {
      addEventListener: vi.fn(),
      close: vi.fn(),
    }
    mockStartJob.mockResolvedValue({ jobId: 'job-1', eventSource: mockEventSource })
    mockCancelJob.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUploadFlow())

    act(() => {
      result.current.submitUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    })

    await act(async () => {
      result.current.selectCard('card-1')
    })

    await act(async () => {
      result.current.cancel()
    })

    expect(result.current.state).toBe('idle')
    expect(mockEventSource.close).toHaveBeenCalled()
  })

  it('returns to idle on reset', () => {
    const { result } = renderHook(() => useUploadFlow())

    act(() => {
      result.current.submitUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.state).toBe('idle')
    expect(result.current.youtubeUrl).toBeNull()
  })
})
