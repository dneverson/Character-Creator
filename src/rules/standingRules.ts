// The advantage and disadvantage a standing trait gives on a saving throw or a skill check
// that the data states in text only: Fey Ancestry, Dwarven Resilience, Gnome Cunning,
// Danger Sense and their kin, from a species, a feat, a class or subclass feature, a gift a
// DM grants or an item. Each row names its holder, so the audit in standingRules.test.ts
// can tell a trait that is covered from one a book added. A row is a note beside the
// number, never added to it: the case it holds in ("against being charmed") is the row's
// `when`, and a row with none holds always.
//
// A death saving throw has no row on the sheet: its note goes on the hit point maximum's
// lines. Initiative is a row of rules/combatRules.ts.
//
// Not here: a trait held only after an action or for a time, a roll the sheet has no row
// for (a tool check), and the advantages of the class options, which are rows of
// rules/optionEffects.ts.

import type { AbilityKey } from '../dice/dice'
import { SKILLS } from '../data/skills'
import type { Holder } from './holder'

export type Edge = 'advantage' | 'disadvantage'

/** What the note is on: the saving throws of some abilities, some skills or death saves. */
export type StandingScope =
  { save: readonly AbilityKey[] } | { check: readonly string[] } | { death: true }

export interface StandingRule {
  holder: Holder
  edge: Edge
  scope: StandingScope
  /** The case it holds in, as a phrase after the roll: "against being charmed". */
  when?: string
}

type Row = [holder: Holder, edge: Edge, scope: StandingScope, when?: string]

const rowOf = ([holder, edge, scope, when]: Row): StandingRule => ({
  holder,
  edge,
  scope,
  ...(when ? { when } : {}),
})

const ALL_SAVES: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const saves = (...abilities: AbilityKey[]): StandingScope => ({ save: abilities })
const allSaves: StandingScope = { save: ALL_SAVES }
const checks = (...skills: string[]): StandingScope => ({ check: skills })
/** The skills of these abilities: a "Strength check" is on every skill that uses it. */
const checksOf = (...abilities: AbilityKey[]): StandingScope => ({
  check: SKILLS.filter((s) => abilities.includes(s.ability)).map((s) => s.key),
})
const deathSaves: StandingScope = { death: true }
const everyCheck: StandingScope = { check: SKILLS.map((s) => s.key) }

const race = (baseName: string, source: string): Holder => ({
  race: { baseName, source },
})
const subrace = (baseName: string, source: string, subraceName: string): Holder => ({
  race: { baseName, source, subraceName },
})
const feat = (key: string): Holder => ({ feat: key })
const reward = (key: string): Holder => ({ reward: key })
const item = (key: string): Holder => ({ item: key })
const variant = (name: string): Holder => ({ variant: name })
const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})
const sub = (
  className: string,
  shortName: string,
  source: string,
  name: string,
): Holder => ({ subclassFeature: { className, shortName, source, name } })

const A: Edge = 'advantage'
const D: Edge = 'disadvantage'

const CHARMED = 'to avoid or end the charmed condition'
const FRIGHTENED = 'to avoid or end the frightened condition'
const POISONED = 'to avoid or end the poisoned condition'
const CHARMED_FRIGHTENED = 'to avoid or end the charmed and frightened conditions'
const GRAPPLED = 'to avoid or end the grappled condition'
const BLACKRAZOR = 'while the temporary hit points it gave last and you hold it'
const DEMONS = "against the demons' spells and special abilities"
const SPELLS = 'against spells'
const MAGIC = 'against spells and other magical effects'
const SUNLIGHT = 'when you or what you perceive is in direct sunlight'
const SMELL = 'that involve smell'
const HIDE_ROCKY = 'to hide in rocky terrain'
const CONCENTRATION = 'to maintain concentration'
const RAGING = 'while your Rage is active'

const ROWS: readonly Row[] = [
  // ---- Species: charmed and frightened ------------------------------------------------
  [race('Astral Elf', 'AAG'), A, allSaves, CHARMED],
  [race('Bugbear', 'MPMM'), A, allSaves, CHARMED],
  [race('Eladrin', 'MPMM'), A, allSaves, CHARMED],
  [race('Elf', 'PHB'), A, allSaves, 'against being charmed'],
  [race('Elf', 'XPHB'), A, allSaves, CHARMED],
  [race('Elf (Kaladesh)', 'PSK'), A, allSaves, 'against being charmed'],
  [race('Elf (Zendikar)', 'PSZ'), A, allSaves, 'against being charmed'],
  [
    race('Forsaken', 'WoW'),
    A,
    allSaves,
    'to avoid or end the charmed or frightened condition',
  ],
  [race('Goblin', 'MPMM'), A, allSaves, CHARMED],
  [race('Goblin', 'WoW'), A, allSaves, CHARMED],
  [race('Half-Elf', 'PHB'), A, allSaves, 'against being charmed'],
  [race('Halfling', 'PHB'), A, allSaves, 'against being frightened'],
  [race('Halfling', 'XPHB'), A, allSaves, FRIGHTENED],
  [race('Hobgoblin', 'MPMM'), A, allSaves, CHARMED],
  [race('Kender', 'DSotDQ'), A, allSaves, FRIGHTENED],
  [race('Khoravar', 'EFA'), A, allSaves, CHARMED],
  [race('Kobold', 'MPMM'), A, allSaves, FRIGHTENED],
  [race('Kor', 'PSZ'), A, allSaves, 'against being frightened'],
  [race('Loxodon', 'GGR'), A, allSaves, 'against being charmed or frightened'],
  [
    race('Locathah', 'LR'),
    A,
    allSaves,
    'against being charmed, frightened, paralyzed, poisoned, stunned, or put to sleep',
  ],
  [race('Sea Elf', 'MPMM'), A, allSaves, CHARMED],
  [race('Shadar-Kai', 'MPMM'), A, allSaves, CHARMED],
  [
    subrace('Gith', 'MTF', 'Githzerai'),
    A,
    allSaves,
    'against being charmed or frightened',
  ],
  // ---- Species: poison and disease ----------------------------------------------------
  [race('Autognome', 'AAG'), A, allSaves, 'against being paralyzed or poisoned'],
  [race('Duergar', 'MPMM'), A, allSaves, POISONED],
  [
    race('Duergar', 'MPMM'),
    A,
    allSaves,
    'to avoid or end the charmed or stunned condition',
  ],
  [race('Dwarf', 'PHB'), A, allSaves, 'against poison'],
  [race('Dwarf', 'XPHB'), A, allSaves, POISONED],
  [race('Dwarf (Kaladesh)', 'PSK'), A, allSaves, 'against poison'],
  [race('Earthen', 'WoW'), A, allSaves, POISONED],
  [
    race('Mechagnome', 'WoW'),
    A,
    allSaves,
    'to avoid or end the paralyzed or poisoned condition',
  ],
  [race('Plasmoid', 'AAG'), A, allSaves, 'against being poisoned'],
  [race('Reborn', 'VRGR'), A, allSaves, 'against disease and being poisoned'],
  [race('Warforged', 'EFA'), A, allSaves, POISONED],
  [race('Warforged', 'ERLW'), A, allSaves, 'against being poisoned'],
  [race('Yuan-Ti', 'MPMM'), A, allSaves, POISONED],
  [subrace('Dwarf', 'MTF', 'Duergar'), A, allSaves, 'against poison'],
  [
    subrace('Dwarf', 'MTF', 'Duergar'),
    A,
    allSaves,
    'against illusions and against being charmed or paralyzed',
  ],
  [subrace('Halfling', 'PHB', 'Stout'), A, allSaves, 'against poison'],
  // ---- Species: magic -----------------------------------------------------------------
  [race('Deep Gnome', 'MPMM'), A, saves('int', 'wis', 'cha'), SPELLS],
  [race('Gnome', 'PHB'), A, saves('int', 'wis', 'cha'), 'against magic'],
  [race('Gnome', 'XPHB'), A, saves('int', 'wis', 'cha')],
  [race('Gnome (Deep)', 'DMG'), A, saves('int', 'wis', 'cha'), 'against magic'],
  [race('Satyr', 'MOT'), A, allSaves, MAGIC],
  [race('Satyr', 'MPMM'), A, allSaves, SPELLS],
  [race('Vedalken', 'GGR'), A, saves('int', 'wis', 'cha')],
  [race('Vedalken', 'PSK'), A, saves('int', 'wis', 'cha'), 'against magic'],
  [race('Yuan-Ti', 'MPMM'), A, allSaves, SPELLS],
  [race('Yuan-ti Pureblood', 'VGM'), A, allSaves, MAGIC],
  // ---- Species: the abilities ---------------------------------------------------------
  [race('Giff', 'AAG'), A, saves('str')],
  [race('Giff', 'AAG'), A, checksOf('str')],
  [race('Kalashtar', 'EFA'), A, saves('wis', 'cha')],
  [race('Kalashtar', 'ERLW'), A, saves('wis')],
  [race('Verdan', 'AI'), A, saves('wis', 'cha')],
  [race('Kuo-Toa', 'DMG'), A, allSaves, 'made to escape a grapple'],
  // ---- Species: skills ----------------------------------------------------------------
  [race('Bullywug', 'DMG'), A, checks('stealth'), 'to hide in swampy terrain'],
  [
    race('Changeling', 'EFA'),
    A,
    checksOf('cha'),
    'while shape-shifted with Shapechanger',
  ],
  [race('Firbolg', 'MPMM'), A, checksOf('cha'), 'to influence beasts and plants'],
  [race('Firbolg', 'VGM'), A, checksOf('cha'), 'to influence beasts and plants'],
  [race('Gnome (Deep)', 'DMG'), A, checks('stealth'), HIDE_ROCKY],
  [subrace('Gnome', 'MTF', 'Deep'), A, checks('stealth'), HIDE_ROCKY],
  [subrace('Gnome', 'SCAG', 'Deep/Svirfneblin'), A, checks('stealth'), HIDE_ROCKY],
  [
    subrace('Goblin', 'PSZ', 'Zendikar; Lavastep Tribe'),
    A,
    checks('stealth'),
    'to hide in rocky or subterranean environments',
  ],
  [race('Grimlock', 'DMG'), A, checks('perception'), 'that rely on hearing or smell'],
  [race('Grimlock', 'DMG'), A, checks('stealth'), 'to hide in rocky terrain'],
  [race('Loxodon', 'GGR'), A, checks('perception', 'survival', 'investigation'), SMELL],
  [race('Minotaur', 'MPMM'), A, checks('survival'), 'to navigate or track'],
  [race('Troglodyte', 'DMG'), A, checks('stealth'), 'to hide'],
  [subrace('Elf', 'EGW', 'Pallid'), A, checks('investigation', 'insight')],
  [race('Shifter', 'EFA'), A, checksOf('wis'), 'while shifted'],
  [race('Shifter', 'MPMM'), A, checksOf('wis'), 'while shifted'],
  [subrace('Shifter', 'ERLW', 'Wildhunt'), A, checksOf('wis'), 'while shifted'],
  // ---- Species: sunlight --------------------------------------------------------------
  [race('Kobold', 'DMG'), D, checks('perception'), `that rely on sight ${SUNLIGHT}`],
  [race('Kobold', 'VGM'), D, checks('perception'), `that rely on sight ${SUNLIGHT}`],
  [
    race('Kuo-Toa', 'DMG'),
    D,
    checks('perception'),
    'that rely on sight while in sunlight',
  ],
  [
    race('Troglodyte', 'DMG'),
    D,
    checks('perception'),
    'that rely on sight while in sunlight',
  ],
  [
    subrace('Elf', 'PHB', 'Drow'),
    D,
    checks('perception'),
    `that rely on sight ${SUNLIGHT}`,
  ],
  [
    subrace('Elf (Zendikar)', 'PSZ', 'Mul Daya Nation'),
    D,
    checks('perception'),
    `that rely on sight ${SUNLIGHT}`,
  ],
  [
    subrace('Dwarf', 'MTF', 'Duergar'),
    D,
    checks('perception'),
    `that rely on sight ${SUNLIGHT}`,
  ],
  // ---- Feats --------------------------------------------------------------------------
  [
    feat('Actor|PHB'),
    A,
    checks('deception', 'performance'),
    'when trying to pass yourself off as a different person',
  ],
  [
    feat('Actor|XPHB'),
    A,
    checks('deception', 'performance'),
    'to convince others you are the person you are disguised as',
  ],
  [feat('Arathi Heritage|WoW'), A, allSaves, CHARMED],
  [feat('Child of the Sun|LFL'), A, allSaves, 'to avoid or end the blinded condition'],
  [
    feat('Dungeon Delver|PHB'),
    A,
    checks('perception', 'investigation'),
    'to detect secret doors',
  ],
  [feat('Dungeon Delver|PHB'), A, allSaves, 'made to avoid or resist traps'],
  [
    feat('Familiar Friend|AU'),
    A,
    everyCheck,
    'on a skill you are proficient in while your familiar is within 5 feet',
  ],
  [feat('Gathered Whispers|RHW'), D, everyCheck, 'while deafened'],
  [feat('Infernal Constitution|XGE'), A, allSaves, 'against being poisoned'],
  [
    feat('Mage Slayer|PHB'),
    A,
    allSaves,
    'against spells cast by creatures within 5 feet of you',
  ],
  [
    feat("Order's Resilience|FRHoF"),
    A,
    saves('str'),
    'while within 5 feet of an ally who is not incapacitated',
  ],
  [
    feat('Squat Nimbleness|XGE'),
    A,
    checks('athletics', 'acrobatics'),
    'to escape from being grappled',
  ],
  [
    feat('Transmuted Anatomy|AU'),
    A,
    allSaves,
    'against effects that would compel you to shape-shift',
  ],
  [feat('War Caster|PHB'), A, saves('con'), CONCENTRATION],
  [feat('War Caster|XPHB'), A, saves('con'), CONCENTRATION],
  [feat('Watchers|RHW'), D, allSaves, 'made against the Scrying spell'],
  // ---- Class and subclass features ----------------------------------------------------
  [classFeature('Barbarian', 'PHB', 'Rage'), A, saves('str'), RAGING],
  [classFeature('Barbarian', 'PHB', 'Rage'), A, checksOf('str'), RAGING],
  [classFeature('Barbarian', 'XPHB', 'Rage'), A, saves('str'), RAGING],
  [classFeature('Barbarian', 'XPHB', 'Rage'), A, checksOf('str'), RAGING],
  [
    classFeature('Barbarian', 'PHB', 'Danger Sense'),
    A,
    saves('dex'),
    'against effects that you can see',
  ],
  [
    classFeature('Barbarian', 'XPHB', 'Danger Sense'),
    A,
    saves('dex'),
    'unless you are incapacitated',
  ],
  [
    sub('Barbarian', 'Totem Warrior', 'PHB', 'Bear'),
    A,
    checksOf('str'),
    'to push, pull, lift or break objects',
  ],
  [
    sub('Bard', 'Dance', 'XPHB', 'Dance Virtuoso'),
    A,
    checks('performance'),
    'that involve you dancing',
  ],
  [
    sub('Druid', 'Land', 'PHB', "Land's Stride"),
    A,
    allSaves,
    'against plants magically created or manipulated to impede movement',
  ],
  [
    classFeature('Ranger', 'PHB', "Land's Stride"),
    A,
    allSaves,
    'against plants magically created or manipulated to impede movement',
  ],
  [
    sub('Fighter', 'Cavalier', 'XGE', 'Born to the Saddle'),
    A,
    allSaves,
    'made to avoid falling off your mount',
  ],
  [sub('Fighter', 'Champion', 'XPHB', 'Remarkable Athlete'), A, checks('athletics')],
  [
    sub('Monk', 'Astral Self', 'TCE', 'Visage of the Astral Self'),
    A,
    checks('insight', 'intimidation'),
  ],
  [
    classFeature('Ranger', 'PHB', 'Favored Enemy'),
    A,
    checks('survival'),
    'to track your favored enemies',
  ],
  [sub('Ranger', 'Hunter', 'PHB', 'Steel Will'), A, allSaves, 'against being frightened'],
  [
    sub('Ranger', 'Fey Wanderer', 'TCE', 'Beguiling Twist'),
    A,
    allSaves,
    'against being charmed or frightened',
  ],
  [
    sub('Ranger', 'Fey Wanderer', 'XPHB', 'Beguiling Twist'),
    A,
    allSaves,
    'to avoid or end the charmed or frightened condition',
  ],
  [
    sub('Rogue', 'Assassin', 'PHB', 'Impostor'),
    A,
    checks('deception'),
    'to avoid detection when a wary creature suspects you',
  ],
  [
    sub('Rogue', 'Phantom', 'TCE', 'Tokens of the Departed'),
    A,
    saves('con'),
    'while a soul trinket is on your person',
  ],
  [
    sub('Sorcerer', 'Aberrant Mind', 'TCE', 'Psychic Defenses'),
    A,
    allSaves,
    'against being charmed or frightened',
  ],
  [
    sub('Sorcerer', 'Aberrant', 'XPHB', 'Psychic Defenses'),
    A,
    allSaves,
    'to avoid or end the charmed or frightened condition',
  ],
  [
    sub('Warlock', 'Undying', 'SCAG', 'Among the Dead'),
    A,
    allSaves,
    'against any disease',
  ],
  [sub('Wizard', 'Abjurer', 'XPHB', 'Spell Resistance'), A, allSaves, SPELLS],
  [sub('Wizard', 'Transmuter', 'AU', 'Wondrous Alteration'), A, checks('deception')],
  [
    sub('Wizard', 'Transmuter', 'AU', 'Wondrous Alteration'),
    A,
    saves('con'),
    CONCENTRATION,
  ],
  [
    sub('Artificer', 'Armorer', 'EFA', 'Infiltrator'),
    A,
    checks('stealth'),
    'while you wear the Infiltrator armor',
  ],
  [
    sub('Artificer', 'Armorer', 'TCE', 'Dampening Field'),
    A,
    checks('stealth'),
    'while you wear the Infiltrator armor',
  ],
  [
    sub('Paladin', 'Crown', 'SCAG', 'Unyielding Spirit'),
    A,
    allSaves,
    'to avoid becoming paralyzed or stunned',
  ],
  [
    sub('Rogue', 'Thief', 'PHB', 'Supreme Sneak'),
    A,
    checks('stealth'),
    'if you move no more than half your speed in the turn',
  ],
  [
    sub('Rogue', 'Inquisitive', 'XGE', 'Steady Eye'),
    A,
    checks('perception', 'investigation'),
    'if you move no more than half your speed in the turn',
  ],
  [
    sub('Rogue', 'Phantom', 'RHW', 'Tokens of the Departed'),
    A,
    saves('con'),
    'while you have a soul trinket',
  ],
  [sub('Wizard', 'Abjuration', 'PHB', 'Spell Resistance'), A, allSaves, SPELLS],
  [
    sub('Wizard', 'Scribes', 'TCE', 'One with the Word'),
    A,
    checks('arcana'),
    'while your awakened spellbook is on your person',
  ],
  // ---- Gifts a DM grants --------------------------------------------------------------
  [reward('Blessing of Magic Resistance|DMG'), A, allSaves, MAGIC],
  [reward('Blessing of Magic Resistance|XDMG'), A, allSaves, MAGIC],
  [reward('Boon of Magic Resistance|DMG'), A, allSaves, MAGIC],
  [reward('Boon of Perfect Health|DMG'), A, saves('con')],
  [reward('Draconic Senses|FTD'), A, checks('perception')],
  [
    reward('Fragment of Attachment|CRCotN'),
    D,
    saves('wis', 'cha'),
    "while you aren't within 10 feet of an ally",
  ],
  [reward("Ephara's Votary|MOT"), A, checks('persuasion'), 'while you are within a city'],
  [reward('Fragment of Deception|CRCotN'), D, checksOf('wis')],
  [reward('Fragment of Loathing|CRCotN'), D, checksOf('cha')],
  [reward("Heliod's Disciple|MOT"), A, allSaves, 'against being blinded'],
  [reward("Iroas's Votary|MOT"), A, allSaves, 'against being frightened'],
  [reward("Karametra's Votary|MOT"), A, allSaves, 'against being poisoned'],
  [reward("Klothys's Votary|MOT"), A, allSaves, 'against being charmed'],
  [reward("Kruphix's Votary|MOT"), A, allSaves, 'against being charmed'],
  [reward("Mogis's Disciple|MOT"), A, allSaves, 'against being charmed or frightened'],
  [reward("Nylea's Votary|MOT"), A, allSaves, 'against being poisoned'],
  [reward("Pharika's Votary|MOT"), A, allSaves, 'against being poisoned'],
  [reward("Phenax's Votary|MOT"), A, checks('deception')],
  [reward("Purphoros's Votary|MOT"), A, allSaves, 'against being knocked prone'],
  [reward("Thassa's Disciple|MOT"), A, allSaves, 'against being charmed or restrained'],
  [reward('Tongue of the Dragon|FTD'), A, checks('persuasion')],
  [reward('Yuan-Ti Pureblood Transformation|ToA'), A, allSaves, MAGIC],
  // ---- Items: the standing ones of the Dungeon Master's Guide -------------------------
  ...['DMG', 'XDMG'].flatMap((book): Row[] => [
    [item(`Mantle of Spell Resistance|${book}`), A, allSaves, SPELLS],
    [item(`Robe of the Archmagi|${book}`), A, allSaves, MAGIC],
    [item(`Scarab of Protection|${book}`), A, allSaves, SPELLS],
    [item(`Spellguard Shield|${book}`), A, allSaves, MAGIC],
    [item(`Ring of Spell Turning|${book}`), A, allSaves, SPELLS],
    [item(`Staff of the Magi|${book}`), A, allSaves, SPELLS],
    [
      item(`Boots of Elvenkind|${book}`),
      A,
      checks('stealth'),
      'that rely on moving silently',
    ],
    [item(`Cloak of Elvenkind|${book}`), A, checks('stealth')],
    [item(`Cloak of the Bat|${book}`), A, checks('stealth')],
    [
      item(`Eyes of Minute Seeing|${book}`),
      A,
      checks('investigation'),
      'that rely on sight',
    ],
  ]),
  [item('Quarterstaff of the Acrobat|XDMG'), A, checks('acrobatics')],
  [item('Infernal Amulet|CoA'), D, saves('str')],
  [item('Infernal Amulet|CoA'), D, checksOf('str')],
  // ---- Items: the standing ones of other books ------------------------------------------
  [item('Amethyst Lodestone|FTD'), A, saves('str')],
  [
    item('Amulet of Duplicity|CoA'),
    D,
    checks('persuasion'),
    'to reveal who you really are',
  ],
  [
    item('Amulet of Protection from Turning|TftYP'),
    A,
    allSaves,
    'against effects that turn undead',
  ],
  ...['Ashen Band of Courage', 'Ashen Band of Greater Courage'].map((name): Row => [
    item(`${name}|ICC`),
    A,
    allSaves,
    CHARMED_FRIGHTENED,
  ]),
  [item('Ashen Band of Unmatched Courage|ICC'), A, allSaves, CHARMED_FRIGHTENED],
  [item('Belt of Dwarvenkind|DMG'), A, allSaves, 'against poison'],
  [
    item('Belt of Dwarvenkind|DMG'),
    A,
    checks('persuasion'),
    'made to interact with dwarves',
  ],
  [item('Belt of Dwarvenkind|XDMG'), A, allSaves, POISONED],
  [
    item('Belt of Dwarvenkind|XDMG'),
    A,
    checks('persuasion'),
    'made to interact with dwarves and duergar',
  ],
  ...(
    [
      ['Black Dragon Mask|HotDQ', 'black'],
      ['Blue Dragon Mask|RoTOS', 'blue'],
      ['Green Dragon Mask|RoTOS', 'green'],
      ['Red Dragon Mask|RoTOS', 'red'],
      ['White Dragon Mask|RoTOS', 'white'],
    ] as const
  ).map(([key, color]): Row => [
    item(key),
    A,
    checksOf('cha'),
    `made against ${color} dragons`,
  ]),
  ...[
    'Black',
    'Blue',
    'Brass',
    'Bronze',
    'Copper',
    'Gold',
    'Green',
    'Red',
    'Silver',
    'White',
  ].map((color): Row => [
    item(`${color} Dragon Scale Mail|DMG`),
    A,
    allSaves,
    'against the Frightful Presence and breath weapons of dragons',
  ]),
  [
    item('Dragonstaff of Ahghairon|WDH'),
    A,
    allSaves,
    'against the spells and breath weapons of dragons and other creatures like them',
  ],
  [item('Blackrazor|DMG'), A, allSaves, BLACKRAZOR],
  [item('Blackrazor|DMG'), A, everyCheck, BLACKRAZOR],
  [item('Blanket|XPHB'), A, allSaves, 'against extreme cold'],
  [
    item('Bracers of Celerity|PaBTSO'),
    A,
    allSaves,
    'to avoid or end the paralyzed or restrained conditions',
  ],
  [item('Cape of Enlargement|PaBTSO'), A, saves('str')],
  [item('Cape of Enlargement|PaBTSO'), A, checksOf('str')],
  [item('Ring of Red Fury|CRCotN'), A, saves('str')],
  [item('Ring of Red Fury|CRCotN'), A, checksOf('str')],
  [item('Powered Armor|QftIS'), A, checksOf('str')],
  [item('Powered Armor|LLK'), A, deathSaves],
  [
    item('Cloak of Billowing|WttHC'),
    A,
    checks('performance'),
    'to amuse humanoid onlookers while the cloak is billowing',
  ],
  [
    item('Dread Helm|WttHC'),
    A,
    checks('intimidation'),
    'to intimidate a humanoid who sees you wearing it',
  ],
  [item('Piwafwi (Cloak of Elvenkind)|OotA'), A, checks('stealth'), 'made to hide'],
  [item('Piwafwi of Fire Resistance|OotA'), A, checks('stealth'), 'made to hide'],
  [
    item('Costume|XPHB'),
    A,
    everyCheck,
    'made to impersonate the person or type of person it represents',
  ],
  [
    item("Cultist's Robe|HotB"),
    A,
    everyCheck,
    'made to impersonate a cultist in the Cult of Chaos',
  ],
  [
    item("Danoth's Visor (Dormant)|EGW"),
    A,
    checks('investigation', 'perception'),
    'that rely on sight',
  ],
  [
    item('Defias Leather|WoW'),
    A,
    checks('stealth'),
    'made to hide behind stone objects and structures',
  ],
  [item('Demon Armor|DMG'), D, allSaves, DEMONS],
  [variant('Demon Armor'), D, allSaves, DEMONS],
  [item('Diamond Staff|AU'), A, checks('arcana'), 'while holding the staff'],
  [
    item("Donjon's Sundering Sphere|BMT"),
    A,
    allSaves,
    'against spells or effects that send you to another plane or space',
  ],
  [
    item('Dream Weaver|AU'),
    A,
    saves('int', 'wis', 'cha'),
    'while you have the unconscious condition',
  ],
  [item('Ebonbane|RHW'), A, allSaves, MAGIC],
  ...['DMG', 'XDMG'].map((book): Row => [
    item(`Eyes of the Eagle|${book}`),
    A,
    checks('perception'),
    'that rely on sight',
  ]),
  [item('Far Gear|AI'), A, checks('intimidation')],
  [
    item('Garb of Light and Shadow|FRHoF'),
    A,
    everyCheck,
    'to influence Fey associated with its Domain of Delight',
  ],
  [
    item('Genie Robe|FRHoF'),
    A,
    everyCheck,
    'to influence Elementals associated with its plane',
  ],
  [
    item('Goggles of Object Reading|EGW'),
    A,
    checks('arcana'),
    'to reveal information about a creature or object you can see',
  ],
  [item('Greater Silver Sword|MTF'), A, saves('int', 'wis', 'cha')],
  [item('Grimoire Infinitus (Awakened)|EGW'), A, allSaves, MAGIC],
  [
    item('Grovelthrash (Dormant)|EGW'),
    A,
    checks('insight'),
    'to discern a lie spoken in a language you understand',
  ],
  [item('Helm of Perfect Potential|BGG'), A, checks('deception', 'insight')],
  [item('Ioun Stone, Awareness|XDMG'), A, checks('perception')],
  [
    item('Jester Card|BMT'),
    A,
    saves('con'),
    "to maintain concentration on Otto's Irresistible Dance",
  ],
  [item('Kagonesti Forest Shroud|DSotDQ'), A, checks('stealth')],
  [item("Knave's Eye Patch|WDH"), A, checks('perception'), 'that rely on sight'],
  [
    item('Leather Golem Armor|LLK'),
    D,
    everyCheck,
    'until the end of your next turn, after you take fire damage',
  ],
  [
    item('Lost Crown of Besilmer|PotA'),
    A,
    allSaves,
    'against effects that would charm you',
  ],
  [item('Mindguard Crown|PaBTSO'), A, saves('int', 'wis', 'cha')],
  [item('Necklace of Adaptation|DMG'), A, allSaves, 'against harmful gases and vapors'],
  [item('Necklace of Adaptation|XDMG'), A, allSaves, POISONED],
  [item('Nepenthe|VRGR'), A, allSaves, MAGIC],
  [item('Nether Scroll of Azumar|CM'), A, allSaves, MAGIC],
  [item('Obsidian Flint Dragon Plate|BGDIA'), A, allSaves, GRAPPLED],
  [
    item('Obsidian Flint Dragon Plate|BGDIA'),
    A,
    checks('athletics', 'acrobatics'),
    GRAPPLED,
  ],
  [
    item('Ominous Staff of Skulls|AU'),
    A,
    checks('intimidation'),
    'made while holding it',
  ],
  [item('Orb of the Stein Rune|SKT'), A, saves('str'), 'while you wear the boots'],
  [item('Orb of the Veil|EGW'), A, checksOf('wis'), 'to find hidden doors and paths'],
  [item('Periapt of Health|XDMG'), A, allSaves, POISONED],
  [
    item('Ring of Truth Telling|WDH'),
    A,
    checks('insight'),
    'to determine whether someone is lying to you',
  ],
  [item('Robe of Eyes|DMG'), A, checks('perception'), 'that rely on sight'],
  ...['DMG', 'XDMG'].flatMap((book): Row[] => [
    [item(`Rod of Alertness|${book}`), A, checks('perception')],
    [item(`Sentinel Shield|${book}`), A, checks('perception')],
  ]),
  [item('Shadowfell Brand Tattoo|TCE'), A, checks('stealth')],
  [
    item('Shard of the Ise Rune|SKT'),
    A,
    checks('stealth'),
    'made while in snowy terrain',
  ],
  [item('Shrieking Greaves|BMT'), A, saves('dex')],
  [item('Shrieking Greaves|BMT'), D, allSaves, 'against being frightened'],
  [item('Slumbering Scaled Ornament|FTD'), A, allSaves, CHARMED_FRIGHTENED],
  [
    item("Stonebreaker's Breastplate|BGG"),
    A,
    saves('con'),
    'to maintain concentration on the spell it cast',
  ],
  [item('Sword of Zariel|BGDIA'), A, checks('insight')],
  [
    item('Talisman of the Sphere|XDMG'),
    A,
    checks('arcana'),
    'to control a Sphere of Annihilation',
  ],
  [
    item('Teeth of Dahlver-Nar|TCE'),
    D,
    checks('insight', 'perception'),
    'from the constant whispers of memories and nearby minds',
  ],
  [item('The Bloody End (Dormant)|EGW'), A, checks('intimidation')],
  [item('Staff of the Lost|AU'), D, checks('survival'), 'made to navigate'],
  [
    item('Ventilating Lungs|ERLW'),
    A,
    allSaves,
    'against harmful gases such as cloudkill',
  ],
  [item('Verminshroud (Dormant)|EGW'), A, checks('perception'), SMELL],
  [item("Wayfarer's Boots|BGG"), A, checks('survival')],
  [item('Watchful Helm|CM'), A, checks('perception'), 'that rely on sight'],
  [item('Whelm|DMG'), D, allSaves, 'while you can see the daytime sky'],
  [item('Whelm|DMG'), D, everyCheck, 'while you can see the daytime sky'],
  [
    item('Winter Camouflage|FRHoF'),
    A,
    checks('stealth'),
    'in an appropriate environment',
  ],
  // ---- Generic variants: any item made from them ----------------------------------------
  [variant('Feywrought Armor'), A, allSaves, CHARMED],
  [variant('Gloomwrought Armor'), A, allSaves, FRIGHTENED],
  [variant('Holy Avenger'), A, allSaves, MAGIC],
  [variant('Zephyr Armor'), A, saves('dex')],
  [variant('Zephyr Armor'), A, checks('acrobatics')],
  // ---- Death saving throws: a note on the hit point maximum's lines ---------------------
  [feat('Durable|XPHB'), A, deathSaves],
  [feat('Touch of Death|RHW'), D, deathSaves],
  [race('Reborn', 'RHW'), A, deathSaves],
  [reward('Fragment of Pity|CRCotN'), D, deathSaves],
  [sub('Fighter', 'Champion', 'XPHB', 'Survivor'), A, deathSaves],
  // ---- Escaping a grapple or a restraint --------------------------------------------------
  [
    feat('Vampire Hunter|ABH'),
    A,
    checks('athletics', 'acrobatics'),
    'to escape from nonmagical restraints or the grappled condition',
  ],
  [
    reward('Boon of the Unfettered|DMG'),
    A,
    checks('athletics', 'acrobatics'),
    'made to resist being grappled',
  ],
]

/** Every row, with the item rows of a book the data does not have dropped by the audit. */
export const STANDING_RULES: readonly StandingRule[] = ROWS.map(rowOf)
