// The damage resistances, immunities and vulnerabilities, and the condition immunities,
// that something the character holds gives and the data states in text only: a class or
// subclass feature, an option, a gift a DM grants, a feat or an item. A species and a feat
// that carry the data's `resist`, `immune`, `vulnerable` and `conditionImmune` lists, and
// an item that does, are read from them; a row here is only what the data lacks, or states
// without its condition. A row names its holder, so the audit in defenseRules.test.ts can
// tell a defense covered here from one a book added.

import type { ItemDefenses } from '../data/itemTypes'
import type { Holder } from './holder'

export type DefenseKind = 'resist' | 'immune' | 'vulnerable' | 'condition'

export interface DefenseRule {
  holder: Holder
  kind: DefenseKind
  /**
   * What it covers, as the data names it, lower case: damage types, a condition, or a
   * phrase for a set of them ("all damage except force").
   */
  types: readonly string[]
  /** A condition the sheet cannot check: the defense shows, but is not counted. */
  when?: string
  /** A type the player chooses: how many, of which. The pick is a card of its own. */
  choose?: { count: number; from: readonly string[] }
}

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const

const BPS = ['bludgeoning', 'piercing', 'slashing']
const ELEMENTS = ['acid', 'cold', 'fire', 'lightning', 'thunder']
const DRAGON = ['acid', 'cold', 'fire', 'lightning', 'poison']
const NONMAGICAL = 'Only against nonmagical attacks.'
const RAGING = 'Only while your Rage is active.'

const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})

const sub = (
  className: string,
  shortName: string,
  source: string,
  name: string,
): Holder => ({
  subclassFeature: { className, shortName, source, name },
})

type Row = [
  holder: Holder,
  kind: DefenseKind,
  types: readonly string[] | { count: number; from: readonly string[] },
  when?: string,
]

const rowOf = ([holder, kind, types, when]: Row): DefenseRule => ({
  holder,
  kind,
  types: Array.isArray(types) ? types : [],
  ...('count' in types ? { choose: types } : {}),
  ...(when ? { when } : {}),
})

/** The features of a class or subclass and the options a character picks. */
const FEATURE_ROWS: readonly Row[] = [
  // ---- Species ------------------------------------------------------------------------
  [
    { race: { baseName: 'Pandaren', source: 'WoW' } },
    'resist',
    ['bludgeoning damage from falling'],
  ],
  // ---- Barbarian ----------------------------------------------------------------------
  [classFeature('Barbarian', 'PHB', 'Rage'), 'resist', BPS, RAGING],
  [classFeature('Barbarian', 'XPHB', 'Rage'), 'resist', BPS, RAGING],
  [
    sub('Barbarian', 'Totem Warrior', 'PHB', 'Bear'),
    'resist',
    ['all damage except psychic'],
    RAGING,
  ],
  [sub('Barbarian', 'Storm Herald', 'XGE', 'Desert'), 'resist', ['fire']],
  [sub('Barbarian', 'Storm Herald', 'XGE', 'Sea'), 'resist', ['lightning']],
  [sub('Barbarian', 'Storm Herald', 'XGE', 'Tundra'), 'resist', ['cold']],
  [
    sub('Barbarian', 'Elements', 'WoW', 'Primordial Bond'),
    'resist',
    ['cold', 'fire', 'lightning'],
    RAGING,
  ],
  [
    sub('Barbarian', 'Berserker', 'XPHB', 'Mindless Rage'),
    'condition',
    ['charmed', 'frightened'],
    RAGING,
  ],
  [
    sub('Barbarian', 'Zealot', 'XPHB', 'Rage of the Gods'),
    'resist',
    ['necrotic', 'psychic', 'radiant'],
    'Only while the Rage of the Gods form lasts.',
  ],
  // ---- Artificer ----------------------------------------------------------------------
  [
    sub('Artificer', 'Alchemist', 'TCE', 'Chemical Mastery'),
    'resist',
    ['acid', 'poison'],
  ],
  [sub('Artificer', 'Alchemist', 'TCE', 'Chemical Mastery'), 'condition', ['poisoned']],
  [
    sub('Artificer', 'Alchemist', 'EFA', 'Chemical Mastery'),
    'resist',
    ['acid', 'poison'],
  ],
  [sub('Artificer', 'Alchemist', 'EFA', 'Chemical Mastery'), 'condition', ['poisoned']],
  // ---- Cleric -------------------------------------------------------------------------
  [sub('Cleric', 'War', 'PHB', 'Avatar of Battle'), 'resist', BPS, NONMAGICAL],
  [sub('Cleric', 'Strength (PSA)', 'PSA', 'Avatar of Battle'), 'resist', BPS, NONMAGICAL],
  [sub('Cleric', 'War', 'XPHB', 'Avatar of Battle'), 'resist', BPS],
  [sub('Cleric', 'Forge', 'XGE', 'Soul of the Forge'), 'resist', ['fire']],
  [sub('Cleric', 'Forge', 'XGE', 'Saint of Forge and Fire'), 'immune', ['fire']],
  [
    sub('Cleric', 'Forge', 'XGE', 'Saint of Forge and Fire'),
    'resist',
    BPS,
    'Only while you wear heavy armor, and only against nonmagical attacks.',
  ],
  // ---- Death Knight -------------------------------------------------------------------
  [
    sub('Death Knight', 'Ebon Blade', 'WoW', 'Aura of Deathly Endurance'),
    'resist',
    ['cold', 'necrotic', 'psychic'],
  ],
  // ---- Druid --------------------------------------------------------------------------
  [sub('Druid', 'Land', 'PHB', "Nature's Ward"), 'immune', ['poison']],
  [sub('Druid', 'Land', 'PHB', "Nature's Ward"), 'condition', ['disease']],
  [sub('Druid', 'Land', 'XPHB', "Nature's Ward"), 'condition', ['poisoned']],
  [
    sub('Druid', 'Land', 'XPHB', "Nature's Ward"),
    'resist',
    { count: 1, from: ['cold', 'fire', 'lightning', 'poison'] },
  ],
  [sub('Druid', 'Sea', 'XPHB', 'Stormborn'), 'resist', ['cold', 'lightning', 'thunder']],
  [
    sub('Druid', 'Stars', 'TCE', 'Full of Stars'),
    'resist',
    BPS,
    'Only while in your Starry Form.',
  ],
  [
    sub('Druid', 'Stars', 'XPHB', 'Full of Stars'),
    'resist',
    BPS,
    'Only while in your Starry Form.',
  ],
  // ---- Fighter ------------------------------------------------------------------------
  [sub('Fighter', 'Psi Warrior', 'TCE', 'Guarded Mind'), 'resist', ['psychic']],
  [sub('Fighter', 'Psi Warrior', 'XPHB', 'Guarded Mind'), 'resist', ['psychic']],
  [
    sub('Fighter', 'Banneret', 'FRHoF', 'Inspiring Commander'),
    'condition',
    ['charmed', 'frightened'],
  ],
  // ---- Monk ---------------------------------------------------------------------------
  [classFeature('Monk', 'PHB', 'Purity of Body'), 'immune', ['poison']],
  [classFeature('Monk', 'PHB', 'Purity of Body'), 'condition', ['disease', 'poisoned']],
  [
    classFeature('Monk', 'PHB', 'Empty Body'),
    'resist',
    ['all damage except force'],
    'Only for 1 minute after you spend 4 ki points.',
  ],
  [
    classFeature('Monk', 'XPHB', 'Superior Defense'),
    'resist',
    ['all damage except force'],
    'Only for 1 minute after you spend Focus Points.',
  ],
  [
    sub('Monk', 'Elements', 'XPHB', 'Elemental Epitome'),
    'resist',
    { count: 1, from: ELEMENTS },
  ],
  // ---- Mystic (Unearthed Arcana) ------------------------------------------------------
  [classFeature('Mystic', 'UATheMysticClass', 'Psionic Body'), 'resist', BPS],
  [classFeature('Mystic', 'UATheMysticClass', 'Psionic Body'), 'immune', ['poison']],
  [
    classFeature('Mystic', 'UATheMysticClass', 'Psionic Body'),
    'condition',
    ['disease', 'poisoned'],
  ],
  [
    sub('Mystic', 'Awakened', 'UATheMysticClass', 'Spectral Form'),
    'resist',
    ['all damage'],
    'Only while you are in the spectral form.',
  ],
  // ---- Paladin ------------------------------------------------------------------------
  [classFeature('Paladin', 'PHB', 'Divine Health'), 'condition', ['disease']],
  [classFeature('Paladin', 'XPHB', 'Aura of Courage'), 'condition', ['frightened']],
  [
    sub('Paladin', 'Oathbreaker', 'DMG', 'Supernatural Resistance'),
    'resist',
    BPS,
    'Only against nonmagical weapons.',
  ],
  [
    sub('Paladin', 'Ancients', 'PHB', 'Aura of Warding'),
    'resist',
    ['damage from spells'],
  ],
  [
    sub('Paladin', 'Ancients', 'XPHB', 'Aura of Warding'),
    'resist',
    ['necrotic', 'psychic', 'radiant'],
  ],
  [sub('Paladin', 'Devotion', 'XPHB', 'Aura of Devotion'), 'condition', ['charmed']],
  [
    sub('Paladin', 'Redemption', 'XGE', 'Emissary of Redemption'),
    'resist',
    ['all damage dealt by other creatures'],
  ],
  [
    sub('Paladin', 'Noble Genies', 'FRHoF', 'Aura of Elemental Shielding'),
    'resist',
    { count: 1, from: ELEMENTS },
  ],
  // ---- Ranger -------------------------------------------------------------------------
  [
    sub('Ranger', 'Drakewarden', 'FTD', 'Bond of Fang and Scale'),
    'resist',
    { count: 1, from: DRAGON },
  ],
  [sub('Ranger', 'Winter Walker', 'FRHoF', 'Frigid Explorer'), 'resist', ['cold']],
  [
    sub('Ranger', 'Winter Walker', 'FRHoF', 'Frozen Haunt'),
    'immune',
    ['cold'],
    'Only while you are in the form of the Frozen Haunt.',
  ],
  [
    sub('Ranger', 'Hollow Warden', 'RHW', 'Ancient Might'),
    'condition',
    ['exhaustion'],
    'Only while Ancient Might lasts.',
  ],
  // ---- Rogue --------------------------------------------------------------------------
  [
    sub('Rogue', 'Scion of the Three', 'FRHoF', 'Dread Allegiance'),
    'resist',
    { count: 1, from: ['psychic', 'poison', 'necrotic'] },
  ],
  // ---- Sorcerer -----------------------------------------------------------------------
  [
    sub('Sorcerer', 'Draconic', 'XPHB', 'Elemental Affinity'),
    'resist',
    { count: 1, from: DRAGON },
  ],
  [sub('Sorcerer', 'Pyromancer (PSK)', 'PSK', 'Fire in the Veins'), 'resist', ['fire']],
  [sub('Sorcerer', 'Pyromancer (PSK)', 'PSK', 'Fiery Soul'), 'immune', ['fire']],
  [sub('Sorcerer', 'Aberrant Mind', 'TCE', 'Psychic Defenses'), 'resist', ['psychic']],
  [sub('Sorcerer', 'Aberrant', 'XPHB', 'Psychic Defenses'), 'resist', ['psychic']],
  [
    sub('Sorcerer', 'Storm', 'XGE', 'Heart of the Storm'),
    'resist',
    ['lightning', 'thunder'],
  ],
  [sub('Sorcerer', 'Storm', 'XGE', 'Wind Soul'), 'immune', ['lightning', 'thunder']],
  // ---- Warlock ------------------------------------------------------------------------
  [sub('Warlock', 'Archfey', 'PHB', 'Beguiling Defenses'), 'condition', ['charmed']],
  [sub('Warlock', 'Archfey', 'XPHB', 'Beguiling Defenses'), 'condition', ['charmed']],
  [
    sub('Warlock', 'Fiend', 'PHB', 'Fiendish Resilience'),
    'resist',
    { count: 1, from: DAMAGE_TYPES },
  ],
  [
    sub('Warlock', 'Fiend', 'XPHB', 'Fiendish Resilience'),
    'resist',
    { count: 1, from: DAMAGE_TYPES.filter((t) => t !== 'force') },
  ],
  [sub('Warlock', 'Great Old One', 'PHB', 'Thought Shield'), 'resist', ['psychic']],
  [sub('Warlock', 'Great Old One', 'XPHB', 'Thought Shield'), 'resist', ['psychic']],
  [sub('Warlock', 'Fathomless', 'TCE', 'Oceanic Soul'), 'resist', ['cold']],
  [
    sub('Warlock', 'Genie', 'TCE', 'Elemental Gift'),
    'resist',
    { count: 1, from: ['bludgeoning', 'thunder', 'fire', 'cold'] },
  ],
  [
    sub('Warlock', 'Undead', 'VRGR', 'Form of Dread'),
    'condition',
    ['frightened'],
    'Only while you are transformed by Form of Dread.',
  ],
  [
    sub('Warlock', 'Undead', 'RHW', 'Form of Dread'),
    'condition',
    ['frightened'],
    'Only while you are transformed by Form of Dread.',
  ],
  [sub('Warlock', 'Undead', 'VRGR', 'Necrotic Husk'), 'resist', ['necrotic']],
  [
    sub('Warlock', 'Undead', 'VRGR', 'Necrotic Husk'),
    'immune',
    ['necrotic'],
    'Only while you are transformed by Form of Dread.',
  ],
  [sub('Warlock', 'Undead', 'RHW', 'Necrotic Husk'), 'resist', ['necrotic']],
  [
    sub('Warlock', 'Undead', 'RHW', 'Necrotic Husk'),
    'immune',
    ['necrotic'],
    'Only while you are using Form of Dread.',
  ],
  [
    sub('Warlock', 'Undead', 'RHW', 'Superior Dread'),
    'resist',
    BPS,
    'Only while you are using Form of Dread.',
  ],
  [sub('Warlock', 'Celestial', 'XGE', 'Radiant Soul'), 'resist', ['radiant']],
  [sub('Warlock', 'Celestial', 'XPHB', 'Radiant Soul'), 'resist', ['radiant']],
  // ---- Wizard -------------------------------------------------------------------------
  [
    sub('Wizard', 'Abjuration', 'PHB', 'Spell Resistance'),
    'resist',
    ['damage from spells'],
  ],
  [
    sub('Wizard', 'Abjurer', 'XPHB', 'Spell Resistance'),
    'resist',
    ['damage from spells'],
  ],
  [sub('Wizard', 'Necromancy', 'PHB', 'Inured to Undeath'), 'resist', ['necrotic']],
  [sub('Wizard', 'Necromancer', 'AU', 'Necromancy Spellbook'), 'resist', ['necrotic']],
  // ---- Options and feats --------------------------------------------------------------
  [{ option: 'Hill Rune|TCE' }, 'resist', ['poison']],
  [
    { feat: 'Planar Wanderer|SatO' },
    'resist',
    { count: 1, from: ['acid', 'cold', 'fire'] },
  ],
  [
    { feat: 'Boon of Desperate Resilience|FRHoF' },
    'resist',
    ['all damage except force'],
    'Only while you are Bloodied.',
  ],
  [
    { feat: 'Boon of the Night Spirit|XPHB' },
    'resist',
    ['all damage except psychic and radiant'],
    'Only while in dim light or darkness.',
  ],
  [{ feat: 'Dungeon Delver|PHB' }, 'resist', ['damage dealt by traps']],
  [
    { feat: 'Soul of the Storm Giant|BGG' },
    'resist',
    ['lightning', 'thunder'],
    'Only while the aura of the feat is active.',
  ],
  [
    { feat: 'Boon of the Furious Storm|FRHoF' },
    'immune',
    ['lightning', 'thunder'],
    'Only while you are Bloodied.',
  ],
]

/** The gifts a DM grants. */
const REWARD_ROWS: readonly Row[] = [
  [{ reward: 'Blessing of Argent Fortitude|WoW' }, 'immune', ['poison']],
  [{ reward: 'Blessing of Argent Fortitude|WoW' }, 'condition', ['poisoned']],
  [{ reward: 'Blessing of the Frostmaiden|IDRotF' }, 'immune', ['cold']],
  [{ reward: 'Boon of Perfect Health|DMG' }, 'immune', ['poison']],
  [{ reward: 'Boon of Perfect Health|DMG' }, 'condition', ['disease', 'poisoned']],
  [
    { reward: 'Boon of Resilience|DMG' },
    'resist',
    BPS,
    'Only against nonmagical weapons.',
  ],
  [{ reward: 'Boon of the Fire Soul|DMG' }, 'immune', ['fire']],
  [{ reward: 'Boon of the Stormborn|DMG' }, 'immune', ['lightning', 'thunder']],
  [
    { reward: 'Charm of the Crystal Heart|ToA' },
    'immune',
    ['piercing', 'slashing'],
    NONMAGICAL,
  ],
  [{ reward: 'Charm of the Crystal Heart|ToA' }, 'vulnerable', ['bludgeoning']],
  [{ reward: 'Fragment of Despondence|CRCotN' }, 'condition', ['charmed']],
  [{ reward: "Heliod's Disciple|MOT" }, 'resist', ['fire']],
  [{ reward: "Pharika's Votary|MOT" }, 'condition', ['disease']],
  [{ reward: 'Psionic Reach|FTD' }, 'resist', ['psychic']],
  [{ reward: 'Scaled Toughness|FTD' }, 'resist', ['piercing', 'slashing']],
  [{ reward: 'Yuan-Ti Pureblood Transformation|ToA' }, 'immune', ['poison']],
  [{ reward: 'Yuan-Ti Pureblood Transformation|ToA' }, 'condition', ['poisoned']],
]

const item = (key: string): Holder => ({ item: key })

/**
 * A generic variant of the books (armor of a kind, a sword of a kind) whose defense the
 * data states in text only, by the name of the variant. The items it makes are named
 * from the base item, so a row cannot name them; the catalog reads these as the data's
 * own lists.
 */
export const VARIANT_DEFENSES: Readonly<Record<string, ItemDefenses>> = {
  'Demon Skin': { resist: ['poison'] },
  'Efreeti Chain': { immune: ['fire'] },
  'Frost Brand': { resist: ['fire'] },
  'Living Armor': { resist: ['necrotic', 'poison', 'psychic'] },
  'Molten Bronze Skin': { resist: ['fire'] },
  'Ruidium Armor': { resist: ['psychic'] },
  'Mind Carapace Armor': { condition: ['frightened'] },
}

/** Items whose text gives the defense and whose data fields do not. */
const ITEM_ROWS: readonly Row[] = [
  [item('Armor of Invulnerability|DMG'), 'resist', ['nonmagical damage']],
  [item('Armor of Invulnerability|XDMG'), 'resist', BPS],
  [item('Amulet of Appearance|CoA'), 'condition', ['frightened', 'poisoned']],
  [item('Blast Scepter|WDMM'), 'resist', ['fire', 'lightning']],
  [item('Blackrazor|XDMG'), 'condition', ['charmed', 'frightened']],
  [item('Book of Exalted Deeds|XDMG'), 'condition', ['charmed', 'frightened']],
  [item('Book of Exalted Deeds|XDMG'), 'resist', ['psychic']],
  [item('Book of Vile Darkness|XDMG'), 'condition', ['exhaustion']],
  [item('Bracelet of Rock Magic|TftYP'), 'condition', ['petrified']],
  [item('Canian Fork|CoA'), 'vulnerable', ['radiant']],
  [item('Crown of Horns|FRAiF'), 'immune', ['necrotic']],
  [
    item('Gauntlets of Rage|CoA'),
    'condition',
    ['charmed', 'frightened'],
    'Only while you are furious.',
  ],
  [
    item('Infernal Plate Armor|CoA'),
    'vulnerable',
    ['force', 'lightning', 'psychic', 'radiant', 'thunder'],
  ],
  [
    item("Maddgoth's Helm|WDMM"),
    'immune',
    ['all damage'],
    "Only inside Maddgoth's castle, on its roof or in its courtyard.",
  ],
  [item('Mace of the Black Crown (Awakened)|EGW'), 'resist', ['poison']],
  [item('Mace of the Black Crown (Exalted)|EGW'), 'resist', ['fire', 'poison']],
  [item('Obsidian Flint Dragon Plate|BGDIA'), 'resist', ['poison']],
  [item('Orb of the Stein Rune|SKT'), 'resist', ['damage from ranged weapon attacks']],
  [item('Periapt of Health|DMG'), 'condition', ['disease']],
  [item('Piwafwi of Fire Resistance|OotA'), 'resist', ['fire']],
  [item('Scourge of Shadow|CoA'), 'resist', ['radiant', 'necrotic']],
  [
    item('Shield of Missile Attraction|DMG'),
    'resist',
    ['damage from ranged weapon attacks'],
  ],
  [
    item('Shield of Missile Attraction|XDMG'),
    'resist',
    ['damage from ranged weapon attacks'],
  ],
  [item('Shield of the Hidden Lord|BGDIA'), 'resist', ['fire']],
  [item('Staff of Light and Shadow|WoW'), 'resist', ['necrotic']],
  [item('Sword of Kas|XDMG'), 'resist', ['necrotic']],
  [item('The Codicil of White|IDRotF'), 'resist', ['cold']],
  // A dragon mask gives immunity instead when its wearer already resists the type.
  ...(
    [
      ['Black Dragon Mask|HotDQ', 'acid'],
      ['Blue Dragon Mask|RoTOS', 'lightning'],
      ['Green Dragon Mask|RoTOS', 'poison'],
      ['Red Dragon Mask|RoTOS', 'fire'],
      ['White Dragon Mask|RoTOS', 'cold'],
    ] as const
  ).map(([key, type]): Row => [
    item(key),
    'immune',
    [type],
    `Only if you already resist ${type} damage from another source.`,
  ]),
]

/**
 * Items whose data lists a defense that is not the bearer's to keep standing: a card,
 * a potion or a form the item takes on, with the reason.
 */
export const ITEM_DEFENSE_NOT_STANDING: Readonly<Record<string, string>> = {
  'Deck of Wonder|BMT': 'One card drawn from the deck, not a lasting resistance.',
  'Deck of Many More Things|BMT': 'One card drawn from the deck, not a lasting defense.',
  'Moon Card|BMT': 'A transformation of one minute, from touching the card.',
  'Potion of Invulnerability|DMG': 'One minute, after drinking it.',
  'Potion of Invulnerability|XDMG': 'One minute, after drinking it.',
  'Muroosa Balm|EGW': 'One hour, after applying a dose.',
  'Ghost Step Tattoo|TCE': 'Only for the time after its action is used.',
  'Sundial of Eternal Dusk|ICC': 'Only while the shadow of its action lasts.',
}

/** Items whose data lists a defense that holds only under a condition, with it. */
export const ITEM_DEFENSE_WHEN: Readonly<Record<string, string>> = {
  'Helm of Brilliance|DMG': 'Only while the helm has at least one ruby.',
  'Helm of Brilliance|XDMG': 'Only while the helm has at least one ruby.',
}

export const DEFENSE_RULES: readonly DefenseRule[] = [
  ...FEATURE_ROWS,
  ...REWARD_ROWS,
  ...ITEM_ROWS,
].map(rowOf)
