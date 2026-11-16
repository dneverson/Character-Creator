// Which weapons are monk weapons, by the Monk class's printing: Martial Arts lets a monk
// use Dexterity with them and roll the Martial Arts die in place of their damage die,
// while the monk wears no armor and wields no shield. A pick of the feature picks table
// marked `monkWeapons` (kensei weapons, a dedicated weapon) adds the weapons it names.

import type { Item } from '../data/itemTypes'

export interface MonkWeaponRule {
  /** The printing of the Monk class the rule is of. */
  classSource: string
  text: string
  /** Whether a weapon is one, by the item and the name of the kind of weapon it is. */
  is: (item: Item, baseName: string) => boolean
}

const codes = (item: Item) => item.weapon?.properties.map((p) => p.code) ?? []

export const MONK_WEAPON_RULES: readonly MonkWeaponRule[] = [
  {
    // PHB p.78: shortswords and simple melee weapons without the two-handed or heavy property.
    classSource: 'PHB',
    text: 'Monk weapons: shortswords and simple melee weapons that are not two-handed or heavy',
    is: (item, baseName) =>
      item.weapon?.melee === true &&
      ((item.weapon.category === 'simple' &&
        !codes(item).some((c) => c === '2H' || c === 'H')) ||
        baseName.toLowerCase() === 'shortsword'),
  },
  {
    // XPHB p.101: simple melee weapons and martial melee weapons with the Light property.
    classSource: 'XPHB',
    text: 'Monk weapons: simple melee weapons and martial melee weapons with the Light property',
    is: (item) =>
      item.weapon?.melee === true &&
      (item.weapon.category === 'simple' ||
        (item.weapon.category === 'martial' && codes(item).includes('L'))),
  },
]
