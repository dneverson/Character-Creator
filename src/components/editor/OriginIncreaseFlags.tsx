import type { Character } from '../../character/model'
import type { PlayableBackground } from '../../data/background'
import type { PlayableRace } from '../../data/race'
import { checkOriginIncreases } from '../../rules/compliance'
import { NonStandardBadge } from '../NonStandardBadge'

/**
 * A flag beside "Ability score increases" for each increase of the species or the
 * background that it does not allow (or that raises a score past its cap). The increase
 * still counts; the flag says what is allowed and what was entered.
 */
export function OriginIncreaseFlags({
  character,
  race,
  background,
}: {
  character: Character
  race?: PlayableRace
  background?: PlayableBackground
}) {
  return checkOriginIncreases(character, race, background).map((d) => (
    <NonStandardBadge key={d.id} reason={d.message} />
  ))
}
