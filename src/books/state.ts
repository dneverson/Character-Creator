// Whether the book reader is open, and where it is. A separate store from the character's:
// reading never touches the character. The address bar follows it (src/app/location.ts):
// the shelf is `#/books`, a place in a book is `#/book/<id>/...` (see ./address.ts).
//
// `openBook` is the one function everything that points into a book calls.

import { create } from 'zustand'
import type { BookPlace } from './types'

interface BookState {
  open: boolean
  /** The place the reader is at; null is the shelf. */
  place: BookPlace | null
  /** Bumps each time a place is asked for, so a reader already there goes there again. */
  request: number
  openBook: (place: BookPlace | null) => void
  closeBooks: () => void
}

export const useBookStore = create<BookState>((set) => ({
  open: false,
  place: null,
  request: 0,
  openBook: (place) => set((s) => ({ open: true, place, request: s.request + 1 })),
  closeBooks: () => set({ open: false, place: null }),
}))

/** Open the reader at a place; null opens the shelf. */
export function openBook(place: BookPlace | null): void {
  useBookStore.getState().openBook(place)
}
