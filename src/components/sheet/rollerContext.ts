// The roller of the sheet as a context, apart from the provider component (Roller.tsx).

import { createContext, useContext } from 'react'
import type { DiceLook } from '../../config/diceLooks'
import type { RollSpec } from './rollSpec'

export interface Roller {
  /** Opens the roll window for this roll. */
  open: (spec: RollSpec) => void
  /** Opens the window for the dice typed; returns what is wrong with them, or null. */
  openFree: (text: string) => string | null
  /** How the dice look on this device. */
  look: DiceLook
  setLook: (look: DiceLook) => void
  resetLook: () => void
}

export const RollerContext = createContext<Roller | null>(null)

/** The roller of the sheet; null outside it, where nothing rolls. */
export function useRoller(): Roller | null {
  return useContext(RollerContext)
}
