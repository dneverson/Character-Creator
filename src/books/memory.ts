// What the reader remembers on this device: the place each book was left at, and the
// width of the chapter list. Small settings, so they are device settings.

import { appConfig } from '../config/app'
import { deviceSettings } from '../storage/deviceSettings'
import type { DocKind } from './types'

const PLACES_KEY = 'cc-book-places'
const WIDTH_KEY = 'cc-book-sidebar'

export interface RememberedPlace {
  chapter: number
  anchor: string | null
}

type Places = Record<string, RememberedPlace>

const keyOf = (kind: DocKind, id: string) => `${kind}/${id}`

function readPlaces(): Places {
  try {
    const parsed: unknown = JSON.parse(deviceSettings.getItem(PLACES_KEY) ?? '{}')
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Places)
      : {}
  } catch {
    return {}
  }
}

/** Where a book was last left, if it was read before. */
export function recallPlace(kind: DocKind, id: string): RememberedPlace | null {
  const found = readPlaces()[keyOf(kind, id)]
  return found && Number.isInteger(found.chapter) && found.chapter >= 0 ? found : null
}

export function rememberPlace(kind: DocKind, id: string, place: RememberedPlace): void {
  deviceSettings.setItem(
    PLACES_KEY,
    JSON.stringify({ ...readPlaces(), [keyOf(kind, id)]: place }),
  )
}

/** Keep a width within what the chapter list can be. */
export const clampSidebar = (width: number): number =>
  Math.min(appConfig.books.sidebar.max, Math.max(appConfig.books.sidebar.min, width))

export function recallSidebarWidth(): number {
  const saved = Number(deviceSettings.getItem(WIDTH_KEY))
  return Number.isFinite(saved) && saved > 0
    ? clampSidebar(saved)
    : appConfig.books.sidebar.width
}

export function rememberSidebarWidth(width: number): void {
  deviceSettings.setItem(WIDTH_KEY, String(Math.round(width)))
}
