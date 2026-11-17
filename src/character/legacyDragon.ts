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

/**
 * The races whose dragon still leaves the damage type to the player (the Chromatic
 * dragonborn's data gives the dragon no resistance of its own), so the old pick stays.
 */
const KEEPS_TYPE_PICK: ReadonlySet<string> = new Set(['Dragonborn (Chromatic)|FTD'])

/** The races' dragons, for the audit that holds the table to the data. */
export const LEGACY_DRAGONS = DRAGONS

/** The key of a race in the table, from the base race and the book it comes from. */
const keyOf = (race: Pick<RaceRef, 'baseName' | 'baseSource' | 'source'>) =>
  `${race.baseName}|${race.baseSource ?? race.source}`

/**
 * A dragonborn's old resistance pick carried to the dragon it names: the race takes the
 * dragon as its trait and the pick goes (the dragon resists the type itself), unless the
 * race's data still asks for the type. Nothing changes when the race has a trait already,
 * holds no such pick, or the type fits more than one dragon.
 */
export function carriedDragon(
  race: RaceRef | undefined,
  picks: GrantPicks,
): { race: RaceRef | undefined; picks: GrantPicks } {
  const dragons = race && !race.trait ? DRAGONS[keyOf(race)] : undefined
  const old = Object.entries(picks.resist ?? {}).filter(([, tag]) => tag === 'race')
  if (!race || !dragons || old.length !== 1) return { race, picks }
  const type = old[0][0]
  const named = Object.entries(dragons).filter(([, t]) => t === type)
  if (named.length !== 1) return { race, picks }
  if (KEEPS_TYPE_PICK.has(keyOf(race)))
    return { race: { ...race, trait: named[0][0] }, picks }
  const resist: PickMap = { ...picks.resist }
  delete resist[type]
  return { race: { ...race, trait: named[0][0] }, picks: { ...picks, resist } }
}
