import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// AIDEV-NOTE: must mock matchMedia before importing the hook
const mockMatchMedia = vi.fn()

beforeEach(() => {
  const store: Record<string, string> = {}
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        for (const key of Object.keys(store)) delete store[key]
      },
    },
    writable: true,
    configurable: true,
  })
  document.documentElement.removeAttribute('data-theme')

  mockMatchMedia.mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  window.matchMedia = mockMatchMedia
})

afterEach(() => {
  vi.restoreAllMocks()
})

import { useTheme } from '../hooks/use-theme'

describe('useTheme', () => {
  it('defaults to system preference (light)', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.preference).toBe('system')
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('defaults to system preference (dark)', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    const { result } = renderHook(() => useTheme())

    expect(result.current.preference).toBe('system')
    expect(result.current.theme).toBe('dark')
  })

  it('cycles through light → dark → system', () => {
    const { result } = renderHook(() => useTheme())

    // Start at system (resolves to light since matches: false)
    expect(result.current.preference).toBe('system')

    // system → light
    act(() => result.current.cycleTheme())
    expect(result.current.preference).toBe('light')
    expect(result.current.theme).toBe('light')

    // light → dark
    act(() => result.current.cycleTheme())
    expect(result.current.preference).toBe('dark')
    expect(result.current.theme).toBe('dark')

    // dark → system
    act(() => result.current.cycleTheme())
    expect(result.current.preference).toBe('system')
    expect(result.current.theme).toBe('light') // matches: false → light
  })

  it('persists light/dark to localStorage, clears on system', () => {
    const { result } = renderHook(() => useTheme())

    // system → light (saves to localStorage)
    act(() => result.current.cycleTheme())
    expect(localStorage.getItem('mixtape-theme')).toBe('light')

    // light → dark
    act(() => result.current.cycleTheme())
    expect(localStorage.getItem('mixtape-theme')).toBe('dark')

    // dark → system (clears localStorage)
    act(() => result.current.cycleTheme())
    expect(localStorage.getItem('mixtape-theme')).toBeNull()
  })

  it('restores preference from localStorage', () => {
    localStorage.setItem('mixtape-theme', 'dark')

    const { result } = renderHook(() => useTheme())

    expect(result.current.preference).toBe('dark')
    expect(result.current.theme).toBe('dark')
  })

  it('stored light overrides system dark', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    localStorage.setItem('mixtape-theme', 'light')

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')
  })

  it('listens for system preference changes', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()

    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener,
      removeEventListener,
    })

    const { unmount } = renderHook(() => useTheme())

    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
