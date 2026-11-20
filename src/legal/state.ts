// Which of the legal pages (privacy, terms, account) is open, if any. A separate store from
// the character's: opening a page never touches a character. The address bar follows it
// (src/app/location.ts): the pages are `#/privacy`, `#/terms` and `#/account`.

import { create } from 'zustand'
import type { LegalPageId } from '../config/legal'

interface LegalState {
  page: LegalPageId | null
  openLegal: (page: LegalPageId) => void
  closeLegal: () => void
}

export const useLegalStore = create<LegalState>((set) => ({
  page: null,
  openLegal: (page) => set({ page }),
  closeLegal: () => set({ page: null }),
}))
