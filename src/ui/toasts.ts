// The toasts: short confirmations shown in the corner ("Signed in as ..."), put there by
// any code with something to say and drawn by src/components/ToastHost.tsx.

import { create } from 'zustand'

export interface ToastItem {
  id: number
  message: string
}

interface ToastState {
  toasts: ToastItem[]
}

export const useToasts = create<ToastState>()(() => ({ toasts: [] }))

let nextId = 1

/** Show a toast; it goes away on its own, or when the user closes it. */
export function showToast(message: string): void {
  useToasts.setState((state) => ({
    toasts: [...state.toasts, { id: nextId++, message }],
  }))
}

export function dismissToast(id: number): void {
  useToasts.setState((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}
