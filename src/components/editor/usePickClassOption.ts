// Taking or giving back one class option (an invocation, a maneuver, a fighting style):
// the one handler of every option card, in the Class & Level section and in Level up.

import { useCallback } from 'react'
import {
  pickClassOption,
  type PickCard as PickCardModel,
  type PickChip,
} from '../../character/picks'
import { useLatestCharacter, useUpdateCharacter } from '../../character/useCharacterDoc'

export function usePickClassOption() {
  const latest = useLatestCharacter()
  const update = useUpdateCharacter()
  return useCallback(
    (card: PickCardModel, chip: PickChip) => {
      const character = latest()
      if (!character) return
      update({
        classOptions: pickClassOption(
          character.classOptions,
          card.tag,
          chip.value,
          chip.state === 'picked',
        ),
      })
    },
    [latest, update],
  )
}
