// Whether Quick lookup is open, and which entry it opens on. A separate store from the
// character's: opening the lookup never touches the character. The address bar follows
// it (src/app/location.ts): the lookup is `#/lookup`, or `#/lookup/<entry id>`.

import { create } from 'zustand'

interface LookupState {
  open: boolean
  /** The entry to open on, when the lookup was opened from a reference to one. */
  entryId: string | null
  /** Bumps each time an entry is asked for, so a table already open opens it again. */
  request: number
  openLookup: (entryId?: string | null) => void
  closeLookup: () => void
}

export const useLookupStore = create<LookupState>((set) => ({
  open: false,
  entryId: null,
  request: 0,
  openLookup: (entryId = null) =>
    set((s) => ({ open: true, entryId, request: s.request + 1 })),
  closeLookup: () => set({ open: false, entryId: null }),
}))
