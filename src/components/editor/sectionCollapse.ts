import { createContext, useContext } from 'react'

/**
 * A broadcast command to expand or collapse every EditorSection at once. Each
 * dispatch carries a fresh `nonce` (and a new object identity) so a section
 * re-applies the command even when its target state is unchanged - e.g. pressing
 * "Collapse all" again after a user reopened one section by hand.
 */
export interface SectionCommand {
  open: boolean
  nonce: number
  /** Only this section obeys (opening the one a link points to); every section when absent. */
  only?: string
}

export const SectionCollapseContext = createContext<SectionCommand | null>(null)

export function useSectionCommand(): SectionCommand | null {
  return useContext(SectionCollapseContext)
}
