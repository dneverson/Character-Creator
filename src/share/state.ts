// Which shared character is open, if any: the one the address `#/shared/<token>` names.
// A separate store from the character's: viewing a shared character never touches the
// stored ones. The address bar follows it (src/app/location.ts).

import { create } from 'zustand'

interface SharedState {
  token: string | null
  openShared: (token: string) => void
  closeShared: () => void
}

export const useSharedStore = create<SharedState>((set) => ({
  token: null,
  openShared: (token) => set({ token }),
  closeShared: () => set({ token: null }),
}))
