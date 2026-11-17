// The choices a feature or a chosen option asks for that are not other features, options
// or proficiencies: a ranger's favored enemies and favored terrains, a kensei's weapons,
// the cantrip an Agonizing Blast empowers, the item a Replicate Magic Item infusion makes.
// Each is a row here, written from the book's text, and offered as a pick card like every
// other choice. How many picks there are is how many of the row's features the character
// has (Favored Enemy at 1st level, one more at 6th and at 14th), the row's count at the
// class level (kensei weapons), or one for each time the option is taken (a repeatable
// invocation). The list is written out where the text lists it, and read from the
// character or the data where the text points at them (`from`). An option may ask for a
// choice of its own (two humanoid races in place of one creature type): its card follows
// the option. The audits in featurePicks.test.ts hold each list to the data, and every
// option whose text asks for a choice to a row, a data field that is read, or an excuse.

import type { Holder } from './holder'
import { EFFECT_ITEM_PICKS, type PickedItemKind } from './optionEffects'

export interface FeaturePickOption {
  /** What is stored for the pick. */
  key: string
  name: string
  /** What taking it means, in plain words. */
  text: string
  /** A further choice the option asks for, of this many per time it is taken. */
  sub?: { title: string; noun: string; count: number; options: FeaturePickOption[] }
  /** The option can be taken more than once (another pair of humanoid races). */
  repeatable?: true
  /** Labelled facts for the detail pane: "Attunement: Yes". */
  facts?: { label: string; value: string }[]
  /** The class level it needs; below it, a pick is flagged (an item of a higher table). */
  minLevel?: number
  /** Why taking it is against the rules, when it is: the pick is flagged, never refused. */
  unmet?: string
  /** The damage type the option stands for, which a rule of the character reads. */
  damageType?: string
  /** The group it counts in, for a pick that needs one of each group (a melee weapon). */
  group?: string
}

/**
 * Where the options of a pick are read from, when the text points at them rather than
 * listing them: the Warlock cantrips the character knows, the weapons of the item catalog
 * without some properties, or the tables of the option's own text.
 */
export type FeaturePickFrom =
  | { kind: 'warlockCantrips' }
  /**
   * The kinds of weapons of the item catalog without some properties, or the named ones;
   * melee ones only when `melee`.
   */
  | { kind: 'weapons'; without: string[]; also: string[]; melee?: true }
  | { kind: 'textTables'; caption: RegExp }
  /**
   * The items of the character's inventory of a kind: a nonmagical one only, for an
   * infusion; a ranged weapon only with the option named, for a pact weapon.
   */
  | {
      kind: 'inventory'
      items: PickedItemKind
      nonmagical?: true
      rangedWith?: string
    }

export interface FeaturePick {
  /** The pick's name in a card and in the key it is stored under. */
  title: string
  /** What is picked, plural. */
  noun: string
  /**
   * The features or options that each give one pick, the first being the one that
   * names it (an option gives one more each time it is taken again).
   */
  holders: Holder[]
  options: FeaturePickOption[]
  /** Read the options from here instead of `options`. */
  from?: FeaturePickFrom
  /** How many picks from each class level of the first holder's class on. */
  byLevel?: Record<number, number>
  /** What the card says about the choice. */
  note: string
  /**
   * The first picks must be one of each of these groups (a kensei's first two weapons:
   * one melee, one ranged): once the picks left could not cover a group still missing,
   * the options of the groups already had are flagged.
   */
  oneOfEach?: { groups: string[]; why: string }
  /** The weapons picked are monk weapons for the character (Martial Arts). */
  monkWeapons?: true
}

const ranger = (name: string): Holder => ({
  classFeature: { className: 'Ranger', source: 'PHB', name },
})

const IMPROVEMENTS = 'Favored Enemy and Natural Explorer improvements'

/** The creature types a favored enemy can be, as the Favored Enemy text lists them. */
export const ENEMY_TYPES = [
  'aberration',
  'beast',
  'celestial',
  'construct',
  'dragon',
  'elemental',
  'fey',
  'fiend',
  'giant',
  'monstrosity',
  'ooze',
  'plant',
  'undead',
] as const

const PLURAL: Record<string, string> = {
  fey: 'Fey',
  monstrosity: 'Monstrosities',
  undead: 'Undead',
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())
const plural = (type: string) => PLURAL[type] ?? `${titleCase(type)}s`

const enemyText = (them: string) =>
  `You have advantage on Wisdom (Survival) checks to track ${them}, and on Intelligence checks to recall information about them.`

/**
 * The humanoid races a favored enemy pair can be: the races the creatures of the books
 * are tagged with. The audit in featurePicks.test.ts fails when a book tags a humanoid
 * with a race that is neither here nor in HUMANOID_TAGS_NOT_RACES.
 */
export const HUMANOID_RACES = [
  'aarakocra',
  'blindheim',
  'bullywug',
  'changeling',
  'derro',
  'dire corby',
  'dragonborn',
  'drow',
  'dwarf',
  'elf',
  'firenewt',
  'genasi',
  'gith',
  'gnoll',
  'gnome',
  'goblin',
  'goblinoid',
  'goliath',
  'grimlock',
  'grippli',
  'grung',
  'half-dragon',
  'half-elf',
  'half-orc',
  'halfling',
  'human',
  'jermlaine',
  'kalashtar',
  'kender',
  'kenku',
  'khoravar',
  'kobold',
  'kraul',
  'kuo-toa',
  'lava child',
  'leonin',
  'lizardfolk',
  'locathah',
  'meazel',
  'merfolk',
  'minotaur',
  'mongrelfolk',
  'murloc',
  'nagpa',
  'orc',
  'quaggoth',
  'sahuagin',
  'saurial',
  'shadar-kai',
  'shifter',
  'simic hybrid',
  'tabaxi',
  'thri-kreen',
  'tiefling',
  'tortle',
  'triton',
  'troglodyte',
  'warforged',
  'xvart',
  'yuan-ti',
] as const

/** The humanoid tags of the creatures that name no race, with why. */
export const HUMANOID_TAGS_NOT_RACES: Record<string, string> = {
  'any race': 'a creature of any race',
  shapechanger: 'a trait, not a race',
  lycanthrope: 'a curse, not a race',
  'half-black dragon': 'a half-dragon, which is on the list',
  barbarian: 'a class, not a race',
  bard: 'a class, not a race',
  cleric: 'a class, not a race',
  druid: 'a class, not a race',
  monk: 'a class, not a race',
  paladin: 'a class, not a race',
  ranger: 'a class, not a race',
  sorcerer: 'a class, not a race',
  warlock: 'a class, not a race',
  wizard: 'a class, not a race',
  mage: 'a profession, not a race',
  healer: 'a profession, not a race',
}

const HUMANOIDS: FeaturePickOption = {
  key: 'humanoids',
  name: 'Two humanoid races',
  text: `Two races of humanoid (such as gnolls and orcs) in place of one creature type. ${enemyText('them')}`,
  repeatable: true,
  sub: {
    title: 'favored humanoid race',
    noun: 'favored humanoid races',
    count: 2,
    options: HUMANOID_RACES.map((race) => ({
      key: race,
      name: titleCase(race),
      text: enemyText(`${race} humanoids`),
    })),
  },
}

/** The terrains a favored terrain can be, as the Natural Explorer text lists them. */
export const TERRAINS = [
  'arctic',
  'coast',
  'desert',
  'forest',
  'grassland',
  'mountain',
  'swamp',
  'Underdark',
] as const

/** The dragons of the Draconic Ancestry table of the 2014 sorcerer, with their damage types. */
export const DRAGON_ANCESTORS = [
  ['Black', 'acid'],
  ['Blue', 'lightning'],
  ['Brass', 'fire'],
  ['Bronze', 'lightning'],
  ['Copper', 'acid'],
  ['Gold', 'fire'],
  ['Green', 'poison'],
  ['Red', 'fire'],
  ['Silver', 'cold'],
  ['White', 'cold'],
] as const

export const FEATURE_PICKS: readonly FeaturePick[] = [
  {
    title: 'Favored Enemy',
    noun: 'favored enemies',
    holders: [
      ranger('Favored Enemy'),
      ranger(IMPROVEMENTS),
      ranger('Favored Enemy improvement'),
    ],
    options: [
      ...ENEMY_TYPES.map((type) => ({
        key: type,
        name: plural(type),
        text: enemyText(plural(type).toLowerCase()),
      })),
      HUMANOIDS,
    ],
    note: 'One creature type, or two humanoid races, at 1st level, and one more at 6th and 14th. Each comes with a language, picked with your languages.',
  },
  {
    title: 'Natural Explorer',
    noun: 'favored terrains',
    holders: [
      ranger('Natural Explorer'),
      ranger(IMPROVEMENTS),
      ranger('Natural Explorer improvement'),
    ],
    options: TERRAINS.map((terrain) => ({
      key: terrain.toLowerCase(),
      name: titleCase(terrain),
      text: `In ${terrain === 'Underdark' ? 'the Underdark' : `${terrain} terrain`}, your proficiency bonus is doubled for Intelligence and Wisdom checks with a skill you are proficient in, and you travel and forage as the feature says.`,
    })),
    note: 'One favored terrain at 1st level, and one more at 6th and 10th.',
  },
  {
    title: 'Dragon Ancestor',
    noun: 'dragon ancestors',
    holders: [
      {
        subclassFeature: {
          className: 'Sorcerer',
          shortName: 'Draconic',
          source: 'PHB',
          name: 'Dragon Ancestor',
        },
      },
    ],
    options: DRAGON_ANCESTORS.map(([dragon, type]) => ({
      key: dragon.toLowerCase(),
      name: dragon,
      damageType: type,
      text: `Your draconic ancestry is a ${dragon.toLowerCase()} dragon: its damage type, ${type}, is the one Elemental Affinity adds your Charisma modifier to and gives resistance to.`,
      facts: [{ label: 'Damage type', value: titleCase(type) }],
    })),
    note: 'One type of dragon at 1st level. Its damage type is used by the features you gain later.',
  },
  {
    title: 'Kensei Weapons',
    noun: 'kensei weapons',
    holders: [
      {
        subclassFeature: {
          className: 'Monk',
          shortName: 'Kensei',
          source: 'XGE',
          name: 'Path of the Kensei',
        },
      },
    ],
    options: [],
    // Simple or martial weapons that lack the heavy and special properties, and the longbow.
    from: { kind: 'weapons', without: ['H', 'S'], also: ['longbow'] },
    byLevel: { 3: 2, 6: 3, 11: 4, 17: 5 },
    note: 'One melee and one ranged weapon at 3rd level, and one more of either at 6th, 11th and 17th. You gain proficiency with them, and they are monk weapons for you.',
    oneOfEach: {
      groups: ['melee', 'ranged'],
      why: 'The kensei weapons of 3rd level are one melee and one ranged weapon - allowed with DM approval',
    },
    monkWeapons: true,
  },
  {
    title: 'Dedicated weapon',
    noun: 'dedicated weapons',
    holders: [
      { classFeature: { className: 'Monk', source: 'TCE', name: 'Dedicated Weapon' } },
    ],
    options: [],
    from: { kind: 'inventory', items: 'monkCandidate' },
    note: 'The weapon in your inventory you last touched at the end of a rest: it counts as a monk weapon until you dedicate another. It must be a simple or martial weapon you are proficient with, without the heavy and special properties.',
    monkWeapons: true,
  },
  {
    title: 'Bladesinging weapon',
    noun: 'bladesinging weapons',
    holders: [
      {
        subclassFeature: {
          className: 'Wizard',
          shortName: 'Bladesinging',
          source: 'TCE',
          name: 'Training in War and Song (Bladesinging)',
        },
      },
    ],
    options: [],
    from: { kind: 'weapons', without: ['2H'], also: [], melee: true },
    note: 'One type of one-handed melee weapon: you gain proficiency with it.',
  },
  ...(
    [
      ['Agonizing Blast', 'deals damage'],
      ['Eldritch Spear', 'deals damage and has a range of 10 feet or more'],
      ['Repelling Blast', 'requires an attack roll'],
    ] as const
  ).map(([name, needs]): FeaturePick => ({
    title: `${name} cantrip`,
    noun: `${name} cantrips`,
    holders: [{ option: `${name}|XPHB` }],
    options: [],
    from: { kind: 'warlockCantrips' },
    note: `One of your known Warlock cantrips that ${needs}, each time you take it.`,
  })),
  {
    title: 'Replicated item',
    noun: 'replicated items',
    holders: [{ option: 'Replicate Magic Item|TCE' }],
    options: [],
    from: {
      kind: 'textTables',
      caption: /^Replicable Items \((\d+)\w+-Level Artificer\)$/,
    },
    note: 'One magic item from the Replicable Items tables of your artificer level or lower, each time you learn the infusion.',
  },
  // The item an option's effects are on (rules/optionEffects.ts).
  ...EFFECT_ITEM_PICKS.map((row): FeaturePick => ({
    title: row.title,
    noun: `${row.title.toLowerCase()}s`,
    holders: [{ option: row.option }],
    options: [],
    from: {
      kind: 'inventory',
      items: row.items,
      ...(row.nonmagical && { nonmagical: row.nonmagical }),
      ...(row.rangedWith && { rangedWith: row.rangedWith }),
    },
    note: row.note,
  })),
]

/**
 * The options whose text asks for a choice made in play, not in building the character:
 * each with why it needs no pick. Every other option whose text asks for one is a row
 * above, or is read from its data (the spells, feats, options and skills it gives).
 */
export const OPTION_CHOICES_IN_PLAY: Record<string, string> = {
  'Beguiling Arrow|XGE': 'an ally chosen when the arrow hits',
  'Call of the Void|WoW': 'the familiar summoned each time the spell is cast',
  'Careful Spell|PHB': 'creatures chosen each time a spell is cast',
  'Careful Spell|XPHB': 'creatures chosen each time a spell is cast',
  'Cloud Rune|TCE': 'a creature chosen when the rune is invoked',
  "Commander's Strike|PHB": 'a creature chosen each time it is used',
  "Commander's Strike|XPHB": 'a creature chosen each time it is used',
  'Disarming Attack|PHB': 'an item chosen each time it is used',
  'Disarming Attack|XPHB': 'an object chosen each time it is used',
  'Elemental Attunement|PHB': 'an effect chosen each time it is used',
  'Maddening Hex|XGE': 'creatures chosen each time it is used',
  'Maneuvering Attack|PHB': 'a creature chosen each time it is used',
  'Maneuvering Attack|XPHB': 'a creature chosen each time it is used',
  'Pact of the Blade|PHB': 'the form of the weapon chosen each time it is created',
  'Pact of the Blade|XPHB': 'the weapon chosen each time it is conjured',
  'Pact of the Chain|PHB': 'the form chosen each time the familiar is summoned',
  'Pact of the Chain|XPHB': 'the form chosen each time the familiar is summoned',
  'Rally|PHB': 'a creature chosen each time it is used',
  'Rally|XPHB': 'a creature chosen each time it is used',
  'Resistant Armor|TCE': 'the damage type chosen each time an item is infused',
  'Seeking Arrow|XGE': 'a creature chosen each time it is used',
  'Seeking Shot|AU': 'a creature chosen each time it is used',
  'Shape the Flowing River|PHB': 'an area chosen each time it is used',
  'Sweeping Attack|PHB': 'a creature chosen each time it is used',
  'Sweeping Attack|XPHB': 'a creature chosen each time it is used',
  'Unbroken Air|PHB': 'a creature chosen each time it is used',
}
