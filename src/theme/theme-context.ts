import { createContext, useContext } from 'react'
import { appConfig } from '../config/app'
import type { DetailStyle } from './detailStyle'

/** What the user selects. `auto` follows the OS preference. */
export type ThemeMode = 'light' | 'dark' | 'auto'

/** The concrete theme actually applied to the document. */
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeContextValue {
  /** User's selected mode (persisted). */
  mode: ThemeMode
  /** The theme currently applied to <html data-bs-theme>. */
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  /** How every detail pane is drawn (persisted). */
  detailStyle: DetailStyle
  setDetailStyle: (style: DetailStyle) => void
}

export const STORAGE_KEY = appConfig.storageKeys.theme
export const DETAIL_STYLE_KEY = appConfig.storageKeys.detailStyle

export const ThemeContext = createContext<ThemeContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

/** The detail pane style; the plain one where there is no provider (a lone component). */
// eslint-disable-next-line react-refresh/only-export-components
export function useDetailStyle(): DetailStyle {
  return useContext(ThemeContext)?.detailStyle ?? 'standard'
}
