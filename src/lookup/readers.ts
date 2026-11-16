// How the entries of the lookup that are not text collections as such are read from the
// data: objects, vehicles, recipes, decks, cards and the item properties, masteries and
// types. Each reader hands back what the shared text description prints: a few labelled
// facts and the text, with the stats of an object or a vehicle written out as entries.

import { damageText, type RawDamage } from '../data/beasts'
import { capitalized } from '../derived/defenses'
import { ABILITIES, abilityMod, formatMod } from '../dice/dice'
import { sizeLabel, speedLabel, type Speed } from '../data/labels'
import type { Entry } from '../text/Entries'
import { stripTags } from '../text/tags'
import { titleCase } from '../text/titleCase'

export interface Fact {
  label: string
  value: string
}

/** What a reader makes of one entry of the data. */
export interface Read {
  /** The name, when the data does not give it as `name`. */
  name?: string
  /** Where a name alone is not enough: the deck of a card. */
  context?: string
  /** Other names the entry is referred to by: the abbreviation of an item property. */
  aliases?: string[]
  facts: Fact[]
  entries: Entry[]
}

/** An entry of the data, as far as the readers look at it. */
export interface Raw {
  name?: string
  source: string
  page?: number
  entries?: Entry[]
  [field: string]: unknown
}

/** A field of the data as one line of text: a word, or a list of them. */
export function factText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number')
    return stripTags(String(value))
  if (Array.isArray(value)) return value.map(factText).filter(Boolean).join(', ')
  return ''
}

const facts = (...pairs: [label: string, value: string | undefined][]): Fact[] =>
  pairs.flatMap(([label, value]) => (value ? [{ label, value }] : []))

const list = (value: unknown): Entry[] => (Array.isArray(value) ? (value as Entry[]) : [])

/** The size of an object or a vehicle: a code or a list of them. */
const sizeOf = (size: unknown): string =>
  sizeLabel(
    Array.isArray(size) ? (size as string[]) : typeof size === 'string' ? [size] : [],
  )

/** "Strength 14 (+2), Dexterity 10 (+0)": the scores the data gives. */
function abilityText(raw: Raw): string {
  return ABILITIES.filter((key) => typeof raw[key] === 'number')
    .map((key) => {
      const score = raw[key] as number
      return `${titleCase(ABILITY_NAMES[key])} ${score} (${formatMod(abilityMod(score))})`
    })
    .join(', ')
}

const ABILITY_NAMES = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
}

const damage = (value: unknown) =>
  capitalized(damageText(value as RawDamage[] | undefined))

/** A block of stats the data keeps as named entries: traits, actions, reactions. */
function namedBlock(label: string, items: unknown): Entry[] {
  const blocks = list(items)
  if (blocks.length === 0) return []
  return [{ type: 'entries', name: label, entries: blocks }]
}

/** Armor class and hit points as one line: "Armor Class 15 (wood), Hit Points 300". */
function durability(part: Record<string, unknown>): string {
  const from = Array.isArray(part.acFrom) ? ` (${part.acFrom.join(', ')})` : ''
  const hp = part.hpNote ? ` (${part.hpNote})` : ''
  return [
    part.ac !== undefined && `Armor Class ${String(part.ac)}${from}`,
    part.hp !== undefined && `Hit Points ${String(part.hp)}${hp}`,
    part.dt !== undefined && `Damage Threshold ${String(part.dt)}`,
  ]
    .filter(Boolean)
    .join(', ')
}

/** The parts of a vehicle (its helm, its weapons) as one entry each, with their stats. */
function parts(label: string, items: unknown): Entry[] {
  const found = Array.isArray(items) ? (items as Record<string, unknown>[]) : []
  if (found.length === 0) return []
  const entries = found.map((part): Entry => {
    const count =
      typeof part.count === 'number' && part.count > 1 ? ` (${part.count})` : ''
    const speeds = list(part.speed).map((s) => {
      const sp = s as { mode?: string; entries?: Entry[] }
      return {
        type: 'entries',
        name: titleCase(sp.mode ?? ''),
        entries: sp.entries ?? [],
      }
    })
    return {
      type: 'entries',
      name: `${String(part.name ?? '')}${count}`,
      entries: [
        durability(part),
        ...list(part.entries),
        ...speeds,
        ...(list(part.action).length > 0
          ? [{ type: 'entries', name: 'Actions', entries: list(part.action) }]
          : []),
      ].filter((e) => e !== ''),
    }
  })
  return [{ type: 'entries', name: label, entries }]
}

/** The stat block of an object. */
export function readObject(raw: Raw): Read {
  return {
    facts: facts(
      ['Size', sizeOf(raw.size)],
      ['Armor Class', factText(raw.ac)],
      ['Hit Points', factText(raw.hp)],
      [
        'Speed',
        typeof raw.speed === 'number' && raw.speed === 0
          ? ''
          : speedLabel(raw.speed as Speed),
      ],
      ['Abilities', abilityText(raw)],
      ['Senses', factText(raw.senses)],
      ['Damage Vulnerabilities', damage(raw.vulnerable)],
      ['Damage Resistances', damage(raw.resist)],
      ['Damage Immunities', damage(raw.immune)],
      ['Condition Immunities', damage(raw.conditionImmune)],
    ),
    entries: [...(raw.entries ?? []), ...namedBlock('Actions', raw.actionEntries)],
  }
}

const VEHICLE_TYPES: Record<string, string> = {
  SHIP: 'Ship',
  SPELLJAMMER: 'Spelljammer vessel',
  INFWAR: 'Infernal war machine',
  ELEMENTAL_AIRSHIP: 'Elemental airship',
  OBJECT: 'Object',
  CREATURE: 'Creature',
}

const countOf = (value: unknown): string =>
  typeof value === 'number' ? String(value) : ''

/** The stat block of a vehicle: what it carries, what it can take, its parts and actions. */
export function readVehicle(raw: Raw): Read {
  const hull = raw.hull as Record<string, unknown> | undefined
  const hp = raw.hp as { hp?: number; dt?: number; mt?: number } | number | undefined
  const hitPoints =
    typeof hp === 'object'
      ? facts(
          ['Hit Points', String(hp.hp ?? '')],
          ['Damage Threshold', countOf(hp.dt)],
          ['Mishap Threshold', countOf(hp.mt)],
        )
      : facts(['Hit Points', factText(hp)])
  const speed = raw.speed
  return {
    facts: [
      ...facts(
        ['Type', VEHICLE_TYPES[String(raw.vehicleType)] ?? ''],
        ['Size', sizeOf(raw.size)],
        ['Terrain', titleCase(factText(raw.terrain))],
        ['Dimensions', factText(raw.dimensions)],
        ['Crew', countOf(raw.capCrew)],
        ['Passengers', countOf(raw.capPassenger)],
        ['Creature capacity', countOf(raw.capCreature)],
        [
          'Cargo capacity',
          typeof raw.capCargo === 'number' ? `${raw.capCargo} tons` : '',
        ],
        ['Armor Class', factText(raw.ac)],
        ['Hull', hull ? durability(hull) : ''],
        [
          'Speed',
          typeof speed === 'object' || typeof speed === 'number'
            ? speedLabel(speed as Speed)
            : '',
        ],
        ['Abilities', abilityText(raw)],
        ['Damage Immunities', damage(raw.immune)],
        ['Condition Immunities', damage(raw.conditionImmune)],
      ),
      ...hitPoints,
    ],
    entries: [
      ...(raw.entries ?? []),
      ...namedBlock('Traits', raw.trait),
      ...parts('Control', raw.control),
      ...parts('Movement', raw.movement),
      ...parts('Weapons', raw.weapon),
      ...namedBlock('Action stations', raw.actionStation),
      ...namedBlock('Actions', raw.action),
      ...namedBlock('Reactions', raw.reaction),
    ],
  }
}

/** 0.33 as "1/3": the amount of an ingredient as a cook writes it. */
function amountText(amount: number): string {
  const whole = Math.floor(amount)
  const part = amount - whole
  const fractions: [number, string][] = [
    [0.125, '1/8'],
    [0.25, '1/4'],
    [0.33, '1/3'],
    [0.375, '3/8'],
    [0.5, '1/2'],
    [0.625, '5/8'],
    [0.66, '2/3'],
    [0.75, '3/4'],
    [0.875, '7/8'],
  ]
  const near = fractions.find(([value]) => Math.abs(value - part) < 0.02)
  if (part < 0.02) return String(whole)
  if (!near) return String(Math.round(amount * 100) / 100)
  return whole > 0 ? `${whole} ${near[1]}` : near[1]
}

/** An ingredient line, with its amounts written in. */
function ingredientText(item: unknown): Entry {
  if (typeof item === 'string') return item
  const { entry, ...amounts } = item as { entry?: string } & Record<string, unknown>
  return (entry ?? '').replace(/\{=(amount\d+)\/[a-z]+\}/g, (_m, key: string) =>
    typeof amounts[key] === 'number' ? amountText(amounts[key]) : '',
  )
}

const RECIPE_DISH = (dishes: unknown): string => titleCase(factText(dishes))

/** A recipe: what it makes, what goes in it, how it is made. */
export function readRecipe(raw: Raw): Read {
  const serves = raw.serves as
    { exact?: number; min?: number; max?: number; note?: string } | undefined
  const people = serves
    ? [
        serves.exact ??
          (serves.min !== undefined ? `${serves.min} to ${serves.max}` : ''),
        serves.note ?? '',
      ]
        .filter((part) => part !== '')
        .join(' ')
    : ''
  return {
    facts: facts(
      ['Recipe type', factText(raw.type)],
      ['Dish', RECIPE_DISH(raw.dishTypes)],
      ['Makes', factText(raw.makes)],
      ['Serves', people],
      ['Allergens', titleCase(factText(raw.allergenGroups))],
    ),
    entries: [
      {
        type: 'entries',
        name: 'Ingredients',
        entries: [{ type: 'list', items: list(raw.ingredients).map(ingredientText) }],
      },
      ...(Array.isArray(raw.equipment)
        ? [
            {
              type: 'entries',
              name: 'Equipment',
              entries: [{ type: 'list', items: list(raw.equipment).map(ingredientText) }],
            },
          ]
        : []),
      { type: 'entries', name: 'Instructions', entries: list(raw.instructions) },
      ...(Array.isArray(raw.noteCook)
        ? [{ type: 'entries', name: 'Notes', entries: list(raw.noteCook) }]
        : []),
    ],
  }
}

/** A deck of cards: what it is and how many cards it holds. */
export function readDeck(raw: Raw): Read {
  const cards = list(raw.cards).reduce<number>(
    (sum, card) => sum + ((card as { count?: number }).count ?? 1),
    0,
  )
  return {
    facts: facts(['Cards', cards > 0 ? String(cards) : '']),
    entries: raw.entries ?? [],
  }
}

/** A card, known by its deck. */
export function readCard(raw: Raw): Read {
  const set = typeof raw.set === 'string' ? raw.set : undefined
  return {
    context: set,
    facts: facts(['Deck', set]),
    entries: raw.entries ?? [],
  }
}

/** An item property: named by what its text calls it, known too by its abbreviation. */
export function readItemProperty(raw: Raw): Read {
  const first = list(raw.entries)[0] as { name?: string } | undefined
  const abbreviation = typeof raw.abbreviation === 'string' ? raw.abbreviation : ''
  return {
    name: first?.name ?? abbreviation,
    aliases: abbreviation ? [abbreviation] : [],
    facts: facts(['Abbreviation', abbreviation]),
    entries: raw.entries ?? [],
  }
}

/** A weapon mastery: its name and its text. */
export const readItemMastery = (raw: Raw): Read => ({
  facts: [],
  entries: raw.entries ?? [],
})

/** An item type, with the text some books add to it in another list of the file. */
export function readItemType(raw: Raw, file: Record<string, unknown>): Read {
  const abbreviation = typeof raw.abbreviation === 'string' ? raw.abbreviation : ''
  const added = list(file.itemTypeAdditionalEntries).filter(
    (extra) =>
      (extra as { appliesTo?: string }).appliesTo === `${abbreviation}|${raw.source}`,
  )
  return {
    aliases: abbreviation ? [abbreviation] : [],
    facts: facts(['Abbreviation', abbreviation]),
    entries: [
      ...(raw.entries ?? []),
      ...added.flatMap((extra) => (extra as Raw).entries ?? []),
    ],
  }
}

/** An item group: the items it stands for, and its text. */
export function readItemGroup(raw: Raw): Read {
  const members = list(raw.items)
    .filter((member): member is string => typeof member === 'string')
    .map((member) => member.split('|')[0])
  return {
    facts: facts(['Includes', members.join(', ')]),
    entries: raw.entries ?? [],
  }
}
