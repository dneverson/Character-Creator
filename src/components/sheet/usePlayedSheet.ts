import { useMemo } from 'react'
import type { Character } from '../../character/model'
import { useCharacterPart } from '../../character/useCharacterDoc'
import { applyPlayEffects } from '../../play/playEffects'
import { useDerivedSheet } from '../editor/useDerivedSheet'

const selectExhaustion = (character: Character) => character.play.exhaustion
const selectConditions = (character: Character) => character.play.conditions

/**
 * The derived sheet of the character the document holds, with what exhaustion and the
 * conditions do to its numbers. It gives no sheet while the game data it is worked out from
 * is still loading, because until then the numbers are wrong (0 hit points, "Dying"). Used by the sheet and by a shared character's view.
 */
export function usePlayedSheet() {
  const { sheet: built, loading, error } = useDerivedSheet()
  const exhaustion = useCharacterPart(selectExhaustion)
  const conditions = useCharacterPart(selectConditions)
  // In play, the exhaustion level and the conditions change the numbers shown here only.
  const sheet = useMemo(
    () =>
      built && !loading && exhaustion !== undefined && conditions
        ? applyPlayEffects(built, { exhaustion, conditions })
        : undefined,
    [built, loading, exhaustion, conditions],
  )
  return { sheet, loading, error }
}
