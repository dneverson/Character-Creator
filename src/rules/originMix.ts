// Taking ability score increases from both origins. The 2014 rules give them to the race and
// the 2024 rules to the background, so a character with increases from both has mixed
// editions (or double-dipped within one): allowed, and flagged with the reason below.

import type { Character } from '../character/model'
import type { PlayableBackground } from '../data/background'
import { editionYear } from '../data/labels'
import type { PlayableRace } from '../data/race'

/** Whether the race and the background both give ability increases. */
export function editionMix(character: Character): boolean {
  const race = character.race
  const raceGrants =
    !!race &&
    (Object.keys(race.abilityFixed).length > 0 ||
      Object.keys(race.abilityChoices).length > 0)
  const bg = character.background
  return raceGrants && !!bg && Object.keys(bg.abilityChoices).length > 0
}

/**
 * Why that is not standard play, naming the edition of each origin as its record has it. A
 * race not loaded yet is named without its edition.
 */
export function editionMixReason(
  race: Pick<PlayableRace, 'edition'> | undefined,
  background: Pick<PlayableBackground, 'edition'>,
): string {
  const raceYear = race && editionYear(race.edition)
  const bgYear = editionYear(background.edition)
  const mixed =
    `This character gets ability bonuses from both ${raceYear ? `a ${raceYear} race` : 'its race'} ` +
    `and a ${bgYear} background. `
  const why =
    raceYear === bgYear
      ? 'Standard play takes them from one of the two, not both.'
      : "Standard play uses one edition's origin rules, not both."
  return mixed + why
}
