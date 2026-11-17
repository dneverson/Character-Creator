// A save from before the dragon of a dragonborn was a pick of its own kept the dragon only
// as the damage type the player chose to resist (a `resist` pick of the race). The type
// names the dragon when only one dragon of the race has it; where several do, the save
// cannot say which, so the type stays a pick and the dragon is left to the player.

import type { GrantPicks, PickMap } from './picks'
import type { RaceRef } from './model'

/** The dragons of each race with the damage type each resists, as the races' data has them. */
const DRAGONS: Record<string, Record<string, string>> = {
  'Dragonborn|PHB': {
    Black: 'acid',
    Blue: 'lightning',
    Brass: 'fire',
    Bronze: 'lightning',
    Copper: 'acid',
    Gold: 'fire',
    Green: 'poison',
    Red: 'fire',
    Silver: 'cold',
    White: 'cold',
  },
  'Dragonborn|XPHB': {
    Black: 'acid',
    Blue: 'lightning',
    Brass: 'fire',
    Bronze: 'lightning',
    Copper: 'acid',
    Gold: 'fire',
    Green: 'poison',
    Red: 'fire',
    Silver: 'cold',
    White: 'cold',
  },
  'Dragonborn (Chromatic)|FTD': {
    Black: 'acid',
    Blue: 'lightning',
    Green: 'poison',
    Red: 'fire',
    White: 'cold',
  },
  'Dragonborn (Metallic)|FTD': {
    Brass: 'fire',
    Bronze: 'lightning',
    Copper: 'acid',
    Gold: 'fire',
    Silver: 'cold',
  },
  'Dragonborn (Gem)|FTD': {
    Amethyst: 'force',
    Crystal: 'radiant',
    Emerald: 'psychic',
    Sapphire: 'thunder',
    Topaz: 'necrotic',
  },
}

/** The races' dragons, for the audit that holds the table to the data. */
export const LEGACY_DRAGONS = DRAGONS

/** The key of a race in the table, from the base race and the book it comes from. */
const keyOf = (race: Pick<RaceRef, 'baseName' | 'baseSource' | 'source'>) =>
  `${race.baseName}|${race.baseSource ?? race.source}`

/**
 * A dragonborn's old resistance pick carried to the dragon it names: the race takes the
 * dragon as its trait and the pick goes, as the dragon resists the type itself. A race
 * that has its dragon already loses only a pick of that dragon's own type, which it
 * would hold twice; a pick of another type is a resistance the save had, and stays.
 * Nothing changes when the race holds no such pick, or the type fits more than one dragon.
 */
export function carriedDragon(
  race: RaceRef | undefined,
  picks: GrantPicks,
): { race: RaceRef | undefined; picks: GrantPicks } {
  const dragons = race ? DRAGONS[keyOf(race)] : undefined
  const old = Object.entries(picks.resist ?? {}).filter(([, tag]) => tag === 'race')
  if (!race || !dragons || old.length !== 1) return { race, picks }
  const type = old[0][0]
  let dragon = race.trait
  if (dragon === undefined) {
    const named = Object.keys(dragons).filter((d) => dragons[d] === type)
    if (named.length !== 1) return { race, picks }
    dragon = named[0]
  } else if (dragons[dragon] !== type) return { race, picks }
  const resist: PickMap = { ...picks.resist }
  delete resist[type]
  return { race: { ...race, trait: dragon }, picks: { ...picks, resist } }
}
