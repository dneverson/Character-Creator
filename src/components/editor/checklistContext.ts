import { createContext, useContext } from 'react'
import type { Checklist } from '../../derived/checklist'

/** The build checklist of the open character, for the editor sections to mark themselves with. */
export const ChecklistContext = createContext<Checklist | null>(null)

export function useChecklist(): Checklist | null {
  return useContext(ChecklistContext)
}

/** The element id of a section's card (or of the name), which the Done window's links scroll to. */
export const sectionDomId = (id: string) => `editor-section-${id}`
