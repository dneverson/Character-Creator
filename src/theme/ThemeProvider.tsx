import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { deviceSettings } from '../storage/deviceSettings'
import { isDetailStyle, type DetailStyle } from './detailStyle'
import {
  ThemeContext,
  STORAGE_KEY,
  DETAIL_STYLE_KEY,
  type ResolvedTheme,
  type ThemeMode,
} from './theme-context'

const SYSTEM_DARK = '(prefers-color-scheme: dark)'

function readStoredMode(): ThemeMode {
  const stored = deviceSettings.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'auto'
}

function readStoredDetailStyle(): DetailStyle {
  const stored = deviceSettings.getItem(DETAIL_STYLE_KEY)
  return isDetailStyle(stored) ? stored : 'standard'
}

function canMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

function systemPrefersDark(): boolean {
  return canMatchMedia() && window.matchMedia(SYSTEM_DARK).matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode)
  const [detailStyle, setDetailStyleState] = useState<DetailStyle>(readStoredDetailStyle)
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

  // Every detail pane reads its look from this one attribute and the --detail-* variables.
  useEffect(() => {
    document.documentElement.setAttribute('data-detail-style', detailStyle)
  }, [detailStyle])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    if (next === 'auto') deviceSettings.removeItem(STORAGE_KEY)
    else deviceSettings.setItem(STORAGE_KEY, next)
  }, [])

  const setDetailStyle = useCallback((next: DetailStyle) => {
    setDetailStyleState(next)
    if (next === 'standard') deviceSettings.removeItem(DETAIL_STYLE_KEY)
    else deviceSettings.setItem(DETAIL_STYLE_KEY, next)
  }, [])

  const value = useMemo(
    () => ({ mode, resolved, setMode, detailStyle, setDetailStyle }),
    [mode, resolved, setMode, detailStyle, setDetailStyle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
