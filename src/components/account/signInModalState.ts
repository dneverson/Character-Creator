// Whether the sign-in window is open. Any "Sign in" button opens it; it closes itself when
// the user signs in.

import { create } from 'zustand'

interface SignInModalState {
  open: boolean
  openSignIn: () => void
  closeSignIn: () => void
}

export const useSignInModal = create<SignInModalState>()((set) => ({
  open: false,
  openSignIn: () => set({ open: true }),
  closeSignIn: () => set({ open: false }),
}))
