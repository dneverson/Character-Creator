// The open tab of a sheet that is not the store's open character (a shared one). Without
// it the sheet keeps its tab in the store, so the address can name it.

import { createContext } from 'react'

export interface SheetTabControl {
  /** The open tab's id, or null for the first. */
  tab: string | null
  setTab: (tab: string) => void
}

export const SheetTabContext = createContext<SheetTabControl | null>(null)
