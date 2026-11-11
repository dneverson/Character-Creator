// Shared fixtures for the derived-sheet tests: the armor and weapons of the basic
// catalog, loaded classes with the proficiencies the data gives them, and a character
// builder, so each test states only what it exercises.

import { createCharacter, type Character, type InventoryItem } from '../character/model'
import { ABILITIES, type AbilityKey } from '../dice/dice'
import type { LoadedClass } from '../data/class'
import type { Feat } from '../data/feats'
import type { Item } from '../data/items'
import type { DeriveDeps } from '../derived/sources'
import { makeItem } from './itemFixtures'

const dice = (text: string) => ({ text, average: 0 })
const props = (...codes: string[]) =>
  codes.map((code) => ({ code, name: code, rule: '', label: code }))

const armor = (
  name: string,
  cls: 'light' | 'medium' | 'heavy',
  base: number,
  extra: Partial<NonNullable<Item['armor']>> = {},
) =>
  makeItem({
    name,
    kind: 'armor',
    armor: { base, stealth: false, class: cls, ...extra },
  })

const weapon = (
  name: string,
  category: 'simple' | 'martial',
  melee: boolean,
  damage: string,
  type: string,
  properties: string[],
  extra: Partial<NonNullable<Item['weapon']>> = {},
) =>
  makeItem({
    name,
    kind: 'weapon',
    weapon: {
      category,
      melee,
      damage: dice(damage),
      damageTypes: [type],
      properties: props(...properties),
      mastery: [],
      ...extra,
    },
  })

export const ITEMS: Item[] = [
  armor('Leather Armor', 'light', 11),
  armor('Chain Shirt', 'medium', 13, { dexterityMax: 2 }),
  armor('Half Plate Armor', 'medium', 15, { dexterityMax: 2, stealth: true }),
  armor('Chain Mail', 'heavy', 16, { strength: 13, stealth: true }),
  armor('Plate Armor', 'heavy', 18, { strength: 15, stealth: true }),
  makeItem({
    name: 'Shield',
    kind: 'armor',
    armor: { bonus: 2, stealth: false, class: 'shield' },
  }),
  weapon('Longsword', 'martial', true, '1d8', 'Slashing', ['V'], {
    versatile: dice('1d10'),
  }),
  weapon('Rapier', 'martial', true, '1d8', 'Piercing', ['F']),
  weapon('Dagger', 'simple', true, '1d4', 'Piercing', ['F', 'L', 'T'], {
    range: { normal: 20, long: 60 },
  }),
  weapon('Shortsword', 'martial', true, '1d6', 'Piercing', ['F', 'L']),
  weapon('Greatsword', 'martial', true, '2d6', 'Slashing', ['H', '2H']),
  weapon('Longbow', 'martial', false, '1d8', 'Piercing', ['A', 'H', '2H'], {
    range: { normal: 150, long: 600 },
  }),
  makeItem({
    name: '+1 Longsword',
    kind: 'weapon',
    magic: true,
    weapon: {
      category: 'martial',
      melee: true,
      damage: dice('1d8'),
      versatile: dice('1d10'),
      damageTypes: ['Slashing'],
      properties: props('V'),
      mastery: [],
    },
    bonuses: [{ what: 'weapon attack and damage', value: '+1' }],
  }),
  makeItem({
    name: '+1 Shield',
    kind: 'armor',
    magic: true,
    armor: { bonus: 2, stealth: false, class: 'shield' },
    bonuses: [{ what: 'AC', value: '+1' }],
    attunement: { required: true, optional: false, classes: [] },
  }),
]

export const item = (name: string): Item => {
  const found = ITEMS.find((i) => i.name === name)
  if (!found) throw new Error(`No fixture item ${name}`)
  return found
}

/** An inventory stack of a fixture item. */
export const stack = (
  name: string,
  extra: Partial<InventoryItem> = {},
): InventoryItem => ({
  name,
  source: 'PHB',
  quantity: 1,
  equipped: true,
  ...extra,
})

export function loadedClass(
  name: string,
  armorWords: string[],
  weaponWords: string[],
  extra: Partial<LoadedClass['file']> = {},
): LoadedClass {
  return {
    entry: {
      name,
      source: 'PHB',
      hd: { number: 1, faces: 8 },
      startingProficiencies: { armor: armorWords, weapons: weaponWords },
      classFeatures: [],
    },
    file: extra,
  }
}

export const FIGHTER = loadedClass(
  'Fighter',
  ['light', 'medium', 'heavy', 'shield'],
  ['simple', 'martial'],
)
export const WIZARD = loadedClass('Wizard', [], ['{@item dagger|phb|daggers}'])
export const BARBARIAN = loadedClass(
  'Barbarian',
  ['light', 'medium', 'shield'],
  ['simple', 'martial'],
  {
    classFeature: [
      {
        name: 'Unarmored Defense',
        source: 'PHB',
        className: 'Barbarian',
        classSource: 'PHB',
        level: 1,
        entries: [],
      },
    ],
  },
)

export const deps = (classes: LoadedClass[], items: Item[] = ITEMS): DeriveDeps => ({
  classByKey: new Map(classes.map((c) => [`${c.entry.name}|${c.entry.source}`, c])),
  items,
})

/** A character of one class with its ability scores and equipment. */
export function build(
  className: string,
  level: number,
  scores: Partial<Record<AbilityKey, number>>,
  stacks: InventoryItem[],
): Character {
  const c = createCharacter('Test')
  c.classes = [{ name: className, source: 'PHB', level }]
  for (const key of ABILITIES) {
    c.abilities = { ...c.abilities, [key]: { base: scores[key] ?? 10, other: 0 } }
  }
  c.equipment.items = stacks
  return c
}

export const featOf = (name: string, source: string): Feat => ({
  key: `${name}|${source}`.toLowerCase(),
  name,
  label: name,
  baseName: name,
  source,
  edition: source === 'XPHB' ? 'one' : 'classic',
  prerequisites: [],
  abilityOptions: [],
  repeatable: false,
  skills: { fixed: [], choices: [] },
  hp: { perLevel: 0, flat: 0 },
  entries: [],
})
