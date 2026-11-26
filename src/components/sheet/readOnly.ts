// Whether the sheet is only being looked at: a character shared by link (src/components/
// share). Every control that would change the character is left out when it is true, so
// there is nothing to press that does nothing.

import { createContext, useContext } from 'react'

export const ReadOnlyContext = createContext(false)

/** True inside a sheet that cannot be changed. */
export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext)
}
