import { useCallback, useEffect, useState } from 'react'

type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'mixtape-theme'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? getSystemTheme() : pref
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(getInitialPreference)
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(getInitialPreference()))

  // Apply resolved theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Listen for OS preference changes — only matters when preference is 'system'
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      if (preference === 'system') {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [preference])

  // AIDEV-NOTE: Cycles light → dark → system. "System" clears the override
  // and follows the OS preference (including live changes at sunset etc).
  const cycleTheme = useCallback(() => {
    setPreference((prev) => {
      const next: ThemePreference = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'
      if (next === 'system') {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, next)
      }
      const resolved = resolveTheme(next)
      setTheme(resolved)
      return next
    })
  }, [])

  return { theme, preference, cycleTheme } as const
}
