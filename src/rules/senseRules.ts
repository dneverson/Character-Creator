// The senses that something the character holds gives and the data states in text only:
// a feature, an option or an item (equipped, and attuned when it asks for attunement).
// The senses of a species and of a feat are data and are read from it. A row names its
// holder, so the audit in speedRules.test.ts can tell a sense covered here from one a book
// added.

import type { Holder } from './holder'

export interface SenseRule {
  holder: Holder
  label: string
  text: string
  /** The sense: a seeing rule of its own ("devil's sight") is a sense of the sheet too. */
  sense: 'darkvision' | 'blindsight' | 'truesight' | 'tremorsense' | "devil's sight"
  range: number
  /**
   * When the character already has the sense, its range grows by this many feet instead
   * (Umbral Sight). `fromRace`: only a species' sense counts as already had.
   */
  increase?: { range: number; fromRace?: boolean }
  /** A condition the sheet cannot check: the sense shows, but is not counted. */
  when?: string
}

const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})

const subclassFeature = (
  className: string,
  shortName: string,
  source: string,
  name: string,
): Holder => ({ subclassFeature: { className, shortName, source, name } })

const FEATURE_SENSE_RULES: readonly SenseRule[] = [
  {
    holder: { reward: 'Boon of Truesight|DMG' },
    label: 'Boon of Truesight',
    text: 'Boon of Truesight: you have truesight out to a range of 60 feet.',
    sense: 'truesight',
    range: 60,
  },
  {
    holder: { reward: 'Yuan-Ti Pureblood Transformation|ToA' },
    label: 'Yuan-Ti Pureblood Transformation',
    text: 'Yuan-Ti Pureblood Transformation, Darkvision: you can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
    sense: 'darkvision',
    range: 60,
  },
  {
    holder: { reward: 'Blessing of Dumathoin|PaBTSO' },
    label: 'Blessing of Dumathoin',
    text: 'Blessing of Dumathoin: you gain darkvision (60 feet, the range of the rules for darkvision).',
    sense: 'darkvision',
    range: 60,
  },
  {
    holder: { reward: 'Charm of Khyber|EFA' },
    label: 'Charm of Khyber',
    text: 'Charm of Khyber: while you have the charm, you have darkvision with a range of 120 feet.',
    sense: 'darkvision',
    range: 120,
  },
  {
    holder: { reward: 'Dark Gift of Yrrga, the Eye of Shadows|CoS' },
    label: 'Dark Gift of Yrrga',
    text: 'Dark Gift of Yrrga: you have truesight out to a range of 60 feet, for 30 days.',
    sense: 'truesight',
    range: 60,
  },
  {
    holder: { reward: 'Draconic Senses|FTD' },
    label: 'Draconic Senses',
    text: 'Draconic Senses: you have blindsight to a range of 10 feet.',
    sense: 'blindsight',
    range: 10,
  },
  {
    holder: { option: 'Blind Fighting|TCE' },
    label: 'Blind Fighting',
    text: 'Blind Fighting: you have blindsight with a range of 10 feet.',
    sense: 'blindsight',
    range: 10,
  },
  ...(['PHB', 'XPHB'] as const).map((source): SenseRule => ({
    holder: { option: `Devil's Sight|${source}` },
    label: "Devil's Sight",
    text: "Devil's Sight: you can see normally in darkness, both magical and nonmagical, to a distance of 120 feet.",
    sense: "devil's sight",
    range: 120,
  })),
  {
    holder: { option: 'Witch Sight|XPHB' },
    label: 'Witch Sight',
    text: 'Witch Sight: you have truesight with a range of 30 feet.',
    sense: 'truesight',
    range: 30,
  },
  {
    holder: { option: 'Stone Rune|TCE' },
    label: 'Stone Rune',
    text: 'Stone Rune: while wearing or carrying an object inscribed with this rune, you have darkvision out to a range of 120 feet.',
    sense: 'darkvision',
    range: 120,
  },
  {
    holder: classFeature('Ranger', 'XPHB', 'Feral Senses'),
    label: 'Feral Senses',
    text: 'Feral Senses: you have blindsight with a range of 30 feet.',
    sense: 'blindsight',
    range: 30,
  },
  {
    holder: classFeature('Demon Hunter', 'WoW', 'Improved Spectral Sight'),
    label: 'Improved Spectral Sight',
    text: 'Improved Spectral Sight: you have truesight with a range of 30 feet.',
    sense: 'truesight',
    range: 30,
  },
  {
    holder: subclassFeature('Demon Hunter', 'Demon Hunter', 'WoW', 'Spectral Sight'),
    label: 'Spectral Sight',
    text: 'Spectral Sight: you have blindsight with a range of 10 feet.',
    sense: 'blindsight',
    range: 10,
  },
  {
    holder: subclassFeature('Cleric', 'Twilight', 'TCE', 'Eyes of Night'),
    label: 'Eyes of Night',
    text: 'Eyes of Night: you have darkvision out to a range of 300 feet.',
    sense: 'darkvision',
    range: 300,
  },
  {
    holder: subclassFeature('Monk', 'Ascendant Dragon', 'FTD', 'Ascendant Aspect'),
    label: 'Ascendant Aspect',
    text: 'Ascendant Aspect: you gain blindsight out to 10 feet.',
    sense: 'blindsight',
    range: 10,
  },
  {
    holder: subclassFeature('Monk', 'Shadow', 'XPHB', 'Darkvision'),
    label: 'Darkvision (Warrior of Shadow)',
    text: 'Darkvision (Warrior of Shadow): you gain darkvision with a range of 60 feet. If you already have darkvision, its range increases by 60 feet.',
    sense: 'darkvision',
    range: 60,
    increase: { range: 60 },
  },
  {
    holder: subclassFeature('Ranger', 'Gloom Stalker', 'XGE', 'Umbral Sight'),
    label: 'Umbral Sight',
    text: 'Umbral Sight: you gain darkvision out to a range of 60 feet. If you already have darkvision from your race, its range increases by 30 feet.',
    sense: 'darkvision',
    range: 60,
    increase: { range: 30, fromRace: true },
  },
  {
    holder: subclassFeature('Ranger', 'Gloom Stalker', 'XPHB', 'Umbral Sight'),
    label: 'Umbral Sight',
    text: 'Umbral Sight: you gain darkvision with a range of 60 feet. If you already have darkvision when you gain this feature, its range increases by 60 feet.',
    sense: 'darkvision',
    range: 60,
    increase: { range: 60 },
  },
  {
    holder: subclassFeature('Sorcerer', 'Shadow', 'XGE', 'Eyes of the Dark'),
    label: 'Eyes of the Dark',
    text: 'Eyes of the Dark: you have darkvision with a range of 120 feet.',
    sense: 'darkvision',
    range: 120,
  },
  ...(['darkvision', 'blindsight'] as const).map((sense): SenseRule => ({
    holder: subclassFeature('Sorcerer', 'Shadow', 'RHW', 'Power of Shadow'),
    label: 'Power of Shadow',
    text: 'Power of Shadow: you have darkvision with a range of 120 feet and blindsight with a range of 10 feet.',
    sense,
    range: sense === 'darkvision' ? 120 : 10,
  })),
]

/** An item's sense, its text read from the book; `extra` is the range it adds when had. */
const itemSense = (
  key: string,
  sense: SenseRule['sense'],
  range: number,
  text: string,
  extra?: number,
  when?: string,
): SenseRule => ({
  holder: { item: key },
  label: key.split('|')[0],
  text: `${key.split('|')[0]}: ${text}`,
  sense,
  range,
  ...(extra ? { increase: { range: extra } } : {}),
  ...(when ? { when } : {}),
})

const DARKVISION_PLUS_60 =
  'you have darkvision out to a range of 60 feet. If you already have darkvision, its range increases by 60 feet.'

const ITEM_SENSE_RULES: readonly SenseRule[] = [
  itemSense(
    'Axe of the Dwarvish Lords|DMG',
    'darkvision',
    60,
    'if you are a dwarf attuned to the axe, the range of your darkvision increases by 60 feet.',
    60,
    'Only for a dwarf attuned to the axe.',
  ),
  itemSense('Axe of the Dwarvish Lords|XDMG', 'darkvision', 60, DARKVISION_PLUS_60, 60),
  itemSense(
    "Belashyrra's Beholder Crown|ERLW",
    "devil's sight",
    120,
    'while wearing the crown, you can see normally in darkness, both magical and nonmagical, to a distance of 120 feet.',
  ),
  ...['DMG', 'XDMG'].map((source) =>
    itemSense(
      `Belt of Dwarvenkind|${source}`,
      'darkvision',
      60,
      "if you aren't a dwarf, you have darkvision out to a range of 60 feet while wearing the belt.",
    ),
  ),
  ...[
    'Black Dragon Mask|HotDQ',
    'Blue Dragon Mask|RoTOS',
    'Green Dragon Mask|RoTOS',
    'Red Dragon Mask|RoTOS',
    'White Dragon Mask|RoTOS',
  ].map((key) =>
    itemSense(
      key,
      'darkvision',
      60,
      'you gain darkvision out to 60 feet, or an additional 60 feet of darkvision if you already have that sense.',
      60,
    ),
  ),
  itemSense(
    'Blackrazor|XDMG',
    'blindsight',
    30,
    'while you hold this weapon, you have blindsight with a range of 30 feet.',
  ),
  itemSense(
    'Dagger of Blindsight|WDMM',
    'blindsight',
    30,
    'a creature attuned to it gains blindsight out to a range of 30 feet.',
  ),
  itemSense(
    "Danoth's Visor (Dormant)|EGW",
    "devil's sight",
    60,
    'while wearing the goggles in their dormant state, you can see normally in darkness, both magical and nonmagical, to a distance of 60 feet.',
  ),
  itemSense(
    "Delver's Claws|BGG",
    'blindsight',
    15,
    'while attuned to the glove, you gain blindsight to 15 feet.',
  ),
  itemSense(
    'Dimensional Loop|AI',
    'darkvision',
    60,
    'while attuned to this device, you have darkvision out to a range of 60 feet. If you already have darkvision, its range increases by 30 feet.',
    30,
  ),
  itemSense(
    'Eye of Vecna|XDMG',
    'truesight',
    240,
    'while you are attuned to the eye, you have truesight out to 240 feet.',
  ),
  ...['DMG', 'XDMG'].map((source) =>
    itemSense(
      `Goggles of Night|${source}`,
      'darkvision',
      60,
      'while wearing these dark lenses, you have darkvision out to 60 feet. If you already have darkvision, wearing the goggles increases its range by 60 feet.',
      60,
    ),
  ),
  itemSense(
    'Helm of Domination|WoW',
    'truesight',
    120,
    'while attuned to the helm, you have truesight with a range of 120 feet.',
  ),
  itemSense(
    'Helm of Underwater Action|GoS',
    'darkvision',
    60,
    'while wearing this brass helmet, you gain darkvision with a range of 60 feet.',
  ),
  itemSense(
    'Ironfang|PotA',
    'tremorsense',
    60,
    'while you hold Ironfang, you have tremorsense out to a range of 60 feet.',
  ),
  itemSense(
    'Nightbringer|MCV2DC',
    'darkvision',
    60,
    `if you have an evil alignment, when attuned ${DARKVISION_PLUS_60}`,
    60,
    'Only if you have an evil alignment.',
  ),
  itemSense(
    'Orb of Skoraeus|BGG',
    "devil's sight",
    120,
    'you can see normally in darkness, both magical and nonmagical, to a distance of 120 feet.',
  ),
  itemSense('Orb of the Veil|EGW', 'darkvision', 60, DARKVISION_PLUS_60, 60),
  itemSense(
    'Robe of Eyes|DMG',
    'darkvision',
    120,
    'while you wear the robe, you have darkvision out to a range of 120 feet.',
  ),
  ...(['darkvision', 'truesight'] as const).map((sense) =>
    itemSense(
      'Robe of Eyes|XDMG',
      sense,
      120,
      'while you wear the robe, you have darkvision and truesight, both with a range of 120 feet.',
    ),
  ),
  itemSense(
    "Rogue's Mantle|BMT",
    'darkvision',
    60,
    "while wearing it, you gain darkvision within a range of 60 feet. If you already have darkvision, the mantle increases your darkvision's range by 60 feet instead.",
    60,
  ),
  itemSense(
    'Scourge of Shadow|CoA',
    'blindsight',
    60,
    'while in dim light or darkness you gain blindsight out to 60 feet.',
    undefined,
    'Only while you are in dim light or darkness.',
  ),
  itemSense(
    'Shadowfell Brand Tattoo|TCE',
    'darkvision',
    60,
    'you gain darkvision with a range of 60 feet.',
  ),
  itemSense(
    "Vanrak's Mithral Shirt|WDMM",
    'darkvision',
    60,
    'while you wear this armor, you gain darkvision out to a range of 60 feet.',
  ),
  itemSense(
    'Verminshroud (Dormant)|EGW',
    'darkvision',
    60,
    'while wearing it in its dormant state, you have darkvision out to a range of 60 feet. If you already have darkvision, wearing the cloak increases its range by 60 feet.',
    60,
  ),
  itemSense(
    'Wreath of the Prism (Dormant)|EGW',
    'darkvision',
    60,
    'while wearing the wreath in its dormant state, you have darkvision out to a range of 60 feet. If you already have darkvision, wearing the wreath increases its range by 60 feet.',
    60,
  ),
]

export const SENSE_RULES: readonly SenseRule[] = [
  ...FEATURE_SENSE_RULES,
  ...ITEM_SENSE_RULES,
]
