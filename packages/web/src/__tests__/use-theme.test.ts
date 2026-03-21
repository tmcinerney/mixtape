import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// AIDEV-NOTE: must mock matchMedia before importing the hook
const mockMatchMedia = vi.fn()

beforeEach(() => {
  // AIDEV-NOTE: mock localStorage to avoid jsdom Storage quirks
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
  it('defaults to light theme when no system preference', () => {
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('detects system dark mode preference', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggles between light and dark', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('persists theme preference to localStorage', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(localStorage.getItem('mixtape-theme')).toBe('dark')
  })

  it('restores theme from localStorage', () => {
    localStorage.setItem('mixtape-theme', 'dark')

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('localStorage overrides system preference', () => {
    mockMatchMedia.mockReturnValue({
      matches: true, // system prefers dark
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
