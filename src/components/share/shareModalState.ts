// Whether the Share window is open, and for which character. Any "Share" button opens it.

import { create } from 'zustand'

interface ShareModalState {
  /** The id of the character being shared, or null while the window is closed. */
  characterId: string | null
  openShare: (characterId: string) => void
  closeShare: () => void
}

export const useShareModal = create<ShareModalState>()((set) => ({
  characterId: null,
  openShare: (characterId) => set({ characterId }),
  closeShare: () => set({ characterId: null }),
}))
