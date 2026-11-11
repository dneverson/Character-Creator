import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { deviceSettings } from '../storage/deviceSettings'
import {
  ThemeContext,
  STORAGE_KEY,
  type ResolvedTheme,
  type ThemeMode,
} from './theme-context'

const SYSTEM_DARK = '(prefers-color-scheme: dark)'

function readStoredMode(): ThemeMode {
  const stored = deviceSettings.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'auto'
}

function canMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

function systemPrefersDark(): boolean {
  return canMatchMedia() && window.matchMedia(SYSTEM_DARK).matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode)
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark)

  // Derived during render - no setState-in-effect needed.
  const resolved: ResolvedTheme = mode === 'auto' ? (systemDark ? 'dark' : 'light') : mode

  // Follow live OS preference changes (updates state from an event, not an effect body).
  useEffect(() => {
    if (!canMatchMedia()) return
    const mql = window.matchMedia(SYSTEM_DARK)
    const onChange = () => setSystemDark(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  // Sync the resolved theme to the document (legitimate external-system sync).
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', resolved)
  }, [resolved])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    if (next === 'auto') deviceSettings.removeItem(STORAGE_KEY)
    else deviceSettings.setItem(STORAGE_KEY, next)
  }, [])

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
