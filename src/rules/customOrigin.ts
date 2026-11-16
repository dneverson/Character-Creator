// Tasha's Cauldron of Everything, Customizing Your Origin (an optional rule, so a switch
// of the character's): each ability score increase the race gives can go to an ability of
// the player's choice. The increases keep their amounts and stay on different abilities,
// as the race had them; what the race gave outright the player places too. A 2024
// species gives no increases (they come from the background), so the rule has nothing
// to move there.

import type { RaceRef } from '../character/model'
import type { AbilityOption } from '../data/abilityOptions'
import type { PlayableRace } from '../data/race'
import { ABILITIES } from '../dice/dice'

export const CUSTOM_ORIGIN_NOTE =
  "Tasha's Customizing Your Origin: each increase goes to an ability of your choice, a different one each."

/** A way to take a race's increases with every one of them placed by the player. */
export function customizedOption(option: AbilityOption): AbilityOption {
  const amounts = [...Object.values(option.fixed), ...option.amounts]
    .filter((n) => n > 0)
    .sort((a, b) => b - a)
  return {
    fixed: {},
    amounts,
    from: [...ABILITIES],
    ...(option.max ? { max: option.max } : {}),
    note: CUSTOM_ORIGIN_NOTE,
  }
}

/** Whether the rule can apply to the race: it gives increases to move. */
export const canCustomizeOrigin = (race: PlayableRace) =>
  race.edition !== 'one' && race.abilityOptions.length > 0

/** The ways to take the race's increases, under the rule when the character uses it. */
export function raceAbilityOptions(race: PlayableRace, ref?: RaceRef): AbilityOption[] {
  return ref?.customOrigin && canCustomizeOrigin(race)
    ? race.abilityOptions.map(customizedOption)
    : race.abilityOptions
}
