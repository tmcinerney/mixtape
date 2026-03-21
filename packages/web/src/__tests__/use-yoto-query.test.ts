import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockUseYoto = vi.fn()
vi.mock('../auth/yoto-provider', () => ({
  useYoto: () => mockUseYoto(),
}))

import { useYotoQuery } from '../hooks/use-yoto-query'

describe('useYotoQuery', () => {
  const mockSdk = { content: {}, icons: {} }

  beforeEach(() => {
    mockUseYoto.mockReturnValue({ sdk: mockSdk, isReady: true })
  })

  it('returns loading state initially', () => {
    const queryFn = vi.fn().mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useYotoQuery(queryFn))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('returns data on success', async () => {
    const queryFn = vi.fn().mockResolvedValue(['card-1', 'card-2'])
    const { result } = renderHook(() => useYotoQuery(queryFn))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual(['card-1', 'card-2'])
    expect(result.current.error).toBeNull()
    expect(queryFn).toHaveBeenCalledWith(mockSdk)
  })

  it('returns error on failure', async () => {
    const queryFn = vi.fn().mockRejectedValue(new Error('SDK failure'))
    const { result } = renderHook(() => useYotoQuery(queryFn))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('SDK failure')
  })

  it('does not fetch when SDK is not ready', () => {
    mockUseYoto.mockReturnValue({ sdk: null, isReady: false })
    const queryFn = vi.fn()
    renderHook(() => useYotoQuery(queryFn))

    expect(queryFn).not.toHaveBeenCalled()
  })

  it('refetch triggers a new fetch', async () => {
    let callCount = 0
    const queryFn = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve(`result-${callCount}`)
    })

    const { result } = renderHook(() => useYotoQuery(queryFn))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe('result-1')

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => expect(result.current.data).toBe('result-2'))
    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  it('ignores stale responses when refetch races', async () => {
    const resolvers: Array<(value: string) => void> = []
    const queryFn = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvers.push(resolve)
        }),
    )

    const { result } = renderHook(() => useYotoQuery(queryFn))

    // Trigger a second fetch before the first resolves
    act(() => {
      result.current.refetch()
    })

    // Resolve the second fetch first, then the first
    resolvers[1]!('second')
    resolvers[0]!('first')

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Should have the second result, not the first (stale)
    expect(result.current.data).toBe('second')
  })
})
