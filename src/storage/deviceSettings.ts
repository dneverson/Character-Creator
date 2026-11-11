// Small settings kept on this device: the theme, table layouts, window sizes, the
// content choice. They are read synchronously, the theme before the first paint,
// so they live in localStorage.
//
// A browser may refuse localStorage (a private window, blocked site data, a full
// quota). A setting then lasts for the visit only: nothing here throws, a read
// answers `null` and a write is dropped.
//
// This is the one place that touches localStorage. The user's characters are not
// settings and do not go here: see `characters.ts`.

/** Text settings by key. The shape matches the Web Storage methods it wraps. */
export interface DeviceSettings {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const deviceSettings: DeviceSettings = {
  getItem(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Kept for this visit only.
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Nothing was stored, or nothing can be.
    }
  },
}
