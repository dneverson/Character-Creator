// Providers that point the editor sections and the sheet at a character document other
// than the store's open character (see useCharacterDoc.ts for the hooks they use).

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { edited } from './history'
import type { Character } from './model'
import {
  CharacterDocContext,
  type CharacterDoc,
  type UpdateCharacter,
} from './useCharacterDoc'

/** Shows `value` as the current character, and changes it through `value.update`. */
export function CharacterDocProvider({
  value,
  children,
}: {
  value: CharacterDoc
  children: ReactNode
}) {
  return <CharacterDocContext value={value}>{children}</CharacterDocContext>
}

/**
 * A provider whose document is a copy of `initial` held in this component. Edits change
 * the copy only and are recorded in its history like the store records them.
 */
export function DraftCharacterProvider({
  initial,
  children,
}: {
  initial: Character
  children: ReactNode
}) {
  const [draft, setDraft] = useState(initial)
  const current = useRef(initial)
  const update = useCallback<UpdateCharacter>((patch, action) => {
    current.current = edited(current.current, patch, action)
    setDraft(current.current)
  }, [])
  const latest = useCallback(() => current.current, [])
  const value = useMemo(
    () => ({ character: draft, update, latest }),
    [draft, update, latest],
  )
  return <CharacterDocProvider value={value}>{children}</CharacterDocProvider>
}
