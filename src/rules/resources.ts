// The limited-use features: how many uses each gives and what restores them, by the
// feature, species trait, feat or option that holds it. A count the class table states
// is read from that table (`column`); the rest the books state in prose, and a row here
// says it. Free casts of a spell and item charges are data and are read from it. The
// audit in resources.test.ts finds every record whose text states a use limit and checks
// that it has a row here or is excused below.

import type { AbilityKey } from '../dice/dice'
import type { Holder } from './holder'

/** How many uses: at most one of these per row. */
export type UseCount =
  | { kind: 'fixed'; count: number }
  /** By the holder's class level: each step is `[from level, count]`. */
  | { kind: 'byLevel'; steps: readonly (readonly [number, number])[] }
  | { kind: 'prof'; times: number }
  /** `times` x the ability modifier + `plus`, never below `min`. */
  | { kind: 'ability'; ability: AbilityKey; min: number; times: number; plus: number }
  /** The column of the holder's class or subclass level table ("Rages"). */
  | { kind: 'column'; column: string }
  /** `times` x the holder's class level + `plus` (Lay on Hands). */
  | { kind: 'perLevel'; times: number; plus: number }

/**
 * What restores the uses: `short` all on a short or a long rest, `long` all on a long
 * rest, `shortOne` one on a short rest and all on a long rest, `none` no rest at all.
 */
export type Recharge = 'short' | 'long' | 'shortOne' | 'none'

export interface ResourceRule {
  holder: Holder
  count: UseCount
  recharge: Recharge
  /** The trait or benefit inside the holder that has the uses ("Breath Weapon"). */
  feature?: string
  /** The counter's name, when it is not the feature's ("Superiority Dice"). */
  label?: string
  /** The uses add to another holder's counter of the same name (Martial Adept's die). */
  adds?: true
}

/** A feature that changes another counter: its recharge, or how many uses it has. */
export interface ResourceChange {
  holder: Holder
  /** The name of the counter it changes. */
  target: string
  recharge?: Recharge
  /** Uses a short rest restores on top of the recharge (Sorcerous Restoration). */
  shortRegain?: number
  count?: UseCount
}

export const fixed = (count: number): UseCount => ({ kind: 'fixed', count })
export const prof = (times = 1): UseCount => ({ kind: 'prof', times })
export const column = (name: string): UseCount => ({ kind: 'column', column: name })
export const perLevel = (times: number, plus = 0): UseCount => ({
  kind: 'perLevel',
  times,
  plus,
})
export const byLevel = (...steps: (readonly [number, number])[]): UseCount => ({
  kind: 'byLevel',
  steps,
})
export const ability = (key: AbilityKey, min = 1, times = 1, plus = 0): UseCount => ({
  kind: 'ability',
  ability: key,
  min,
  times,
  plus,
})

const cf = (name: string, source: string, className: string): Holder => ({
  classFeature: { className, source, name },
})
const sf = (
  name: string,
  source: string,
  className: string,
  shortName: string,
): Holder => ({
  subclassFeature: { className, shortName, source, name },
})
const feat = (key: string): Holder => ({ feat: key })
const option = (key: string): Holder => ({ option: key })
const race = (baseName: string, source: string, subraceName?: string): Holder => ({
  race: { baseName, source, ...(subraceName ? { subraceName } : {}) },
})

const r = (
  holder: Holder,
  count: UseCount,
  recharge: Recharge,
  extra: Pick<ResourceRule, 'feature' | 'label' | 'adds'> = {},
): ResourceRule => ({ holder, count, recharge, ...extra })

const RUNES = ['Cloud', 'Fire', 'Frost', 'Hill', 'Stone', 'Storm']

export const RESOURCE_CHANGES: readonly ResourceChange[] = [
  ...(['PHB', 'XPHB'] as const).map((source): ResourceChange => ({
    holder: cf('Font of Inspiration', source, 'Bard'),
    target: 'Bardic Inspiration',
    recharge: 'short',
  })),
  {
    holder: cf('Sorcerous Restoration', 'PHB', 'Sorcerer'),
    target: 'Sorcery Points',
    shortRegain: 4,
  },
  {
    holder: sf('Improved Warding Flare', 'XPHB', 'Cleric', 'Light'),
    target: 'Warding Flare',
    recharge: 'short',
  },
  {
    holder: cf('Soul of Artifice', 'EFA', 'Artificer'),
    target: 'Flash of Genius',
    recharge: 'short',
  },
  ...RUNES.map((rune): ResourceChange => ({
    holder: sf('Master of Runes', 'TCE', 'Fighter', 'Rune Knight'),
    target: `${rune} Rune`,
    count: fixed(2),
  })),
  {
    holder: sf('Dread Incarnate', 'FRHoF', 'Rogue', 'Scion of the Three'),
    target: 'Bloodthirst',
    recharge: 'shortOne',
  },
  {
    holder: feat('Greater Aberrant Mark|EFA'),
    target: 'Aberrant Fortitude',
    recharge: 'short',
  },
]

/**
 * The records whose text states a use limit that is not a count of uses for a counter,
 * by the address `holderId` writes, with why.
 */
export const RESOURCE_EXCUSED: Readonly<Record<string, string>> = {
  'classFeature|Spellcasting|EFA|Artificer':
    'spell slots: the spell slot pips count them',
  'classFeature|Soul of Artifice|EFA|Artificer':
    'changes how Flash of Genius recharges; its row carries the change',
  'classFeature|Spellcasting|TCE|Artificer':
    'spell slots: the spell slot pips count them',
  'classFeature|Spellcasting|PHB|Bard': 'spell slots: the spell slot pips count them',
  'classFeature|Song of Rest (d6)|PHB|Bard':
    'adds to the healing of hit dice on a rest, not a count of uses',
  'classFeature|Font of Inspiration|PHB|Bard':
    'changes how Bardic Inspiration recharges; its row carries the change',
  'classFeature|Spellcasting|XPHB|Bard': 'spell slots: the spell slot pips count them',
  'classFeature|Font of Inspiration|XPHB|Bard':
    'changes how Bardic Inspiration recharges; its row carries the change',
  'classFeature|Superior Inspiration|XPHB|Bard':
    'regains Bardic Inspiration when initiative is rolled, by hand; no count of its own',
  'subclassFeature|Spirits from Beyond|RHW|Bard|Spirits':
    'how long an effect lasts, not a count of uses',
  'classFeature|Spellcasting|PHB|Cleric': 'spell slots: the spell slot pips count them',
  'classFeature|Spellcasting|XPHB|Cleric': 'spell slots: the spell slot pips count them',
  'subclassFeature|Improved Warding Flare|XPHB|Cleric|Light':
    'changes how Warding Flare recharges; its row carries the change',
  'subclassFeature|Blessing of the Trickster|XPHB|Cleric|Trickery':
    'how long an effect lasts, not a count of uses',
  'classFeature|Death Coil|WoW|Death Knight':
    'a die pool whose size is set by a table in the text, not tabled',
  'classFeature|Spellcasting|WoW|Demon Hunter':
    'spell slots: the spell slot pips count them',
  'classFeature|Spellcasting|PHB|Druid': 'spell slots: the spell slot pips count them',
  'classFeature|Spellcasting|XPHB|Druid': 'spell slots: the spell slot pips count them',
  'subclassFeature|Spellcasting|PHB|Fighter|Eldritch Knight':
    'spell slots: the spell slot pips count them',
  'subclassFeature|Rune Carver|TCE|Fighter|Rune Knight':
    'how long an effect lasts, not a count of uses',
  'subclassFeature|Master of Runes|TCE|Fighter|Rune Knight':
    'changes how each rune recharges; its row carries the change',
  'subclassFeature|Spellcasting|XPHB|Fighter|Eldritch Knight':
    'spell slots: the spell slot pips count them',
  'subclassFeature|Spellcasting|AU|Monk|Mystic Arts':
    'spell slots: the spell slot pips count them',
  'subclassFeature|Psionic Surge|UATheMysticClass|Mystic|Awakened':
    'ends psychic focus until a rest; no count of uses',
  'subclassFeature|Surge of Health|UATheMysticClass|Mystic|Immortal':
    'ends psychic focus until a rest; no count of uses',
  'subclassFeature|Breadth of Knowledge|UATheMysticClass|Mystic|Nomad':
    'how long an effect lasts, not a count of uses',
  'classFeature|Spellcasting|PHB|Paladin': 'spell slots: the spell slot pips count them',
  'classFeature|Spellcasting|XPHB|Paladin': 'spell slots: the spell slot pips count them',
  'subclassFeature|Emissary of Redemption|XGE|Paladin|Redemption':
    'a condition that ends the benefit until a long rest, not a count of uses',
  'classFeature|Spellcasting|PHB|Ranger': 'spell slots: the spell slot pips count them',
  'classFeature|Spellcasting|XPHB|Ranger': 'spell slots: the spell slot pips count them',
  "subclassFeature|Slayer's Prey|XGE|Ranger|Monster Slayer":
    'how long an effect lasts, not a count of uses',
  'subclassFeature|Spellcasting|PHB|Rogue|Arcane Trickster':
    'spell slots: the spell slot pips count them',
  'subclassFeature|Dread Incarnate|FRHoF|Rogue|Scion of the Three':
    'changes how Bloodthirst recharges; its row carries the change',
  'subclassFeature|Spellcasting|XPHB|Rogue|Arcane Trickster':
    'spell slots: the spell slot pips count them',
  'classFeature|Spellcasting|TCE|Spellcaster Sidekick':
    'spell slots: the spell slot pips count them',
  'classFeature|Spellcasting|PHB|Sorcerer': 'spell slots: the spell slot pips count them',
  'classFeature|Sorcerous Restoration|PHB|Sorcerer':
    'changes how Sorcery Points recharges; its row carries the change',
  'classFeature|Spellcasting|XPHB|Sorcerer':
    'spell slots: the spell slot pips count them',
  'subclassFeature|Bastion of Law|TCE|Sorcerer|Clockwork Soul':
    'how long an effect lasts, not a count of uses',
  'subclassFeature|Shadow Magic|XGE|Sorcerer|Shadow':
    'casts Darkness with sorcery points; the Sorcery Points counter counts it',
  'subclassFeature|Bastion of Law|XPHB|Sorcerer|Clockwork':
    'how long an effect lasts, not a count of uses',
  'classFeature|Pact Magic|PHB|Warlock': 'spell slots: the spell slot pips count them',
  'classFeature|Pact Magic|XPHB|Warlock': 'spell slots: the spell slot pips count them',
  'subclassFeature|Sanctuary Vessel|TCE|Warlock|Genie':
    'a short rest taken in the vessel, not a count of uses',
  'subclassFeature|Hex Warrior|XGE|Warlock|Hexblade':
    'how long an effect lasts, not a count of uses',
  'subclassFeature|Vestige Power|AU|Warlock|Vestige':
    "a use of the vestige companion's own, not the character's",
  'classFeature|Spellcasting|PHB|Wizard': 'spell slots: the spell slot pips count them',
  'classFeature|Spellcasting|XPHB|Wizard': 'spell slots: the spell slot pips count them',
  'subclassFeature|Hypnotic Gaze|PHB|Wizard|Enchantment':
    'a limit per creature or target, not a count of uses',
  'feat|Chef|XPHB':
    'treats cooked after a rest and food for a short rest, not a count of uses',
  'feat|Greater Aberrant Mark|EFA':
    'changes how Aberrant Fortitude recharges; its row carries the change',
  'feat|Healer|PHB': 'a limit per creature or target, not a count of uses',
  'feat|Planar Wanderer|SatO': 'a limit per creature or target, not a count of uses',
  'feat|Spell Subterfuge|AU':
    'counts the modifier of the ability the feat raised, which the character does not record',
  'optionalfeature|Chains of Carceri|PHB':
    'a limit per creature or target, not a count of uses',
  'optionalfeature|Favored in House|EFA':
    'counts the Renown score, which the character does not record',
  'race|Pandaren|WoW': 'adds to the healing of hit dice on a rest, not a count of uses',
  'race|Troll|WoW': 'adds to the healing of hit dice on a rest, not a count of uses',
}

export const RESOURCE_RULES: readonly ResourceRule[] = [
  r(cf("Tinker's Magic", 'EFA', 'Artificer'), ability('int'), 'long'),
  r(cf('Magic Item Tinker', 'EFA', 'Artificer'), fixed(1), 'long'),
  r(cf('Flash of Genius', 'EFA', 'Artificer'), ability('int'), 'long'),
  r(cf('Spell-Storing Item', 'EFA', 'Artificer'), ability('int', 2, 2), 'none'),
  r(cf('Flash of Genius', 'TCE', 'Artificer'), ability('int'), 'long'),
  r(cf('Spell-Storing Item', 'TCE', 'Artificer'), ability('int', 2, 2), 'none'),
  r(sf('Restorative Reagents', 'EFA', 'Artificer', 'Alchemist'), ability('int'), 'long'),
  r(sf('Chemical Mastery', 'EFA', 'Artificer', 'Alchemist'), fixed(1), 'long', {
    feature: 'Conjured Cauldron',
  }),
  r(sf('Dreadnaught', 'EFA', 'Artificer', 'Armorer'), ability('int'), 'long'),
  r(sf('Perfected Armor', 'EFA', 'Artificer', 'Armorer'), ability('int'), 'long', {
    feature: 'Guardian',
  }),
  r(sf('Perfected Armor', 'EFA', 'Artificer', 'Armorer'), ability('int'), 'long', {
    feature: 'Infiltrator',
  }),
  r(sf('Eldritch Cannon', 'EFA', 'Artificer', 'Artillerist'), fixed(1), 'long'),
  r(sf('Arcane Jolt', 'EFA', 'Artificer', 'Battle Smith'), ability('int'), 'long'),
  r(sf('Mapping Magic', 'EFA', 'Artificer', 'Cartographer'), ability('int'), 'long', {
    feature: 'Illuminated Cartography',
  }),
  r(sf('Superior Atlas', 'EFA', 'Artificer', 'Cartographer'), fixed(1), 'long', {
    feature: 'Unerring Path',
  }),
  r(sf('Reanimated Companion', 'RHW', 'Artificer', 'Reanimator'), fixed(1), 'long'),
  r(
    sf("Reanimator's Skill Set", 'RHW', 'Artificer', 'Reanimator'),
    ability('int', 0),
    'long',
    { feature: 'Jolt to Life' },
  ),
  r(sf('Refined Reanimation', 'RHW', 'Artificer', 'Reanimator'), fixed(1), 'long', {
    feature: 'Facilitated Revival',
  }),
  r(sf('Restorative Reagents', 'TCE', 'Artificer', 'Alchemist'), ability('int'), 'long'),
  r(sf('Chemical Mastery', 'TCE', 'Artificer', 'Alchemist'), fixed(2), 'long', {
    label: 'Chemical Mastery: one cast of each spell',
  }),
  r(sf('Defensive Field', 'TCE', 'Artificer', 'Armorer'), prof(), 'long'),
  r(sf('Guardian', 'TCE', 'Artificer', 'Armorer'), prof(), 'long'),
  r(sf('Eldritch Cannon', 'TCE', 'Artificer', 'Artillerist'), fixed(1), 'long'),
  r(sf('Arcane Jolt', 'TCE', 'Artificer', 'Battle Smith'), ability('int'), 'long'),
  r(cf('Rage', 'PHB', 'Barbarian'), column('Rages'), 'long'),
  r(cf('Rage', 'XPHB', 'Barbarian'), column('Rages'), 'shortOne'),
  r(cf('Persistent Rage', 'XPHB', 'Barbarian'), fixed(1), 'long'),
  r(sf('Infectious Fury', 'TCE', 'Barbarian', 'Beast'), prof(), 'long'),
  r(sf('Call the Hunt', 'TCE', 'Barbarian', 'Beast'), prof(), 'long'),
  r(sf('Magic Awareness', 'TCE', 'Barbarian', 'Wild Magic'), prof(), 'long'),
  r(sf('Bolstering Magic', 'TCE', 'Barbarian', 'Wild Magic'), prof(), 'long'),
  r(
    sf('Consult the Spirits', 'XGE', 'Barbarian', 'Ancestral Guardian'),
    fixed(1),
    'short',
  ),
  r(sf('Zealous Presence', 'XGE', 'Barbarian', 'Zealot'), fixed(1), 'long'),
  r(
    sf('Consult the Spirits', 'WoW', 'Barbarian', 'Spiritual Guardian'),
    fixed(1),
    'short',
  ),
  r(sf('Intimidating Presence', 'XPHB', 'Barbarian', 'Berserker'), fixed(1), 'long'),
  r(
    sf('Warrior of the Gods', 'XPHB', 'Barbarian', 'Zealot'),
    byLevel([3, 4], [6, 5], [12, 6], [17, 7]),
    'long',
    { label: 'Warrior of the Gods dice' },
  ),
  r(sf('Zealous Presence', 'XPHB', 'Barbarian', 'Zealot'), fixed(1), 'long'),
  r(sf('Rage of the Gods', 'XPHB', 'Barbarian', 'Zealot'), fixed(1), 'long'),
  r(cf('Bardic Inspiration', 'PHB', 'Bard'), ability('cha'), 'long'),
  r(cf('Bardic Inspiration', 'XPHB', 'Bard'), ability('cha'), 'long'),
  r(sf('Performance of Creation', 'TCE', 'Bard', 'Creation'), fixed(1), 'long'),
  r(sf('Animating Performance', 'TCE', 'Bard', 'Creation'), fixed(1), 'long'),
  r(sf('Universal Speech', 'TCE', 'Bard', 'Eloquence'), fixed(1), 'long'),
  r(sf('Infectious Inspiration', 'TCE', 'Bard', 'Eloquence'), ability('cha'), 'long'),
  r(sf('Enthralling Performance', 'XGE', 'Bard', 'Glamour'), fixed(1), 'short'),
  r(sf('Mantle of Majesty', 'XGE', 'Bard', 'Glamour'), fixed(1), 'long'),
  r(sf('Unbreakable Majesty', 'XGE', 'Bard', 'Glamour'), fixed(1), 'short'),
  r(sf('Words of Terror', 'XGE', 'Bard', 'Whispers'), fixed(1), 'short'),
  r(sf('Mantle of Whispers', 'XGE', 'Bard', 'Whispers'), fixed(1), 'short'),
  r(sf('Shadow Lore', 'XGE', 'Bard', 'Whispers'), fixed(1), 'long'),
  r(sf('Blessing of Moonlight', 'FRHoF', 'Bard', 'Moon'), fixed(1), 'long'),
  r(sf('Empowered Channeling', 'RHW', 'Bard', 'Spirits'), fixed(1), 'short', {
    feature: 'Spiritual Manifestation',
  }),
  r(sf('Beguiling Magic', 'XPHB', 'Bard', 'Glamour'), fixed(1), 'long'),
  r(sf('Mantle of Majesty', 'XPHB', 'Bard', 'Glamour'), fixed(1), 'long'),
  r(sf('Unbreakable Majesty', 'XPHB', 'Bard', 'Glamour'), fixed(1), 'short'),
  r(cf('Channel Divinity', 'PHB', 'Cleric'), byLevel([2, 1], [6, 2], [18, 3]), 'short'),
  r(
    cf('Channel Divinity: Harness Divine Power', 'TCE', 'Cleric'),
    byLevel([2, 1], [6, 2], [18, 3]),
    'long',
  ),
  r(cf('Channel Divinity', 'XPHB', 'Cleric'), column('Channel Divinity'), 'shortOne'),
  r(cf('Divine Intervention', 'XPHB', 'Cleric'), fixed(1), 'long'),
  r(
    sf('Channel Divinity: Read Thoughts', 'PHB', 'Cleric', 'Knowledge'),
    fixed(1),
    'long',
  ),
  r(sf('Visions of the Past', 'PHB', 'Cleric', 'Knowledge'), fixed(1), 'short'),
  r(sf('Warding Flare', 'PHB', 'Cleric', 'Light'), ability('wis'), 'long'),
  r(sf('Wrath of the Storm', 'PHB', 'Cleric', 'Tempest'), ability('wis'), 'long'),
  r(sf('War Priest', 'PHB', 'Cleric', 'War'), ability('wis'), 'long'),
  r(sf('Warding Flare', 'PSA', 'Cleric', 'Ambition (PSA)'), ability('wis'), 'long'),
  r(
    sf("Solidarity's Action", 'PSA', 'Cleric', 'Solidarity (PSA)'),
    ability('wis'),
    'long',
  ),
  r(sf('Priest of Zeal', 'PSA', 'Cleric', 'Zeal (PSA)'), ability('wis'), 'long'),
  r(sf('Blaze of Glory', 'PSA', 'Cleric', 'Zeal (PSA)'), fixed(1), 'long'),
  r(sf('Embodiment of the Law', 'TCE', 'Cleric', 'Order'), ability('wis'), 'long'),
  r(sf('Emboldening Bond', 'TCE', 'Cleric', 'Peace'), prof(), 'long'),
  r(sf('Eyes of Night', 'TCE', 'Cleric', 'Twilight'), fixed(1), 'long'),
  r(sf('Steps of Night', 'TCE', 'Cleric', 'Twilight'), prof(), 'long'),
  r(sf('Blessing of the Forge', 'XGE', 'Cleric', 'Forge'), fixed(1), 'long'),
  r(sf('Eyes of the Grave', 'XGE', 'Cleric', 'Grave'), ability('wis'), 'long'),
  r(sf("Sentinel at Death's Door", 'XGE', 'Cleric', 'Grave'), ability('wis'), 'long'),
  r(sf('Dispelling Recovery', 'AU', 'Cleric', 'Arcana'), fixed(1), 'short'),
  r(sf('Divine Foreknowledge', 'FRHoF', 'Cleric', 'Knowledge'), fixed(1), 'long'),
  r(sf("Sentinel at Death's Door", 'RHW', 'Cleric', 'Grave'), ability('wis'), 'long'),
  r(sf('Divine Reaper', 'RHW', 'Cleric', 'Grave'), fixed(1), 'short', {
    feature: 'Keeper of Souls',
  }),
  r(sf('Devouring Plague', 'WoW', 'Cleric', 'Shadow'), ability('wis'), 'long'),
  r(sf('Dispersion', 'WoW', 'Cleric', 'Shadow'), fixed(1), 'short'),
  r(sf('Warding Flare', 'XPHB', 'Cleric', 'Light'), ability('wis'), 'long'),
  r(sf('Corona of Light', 'XPHB', 'Cleric', 'Light'), ability('wis'), 'long'),
  r(sf('War Priest', 'XPHB', 'Cleric', 'War'), ability('wis'), 'short'),
  r(cf('Runic Smite', 'WoW', 'Death Knight'), fixed(1), 'long'),
  r(cf('Faithful Steed', 'WoW', 'Death Knight'), fixed(1), 'long'),
  r(sf('Runic Mastery', 'WoW', 'Death Knight', 'Ebon Blade'), fixed(1), 'long'),
  r(sf('Aspect of the Horsemen', 'WoW', 'Death Knight', 'Ebon Blade'), fixed(1), 'long'),
  r(cf('Wild Shape', 'PHB', 'Druid'), fixed(2), 'short'),
  r(cf('Wild Shape', 'XPHB', 'Druid'), column('Wild Shape'), 'shortOne'),
  r(cf('Wild Resurgence', 'XPHB', 'Druid'), fixed(1), 'long'),
  r(cf('Archdruid', 'XPHB', 'Druid'), fixed(1), 'long'),
  r(sf('Natural Recovery', 'PHB', 'Druid', 'Land'), fixed(1), 'long'),
  r(sf('Fungal Infestation', 'TCE', 'Druid', 'Spores'), ability('wis'), 'long'),
  r(sf('Star Map', 'TCE', 'Druid', 'Stars'), prof(), 'long'),
  r(sf('Cosmic Omen', 'TCE', 'Druid', 'Stars'), prof(), 'long'),
  r(sf('Cauterizing Flames', 'TCE', 'Druid', 'Wildfire'), prof(), 'long'),
  r(sf('Blazing Revival', 'TCE', 'Druid', 'Wildfire'), fixed(1), 'long'),
  r(sf('Balm of the Summer Court', 'XGE', 'Druid', 'Dreams'), perLevel(1), 'long', {
    label: 'Balm of the Summer Court dice',
  }),
  r(sf('Hidden Paths', 'XGE', 'Druid', 'Dreams'), ability('wis'), 'long'),
  r(sf('Walker in Dreams', 'XGE', 'Druid', 'Dreams'), fixed(1), 'long'),
  r(sf('Spirit Totem', 'XGE', 'Druid', 'Shepherd'), fixed(1), 'short'),
  r(sf('Faithful Summons', 'XGE', 'Druid', 'Shepherd'), fixed(1), 'long'),
  r(sf('Natural Recovery', 'XPHB', 'Druid', 'Land'), fixed(1), 'long'),
  r(sf('Moonlight Step', 'XPHB', 'Druid', 'Moon'), ability('wis'), 'long'),
  r(sf('Star Map', 'XPHB', 'Druid', 'Stars'), ability('wis'), 'long'),
  r(sf('Cosmic Omen', 'XPHB', 'Druid', 'Stars'), ability('wis'), 'long'),
  r(cf('Second Wind', 'PHB', 'Fighter'), fixed(1), 'short'),
  r(cf('Action Surge', 'PHB', 'Fighter'), byLevel([2, 1], [17, 2]), 'short'),
  r(cf('Indomitable', 'PHB', 'Fighter'), byLevel([9, 1], [13, 2], [17, 3]), 'long'),
  r(cf('Second Wind', 'XPHB', 'Fighter'), column('Second Wind'), 'shortOne'),
  r(cf('Action Surge', 'XPHB', 'Fighter'), byLevel([2, 1], [17, 2]), 'short'),
  r(cf('Indomitable', 'XPHB', 'Fighter'), byLevel([9, 1], [13, 2], [17, 3]), 'long'),
  r(sf('Unleash Incarnation', 'EGW', 'Fighter', 'Echo Knight'), ability('con'), 'long'),
  r(sf('Shadow Martyr', 'EGW', 'Fighter', 'Echo Knight'), fixed(1), 'short'),
  r(sf('Reclaim Potential', 'EGW', 'Fighter', 'Echo Knight'), ability('con'), 'long'),
  r(
    sf('Combat Superiority', 'PHB', 'Fighter', 'Battle Master'),
    byLevel([3, 4], [7, 5], [15, 6]),
    'short',
    { label: 'Superiority Dice' },
  ),
  r(sf('Telekinetic Movement', 'TCE', 'Fighter', 'Psi Warrior'), fixed(1), 'short'),
  r(sf('Psionic Power', 'TCE', 'Fighter', 'Psi Warrior'), prof(2), 'long', {
    label: 'Psionic Energy Dice',
  }),
  r(sf('Psionic Power', 'TCE', 'Fighter', 'Psi Warrior'), fixed(1), 'short', {
    label: 'Psionic Power: regain a die',
  }),
  r(sf('Psi-Powered Leap', 'TCE', 'Fighter', 'Psi Warrior'), fixed(1), 'short'),
  r(sf('Bulwark of Force', 'TCE', 'Fighter', 'Psi Warrior'), fixed(1), 'long'),
  r(sf('Telekinetic Master', 'TCE', 'Fighter', 'Psi Warrior'), fixed(1), 'long'),
  r(sf("Giant's Might", 'TCE', 'Fighter', 'Rune Knight'), prof(), 'long'),
  r(sf('Runic Shield', 'TCE', 'Fighter', 'Rune Knight'), prof(), 'long'),
  r(sf('Arcane Shot', 'XGE', 'Fighter', 'Arcane Archer'), fixed(2), 'short'),
  r(sf('Unwavering Mark', 'XGE', 'Fighter', 'Cavalier'), ability('str'), 'long'),
  r(sf('Warding Maneuver', 'XGE', 'Fighter', 'Cavalier'), ability('con'), 'long'),
  r(sf('Fighting Spirit', 'XGE', 'Fighter', 'Samurai'), fixed(3), 'long'),
  r(sf('Strength before Death', 'XGE', 'Fighter', 'Samurai'), fixed(1), 'long'),
  r(sf('Arcane Shot', 'AU', 'Fighter', 'Arcane Archer'), ability('int'), 'short', {
    feature: 'Using Arcane Shot',
  }),
  r(sf('Magical Ammunition', 'AU', 'Fighter', 'Arcane Archer'), fixed(1), 'short'),
  r(sf('Group Recovery', 'FRHoF', 'Fighter', 'Banneret'), fixed(1), 'short'),
  r(
    sf('Combat Superiority', 'XPHB', 'Fighter', 'Battle Master'),
    byLevel([3, 4], [7, 5], [15, 6]),
    'short',
    { label: 'Superiority Dice' },
  ),
  r(sf('Know Your Enemy', 'XPHB', 'Fighter', 'Battle Master'), fixed(1), 'long'),
  r(sf('Psionic Power', 'XPHB', 'Fighter', 'Psi Warrior'), column('Number'), 'shortOne', {
    label: 'Psionic Energy Dice',
  }),
  r(sf('Telekinetic Movement', 'XPHB', 'Fighter', 'Psi Warrior'), fixed(1), 'short'),
  r(sf('Psi-Powered Leap', 'XPHB', 'Fighter', 'Psi Warrior'), fixed(1), 'short'),
  r(sf('Bulwark of Force', 'XPHB', 'Fighter', 'Psi Warrior'), fixed(1), 'long'),
  r(sf('Telekinetic Master', 'XPHB', 'Fighter', 'Psi Warrior'), fixed(1), 'long'),
  r(cf('Ki', 'PHB', 'Monk'), column('Ki Points'), 'short', { label: 'Ki Points' }),
  r(cf("Monk's Focus", 'XPHB', 'Monk'), column('Focus Points'), 'short', {
    label: 'Focus Points',
  }),
  r(cf('Uncanny Metabolism', 'XPHB', 'Monk'), fixed(1), 'long'),
  r(sf('Breath of the Dragon', 'FTD', 'Monk', 'Ascendant Dragon'), prof(), 'long'),
  r(sf('Draconic Disciple', 'FTD', 'Monk', 'Ascendant Dragon'), fixed(1), 'long'),
  r(sf('Wings Unfurled', 'FTD', 'Monk', 'Ascendant Dragon'), prof(), 'long'),
  r(sf('Aspect of the Wyrm', 'FTD', 'Monk', 'Ascendant Dragon'), fixed(1), 'long'),
  r(sf('Wholeness of Body', 'PHB', 'Monk', 'Open Hand'), fixed(1), 'long'),
  r(sf('Hand of Ultimate Mercy', 'TCE', 'Monk', 'Mercy'), fixed(1), 'long'),
  r(sf('Flurry of Healing and Harm', 'XPHB', 'Monk', 'Mercy'), ability('wis'), 'long'),
  r(sf('Hand of Ultimate Mercy', 'XPHB', 'Monk', 'Mercy'), fixed(1), 'long'),
  r(sf('Wholeness of Body', 'XPHB', 'Monk', 'Open Hand'), ability('wis'), 'long'),
  r(cf('Consumptive Power', 'UATheMysticClass', 'Mystic'), fixed(1), 'long'),
  r(cf('Psionic Mastery (1/Day)', 'UATheMysticClass', 'Mystic'), fixed(1), 'long'),
  r(
    sf('Psionic Investigation', 'UATheMysticClass', 'Mystic', 'Awakened'),
    fixed(1),
    'short',
  ),
  r(sf('Spectral Form', 'UATheMysticClass', 'Mystic', 'Awakened'), fixed(1), 'long'),
  r(
    sf('Memory of One Thousand Steps', 'UATheMysticClass', 'Mystic', 'Nomad'),
    fixed(1),
    'short',
  ),
  r(cf('Divine Sense', 'PHB', 'Paladin'), ability('cha', 1, 1, 1), 'long'),
  r(cf('Lay on Hands', 'PHB', 'Paladin'), perLevel(5), 'long', {
    label: 'Lay on Hands hit points',
  }),
  r(
    cf('Channel Divinity: Harness Divine Power', 'TCE', 'Paladin'),
    byLevel([3, 1], [7, 2], [15, 3]),
    'long',
  ),
  r(cf('Cleansing Touch', 'PHB', 'Paladin'), ability('cha'), 'long'),
  r(cf('Lay on Hands', 'XPHB', 'Paladin'), perLevel(5), 'long', {
    label: 'Lay on Hands hit points',
  }),
  r(cf("Paladin's Smite", 'XPHB', 'Paladin'), fixed(1), 'long'),
  r(cf('Channel Divinity', 'XPHB', 'Paladin'), column('Channel Divinity'), 'shortOne'),
  r(cf('Faithful Steed', 'XPHB', 'Paladin'), fixed(1), 'long'),
  r(sf('Undying Sentinel', 'PHB', 'Paladin', 'Ancients'), fixed(1), 'long'),
  r(sf('Elder Champion', 'PHB', 'Paladin', 'Ancients'), fixed(1), 'long'),
  r(sf('Holy Nimbus', 'PHB', 'Paladin', 'Devotion'), fixed(1), 'long'),
  r(sf('Avenging Angel', 'PHB', 'Paladin', 'Vengeance'), fixed(1), 'long'),
  r(sf('Exalted Champion', 'SCAG', 'Paladin', 'Crown'), fixed(1), 'long'),
  r(sf('Glorious Defense', 'TCE', 'Paladin', 'Glory'), ability('cha'), 'long'),
  r(sf('Living Legend', 'TCE', 'Paladin', 'Glory'), fixed(1), 'long'),
  r(sf('Mortal Bulwark', 'TCE', 'Paladin', 'Watchers'), fixed(1), 'long'),
  r(sf('Invincible Conqueror', 'XGE', 'Paladin', 'Conquest'), fixed(1), 'long'),
  r(sf('Elemental Rebuke', 'FRHoF', 'Paladin', 'Noble Genies'), ability('cha'), 'long'),
  r(sf('Noble Scion', 'FRHoF', 'Paladin', 'Noble Genies'), fixed(1), 'long'),
  r(sf('Holy Deliverance', 'WoW', 'Paladin', 'Holy'), fixed(1), 'long'),
  r(sf('Undying Sentinel', 'XPHB', 'Paladin', 'Ancients'), fixed(1), 'long'),
  r(sf('Elder Champion', 'XPHB', 'Paladin', 'Ancients'), fixed(1), 'long'),
  r(sf('Holy Nimbus', 'XPHB', 'Paladin', 'Devotion'), fixed(1), 'long'),
  r(sf('Glorious Defense', 'XPHB', 'Paladin', 'Glory'), ability('cha'), 'long'),
  r(sf('Living Legend', 'XPHB', 'Paladin', 'Glory'), fixed(1), 'long'),
  r(sf('Avenging Angel', 'XPHB', 'Paladin', 'Vengeance'), fixed(1), 'long'),
  r(cf('Favored Foe', 'TCE', 'Ranger'), prof(), 'long'),
  r(cf('Primal Awareness', 'TCE', 'Ranger'), fixed(1), 'long'),
  r(cf('Deft Explorer Improvement', 'TCE', 'Ranger'), prof(), 'long', {
    feature: 'Tireless',
  }),
  r(cf("Nature's Veil", 'TCE', 'Ranger'), prof(), 'long'),
  r(cf('Favored Enemy', 'XPHB', 'Ranger'), column('Favored Enemy'), 'long'),
  r(cf('Pet Specialization', 'WoW', 'Ranger'), fixed(1), 'long', { feature: 'Cunning' }),
  r(cf('Pet Specialization', 'WoW', 'Ranger'), fixed(1), 'long', { feature: 'Ferocity' }),
  r(cf('Pet Specialization', 'WoW', 'Ranger'), fixed(1), 'long', { feature: 'Tenacity' }),
  r(cf('Tireless', 'XPHB', 'Ranger'), ability('wis'), 'long'),
  r(cf("Nature's Veil", 'XPHB', 'Ranger'), ability('wis'), 'long'),
  r(sf('Drake Companion', 'FTD', 'Ranger', 'Drakewarden'), fixed(1), 'long'),
  r(sf("Drake's Breath", 'FTD', 'Ranger', 'Drakewarden'), fixed(1), 'long'),
  r(sf('Perfected Bond', 'FTD', 'Ranger', 'Drakewarden'), prof(), 'long'),
  r(sf('Fey Reinforcements', 'TCE', 'Ranger', 'Fey Wanderer'), fixed(1), 'long'),
  r(sf('Misty Wanderer', 'TCE', 'Ranger', 'Fey Wanderer'), ability('wis'), 'long'),
  r(sf('Writhing Tide', 'TCE', 'Ranger', 'Swarmkeeper'), prof(), 'long'),
  r(sf('Swarming Dispersal', 'TCE', 'Ranger', 'Swarmkeeper'), prof(), 'long'),
  r(sf('Detect Portal', 'XGE', 'Ranger', 'Horizon Walker'), fixed(1), 'short'),
  r(sf('Ethereal Step', 'XGE', 'Ranger', 'Horizon Walker'), fixed(1), 'short'),
  r(sf("Hunter's Sense", 'XGE', 'Ranger', 'Monster Slayer'), ability('wis'), 'long'),
  r(sf("Magic-User's Nemesis", 'XGE', 'Ranger', 'Monster Slayer'), fixed(1), 'short'),
  r(sf('Fortifying Soul', 'FRHoF', 'Ranger', 'Winter Walker'), fixed(1), 'long'),
  r(
    sf('Chilling Retribution', 'FRHoF', 'Ranger', 'Winter Walker'),
    ability('wis'),
    'long',
  ),
  r(sf('Frozen Haunt', 'FRHoF', 'Ranger', 'Winter Walker'), fixed(1), 'long'),
  r(sf('Ancient Might', 'RHW', 'Ranger', 'Hollow Warden'), fixed(1), 'long', {
    feature: 'Persistent Wrath',
  }),
  r(sf('Fey Reinforcements', 'XPHB', 'Ranger', 'Fey Wanderer'), fixed(1), 'long'),
  r(sf('Misty Wanderer', 'XPHB', 'Ranger', 'Fey Wanderer'), ability('wis'), 'long'),
  r(sf('Dread Ambusher', 'XPHB', 'Ranger', 'Gloom Stalker'), ability('wis'), 'long', {
    feature: 'Dreadful Strike',
  }),
  r(cf('Stroke of Luck', 'PHB', 'Rogue'), fixed(1), 'short'),
  r(cf('Stroke of Luck', 'XPHB', 'Rogue'), fixed(1), 'short'),
  r(sf('Spell Thief', 'PHB', 'Rogue', 'Arcane Trickster'), fixed(1), 'long'),
  r(sf('Wails from the Grave', 'TCE', 'Rogue', 'Phantom'), prof(), 'long'),
  r(sf('Psionic Power', 'TCE', 'Rogue', 'Soulknife'), prof(2), 'long', {
    label: 'Psionic Energy Dice',
  }),
  r(sf('Psionic Power', 'TCE', 'Rogue', 'Soulknife'), fixed(1), 'short', {
    label: 'Psionic Power: regain a die',
  }),
  r(sf('Psychic Veil', 'TCE', 'Rogue', 'Soulknife'), fixed(1), 'long'),
  r(sf('Rend Mind', 'TCE', 'Rogue', 'Soulknife'), fixed(1), 'long'),
  r(sf('Unerring Eye', 'XGE', 'Rogue', 'Inquisitive'), ability('wis'), 'long'),
  r(sf('Master Duelist', 'XGE', 'Rogue', 'Swashbuckler'), fixed(1), 'short'),
  r(sf('Bloodthirst', 'FRHoF', 'Rogue', 'Scion of the Three'), ability('int'), 'long'),
  r(sf('Wails from the Grave', 'RHW', 'Rogue', 'Phantom'), ability('dex'), 'long'),
  r(sf('Voice of Death', 'RHW', 'Rogue', 'Phantom'), fixed(1), 'short'),
  r(sf('Ghost Walk', 'RHW', 'Rogue', 'Phantom'), fixed(1), 'long'),
  r(sf('Spell Thief', 'XPHB', 'Rogue', 'Arcane Trickster'), fixed(1), 'long'),
  r(sf('Psionic Power', 'XPHB', 'Rogue', 'Soulknife'), column('Number'), 'shortOne', {
    label: 'Psionic Energy Dice',
  }),
  r(sf('Psychic Veil', 'XPHB', 'Rogue', 'Soulknife'), fixed(1), 'long'),
  r(sf('Rend Mind', 'XPHB', 'Rogue', 'Soulknife'), fixed(1), 'long'),
  r(cf('Totems', 'WoW', 'Shaman'), fixed(1), 'long', {
    feature: 'Primal Knowledge Totem',
  }),
  r(cf('Second Wind', 'TCE', 'Warrior Sidekick'), fixed(1), 'short'),
  r(cf('Sorcery Points', 'PHB', 'Sorcerer'), column('Sorcery Points'), 'long'),
  r(cf('Innate Sorcery', 'XPHB', 'Sorcerer'), fixed(2), 'long'),
  r(cf('Font of Magic', 'XPHB', 'Sorcerer'), column('Sorcery Points'), 'long', {
    label: 'Sorcery Points',
  }),
  r(cf('Sorcerous Restoration', 'XPHB', 'Sorcerer'), fixed(1), 'long'),
  r(sf('Lunar Embodiment', 'DSotDQ', 'Sorcerer', 'Lunar'), fixed(1), 'long'),
  r(sf('Lunar Boons', 'DSotDQ', 'Sorcerer', 'Lunar'), prof(), 'long'),
  r(sf('Waxing and Waning', 'DSotDQ', 'Sorcerer', 'Lunar'), fixed(1), 'long'),
  r(sf('Lunar Phenomenon', 'DSotDQ', 'Sorcerer', 'Lunar'), fixed(1), 'long'),
  r(sf('Tides of Chaos', 'PHB', 'Sorcerer', 'Wild'), fixed(1), 'long'),
  r(sf('Warping Implosion', 'TCE', 'Sorcerer', 'Aberrant Mind'), fixed(1), 'long'),
  r(sf('Restore Balance', 'TCE', 'Sorcerer', 'Clockwork Soul'), prof(), 'long'),
  r(sf('Trance of Order', 'TCE', 'Sorcerer', 'Clockwork Soul'), fixed(1), 'long'),
  r(sf('Clockwork Cavalcade', 'TCE', 'Sorcerer', 'Clockwork Soul'), fixed(1), 'long'),
  r(sf('Favored by the Gods', 'XGE', 'Sorcerer', 'Divine Soul'), fixed(1), 'short'),
  r(sf('Unearthly Recovery', 'XGE', 'Sorcerer', 'Divine Soul'), fixed(1), 'long'),
  r(sf('Strength of the Grave', 'XGE', 'Sorcerer', 'Shadow'), fixed(1), 'long'),
  r(sf('Wind Soul', 'XGE', 'Sorcerer', 'Storm'), fixed(1), 'short'),
  r(sf('Crown of Spellfire', 'FRHoF', 'Sorcerer', 'Spellfire'), fixed(1), 'long'),
  r(sf('Power of Shadow', 'RHW', 'Sorcerer', 'Shadow'), fixed(1), 'long', {
    feature: 'Strength of the Grave',
  }),
  r(sf('Umbral Form', 'RHW', 'Sorcerer', 'Shadow'), fixed(1), 'long'),
  r(sf('Warping Implosion', 'XPHB', 'Sorcerer', 'Aberrant'), fixed(1), 'long'),
  r(sf('Restore Balance', 'XPHB', 'Sorcerer', 'Clockwork'), ability('cha'), 'long'),
  r(sf('Trance of Order', 'XPHB', 'Sorcerer', 'Clockwork'), fixed(1), 'long'),
  r(sf('Clockwork Cavalcade', 'XPHB', 'Sorcerer', 'Clockwork'), fixed(1), 'long'),
  r(sf('Dragon Wings', 'XPHB', 'Sorcerer', 'Draconic'), fixed(1), 'long'),
  r(sf('Dragon Companion', 'XPHB', 'Sorcerer', 'Draconic'), fixed(1), 'long'),
  r(sf('Tides of Chaos', 'XPHB', 'Sorcerer', 'Wild Magic'), fixed(1), 'long'),
  r(sf('Tamed Surge', 'XPHB', 'Sorcerer', 'Wild Magic'), fixed(1), 'long'),
  r(cf('Mystic Arcanum (6th level)', 'PHB', 'Warlock'), fixed(1), 'long'),
  r(cf('Mystic Arcanum (7th level)', 'PHB', 'Warlock'), fixed(1), 'long'),
  r(cf('Mystic Arcanum (8th level)', 'PHB', 'Warlock'), fixed(1), 'long'),
  r(cf('Mystic Arcanum (9th level)', 'PHB', 'Warlock'), fixed(1), 'long'),
  r(cf('Eldritch Master', 'PHB', 'Warlock'), fixed(1), 'long'),
  r(cf('Magical Cunning', 'XPHB', 'Warlock'), fixed(1), 'long'),
  r(cf('Contact Patron', 'XPHB', 'Warlock'), fixed(1), 'long'),
  r(
    cf('Mystic Arcanum', 'XPHB', 'Warlock'),
    byLevel([11, 1], [13, 2], [15, 3], [17, 4]),
    'long',
  ),
  r(sf('Fey Presence', 'PHB', 'Warlock', 'Archfey'), fixed(1), 'short'),
  r(sf('Misty Escape', 'PHB', 'Warlock', 'Archfey'), fixed(1), 'short'),
  r(sf('Dark Delirium', 'PHB', 'Warlock', 'Archfey'), fixed(1), 'short'),
  r(sf("Dark One's Own Luck", 'PHB', 'Warlock', 'Fiend'), fixed(1), 'short'),
  r(sf('Hurl Through Hell', 'PHB', 'Warlock', 'Fiend'), fixed(1), 'long'),
  r(sf('Entropic Ward', 'PHB', 'Warlock', 'Great Old One'), fixed(1), 'short'),
  r(sf('Defy Death', 'SCAG', 'Warlock', 'Undying'), fixed(1), 'long'),
  r(sf('Indestructible Life', 'SCAG', 'Warlock', 'Undying'), fixed(1), 'short'),
  r(sf('Tentacle of the Deeps', 'TCE', 'Warlock', 'Fathomless'), prof(), 'long'),
  r(sf('Grasping Tentacles', 'TCE', 'Warlock', 'Fathomless'), fixed(1), 'long'),
  r(sf('Fathomless Plunge', 'TCE', 'Warlock', 'Fathomless'), fixed(1), 'short'),
  r(sf('Bottled Respite', 'TCE', 'Warlock', 'Genie'), fixed(1), 'long'),
  r(sf('Elemental Gift', 'TCE', 'Warlock', 'Genie'), prof(), 'long'),
  r(sf('Form of Dread', 'VRGR', 'Warlock', 'Undead'), prof(), 'long'),
  r(sf('Spirit Projection', 'VRGR', 'Warlock', 'Undead'), fixed(1), 'long'),
  r(sf('Healing Light', 'XGE', 'Warlock', 'Celestial'), perLevel(1, 1), 'long', {
    label: 'Healing Light dice',
  }),
  r(sf('Searing Vengeance', 'XGE', 'Warlock', 'Celestial'), fixed(1), 'long'),
  r(sf("Hexblade's Curse", 'XGE', 'Warlock', 'Hexblade'), fixed(1), 'short'),
  r(sf('Accursed Specter', 'XGE', 'Warlock', 'Hexblade'), fixed(1), 'long'),
  r(sf('Vestige Recovery', 'AU', 'Warlock', 'Vestige'), fixed(1), 'long'),
  r(sf('Semblance of Life', 'AU', 'Warlock', 'Vestige'), fixed(1), 'long'),
  r(sf('Form of Dread', 'RHW', 'Warlock', 'Undead'), ability('cha'), 'long'),
  r(sf('Necrotic Husk', 'RHW', 'Warlock', 'Undead'), fixed(1), 'short', {
    feature: 'Unholy Resuscitation',
  }),
  r(sf('Steps of the Fey', 'XPHB', 'Warlock', 'Archfey'), ability('cha'), 'long'),
  r(sf('Beguiling Defenses', 'XPHB', 'Warlock', 'Archfey'), fixed(1), 'long'),
  r(sf('Healing Light', 'XPHB', 'Warlock', 'Celestial'), perLevel(1, 1), 'long', {
    label: 'Healing Light dice',
  }),
  r(sf('Searing Vengeance', 'XPHB', 'Warlock', 'Celestial'), fixed(1), 'long'),
  r(sf("Dark One's Own Luck", 'XPHB', 'Warlock', 'Fiend'), ability('cha'), 'long'),
  r(sf('Hurl Through Hell', 'XPHB', 'Warlock', 'Fiend'), fixed(1), 'long'),
  r(sf('Clairvoyant Combatant', 'XPHB', 'Warlock', 'Great Old One'), fixed(1), 'short'),
  r(cf('Arcane Recovery', 'PHB', 'Wizard'), fixed(1), 'long'),
  r(cf('Signature Spells', 'PHB', 'Wizard'), fixed(2), 'short', {
    label: 'Signature Spells: one cast of each spell',
  }),
  r(cf('Arcane Recovery', 'XPHB', 'Wizard'), fixed(1), 'long'),
  r(cf('Signature Spells', 'XPHB', 'Wizard'), fixed(2), 'short', {
    label: 'Signature Spells: one cast of each spell',
  }),
  r(sf('Chronal Shift', 'EGW', 'Wizard', 'Chronurgy'), fixed(2), 'long'),
  r(sf('Momentary Stasis', 'EGW', 'Wizard', 'Chronurgy'), ability('int'), 'long'),
  r(sf('Arcane Abeyance', 'EGW', 'Wizard', 'Chronurgy'), fixed(1), 'short'),
  r(sf('Violent Attraction', 'EGW', 'Wizard', 'Graviturgy'), ability('int'), 'long'),
  r(sf('Event Horizon', 'EGW', 'Wizard', 'Graviturgy'), fixed(1), 'long'),
  r(sf('Arcane Ward', 'PHB', 'Wizard', 'Abjuration'), fixed(1), 'long'),
  r(sf('Benign Transposition', 'PHB', 'Wizard', 'Conjuration'), fixed(1), 'long'),
  r(sf('Instinctive Charm', 'PHB', 'Wizard', 'Enchantment'), fixed(1), 'long'),
  r(sf('Illusory Self', 'PHB', 'Wizard', 'Illusion'), fixed(1), 'short'),
  r(sf('Shapechanger', 'PHB', 'Wizard', 'Transmutation'), fixed(1), 'short'),
  r(sf('Master Transmuter', 'PHB', 'Wizard', 'Transmutation'), fixed(1), 'long'),
  r(sf('Bladesong', 'TCE', 'Wizard', 'Bladesinging'), prof(), 'long'),
  r(sf('Awakened Spellbook', 'TCE', 'Wizard', 'Scribes'), fixed(1), 'long'),
  r(sf('Manifest Mind', 'TCE', 'Wizard', 'Scribes'), prof(), 'long'),
  r(sf('One with the Word', 'TCE', 'Wizard', 'Scribes'), fixed(1), 'long'),
  r(sf('Benign Transposition', 'AU', 'Wizard', 'Conjurer'), ability('int'), 'long'),
  r(sf('Splintered Summons', 'AU', 'Wizard', 'Conjurer'), fixed(1), 'long'),
  r(sf('Hypnotic Presence', 'AU', 'Wizard', 'Enchanter'), ability('int'), 'long'),
  r(sf('Split Enchantment', 'AU', 'Wizard', 'Enchanter'), ability('int', 0), 'long'),
  r(sf('Instinctive Charm', 'AU', 'Wizard', 'Enchanter'), fixed(1), 'long'),
  r(sf('Undead Thralls', 'AU', 'Wizard', 'Necromancer'), fixed(1), 'long'),
  r(sf("Death's Master", 'AU', 'Wizard', 'Necromancer'), fixed(1), 'long', {
    feature: 'Bolster Undead',
  }),
  r(sf('Wondrous Alteration', 'AU', 'Wizard', 'Transmuter'), fixed(1), 'long'),
  r(sf('Empowered Transmutation', 'AU', 'Wizard', 'Transmuter'), ability('int'), 'long'),
  r(sf('Shape-Shifter', 'AU', 'Wizard', 'Transmuter'), fixed(1), 'long'),
  r(sf('Bladesong', 'FRHoF', 'Wizard', 'Bladesinger'), ability('int'), 'long'),
  r(sf('Arcane Ward', 'XPHB', 'Wizard', 'Abjurer'), fixed(1), 'long'),
  r(sf('The Third Eye', 'XPHB', 'Wizard', 'Diviner'), fixed(1), 'short'),
  r(sf('Phantasmal Creatures', 'XPHB', 'Wizard', 'Illusionist'), fixed(1), 'long'),
  r(sf('Illusory Self', 'XPHB', 'Wizard', 'Illusionist'), fixed(1), 'short'),
  r(feat('Aberrant Dragonmark|EFA'), fixed(1), 'long', { feature: 'Aberrant Fortitude' }),
  r(feat('Agent of Order|SatO'), prof(), 'long'),
  r(feat('Arcane Artist|AU'), fixed(1), 'long', { feature: 'Inspiring Magic' }),
  r(feat('Arcane Infiltrator|AU'), prof(), 'long', { feature: 'Cunning Diversion' }),
  r(feat('Arcane Omens|AU'), prof(), 'long', { feature: 'Helpful Premonition' }),
  r(feat('Arcane Overload|AU'), fixed(1), 'long', { feature: 'Power Surge' }),
  r(feat('Arcane Safeguard|AU'), prof(), 'long', { feature: 'Cantrip' }),
  r(feat('Arcane Undertaker|AU'), fixed(1), 'long', {
    feature: 'Understanding of Death',
  }),
  r(feat('Baleful Scion|SatO'), prof(), 'long'),
  r(feat('Bloodlust|ABH'), prof(), 'long', { feature: 'Sanguine Feast' }),
  r(feat('Boon of Exquisite Radiance|FRHoF'), fixed(1), 'long', {
    feature: 'Powerful Radiance',
  }),
  r(feat('Boon of Fluid Forms|FRHoF'), fixed(1), 'long', { feature: 'Shapechanger' }),
  r(feat('Boon of Misty Escape|ABH'), fixed(1), 'long', { feature: 'Gaseous Form' }),
  r(feat('Boon of Recovery|XPHB'), fixed(1), 'long', { feature: 'Last Stand' }),
  r(feat('Boon of Recovery|XPHB'), fixed(10), 'long', {
    feature: 'Recover Vitality',
    label: 'Recover Vitality dice',
  }),
  r(feat('Boon of Revelry|FRHoF'), fixed(1), 'long', { feature: 'Inspire Dance' }),
  r(feat('Boon of Terror|FRHoF'), fixed(1), 'short', { feature: 'Flee, Fools!' }),
  r(feat('Boon of the Soul Drinker|FRHoF'), fixed(1), 'short', {
    feature: 'Siphon Life',
  }),
  r(feat('Cult of the Dragon Initiate|FRHoF'), fixed(1), 'short', {
    feature: 'Inspired by Fear',
  }),
  r(feat('Delicious Pain|ABH'), fixed(1), 'short', { feature: 'Toughened Flesh' }),
  r(feat('Divination Adept|AU'), fixed(1), 'long', { feature: 'Prescient Intervention' }),
  r(feat('Ember of the Fire Giant|BGG'), prof(), 'long'),
  r(feat('Fade Away|XGE'), fixed(1), 'short'),
  r(feat('Fairy Trickster|FRHoF'), prof(), 'long', { feature: 'Flustering Strike' }),
  r(feat('Familiar Friend|AU'), prof(), 'long', { feature: 'Helpful Friend' }),
  r(feat('Fury of the Frost Giant|BGG'), prof(), 'long'),
  r(feat('Gathered Whispers|RHW'), prof(), 'long', { feature: 'Unearthly Scream' }),
  r(feat('Genie Magic|FRHoF'), fixed(1), 'long', { feature: 'Wish Magic' }),
  r(feat('Gift of the Chromatic Dragon|FTD'), prof(), 'long'),
  r(feat('Gift of the Gem Dragon|FTD'), prof(), 'long'),
  r(feat('Greater Mark of Handling|EFA'), prof(), 'long', { feature: 'Subdue Animal' }),
  r(feat('Greater Mark of Healing|EFA'), prof(), 'long', { feature: 'Improved Healing' }),
  r(feat('Greater Mark of Hospitality|EFA'), fixed(1), 'long', {
    feature: 'Improved Hospitality',
  }),
  r(feat('Greater Mark of Scribing|EFA'), fixed(1), 'long', {
    feature: 'Inspired Scribing',
  }),
  r(feat('Greater Mark of Warding|EFA'), prof(), 'long', { feature: 'Improved Warding' }),
  r(feat('Guile of the Cloud Giant|BGG'), prof(), 'long'),
  r(feat('Keenness of the Stone Giant|BGG'), prof(), 'long'),
  r(feat('Knight of the Crown|DSotDQ'), prof(), 'long'),
  r(feat('Knight of the Rose|DSotDQ'), prof(), 'long'),
  r(feat('Knight of the Sword|DSotDQ'), prof(), 'long'),
  r(feat('Light Bringer|ABH'), fixed(1), 'long', { feature: 'Solar Luminance' }),
  r(feat('Light Bringer|ABH'), fixed(1), 'short', { feature: "Sun's Healing" }),
  r(feat('Living Shadow|RHW'), prof(), 'long', { feature: 'Lengthened Strike' }),
  r(feat('Lordly Resolve|FRHoF'), fixed(1), 'long', { feature: 'Standard Bearer' }),
  r(feat('Love Bites|ABH'), fixed(1), 'short', { feature: 'Endearing Pain' }),
  r(feat('Lucky|PHB'), fixed(3), 'long', { label: 'Luck Points' }),
  r(feat('Lucky|XPHB'), prof(), 'long', { label: 'Luck Points' }),
  r(feat('Mage Slayer|XPHB'), fixed(1), 'short', { feature: 'Guarded Mind' }),
  r(feat('Mark of Sentinel|EFA'), prof(), 'long', { feature: 'Vigilant Guardian' }),
  r(feat('Martial Adept|PHB'), fixed(1), 'short', {
    label: 'Superiority Dice',
    adds: true,
  }),
  r(feat('Metamagic Adept|TCE'), fixed(2), 'long', {
    label: 'Sorcery Points',
    adds: true,
  }),
  r(feat('Mist Walker|RHW'), prof(), 'long', { feature: 'Mist Walk' }),
  r(feat('Mythal Touched|FRHoF'), prof(), 'long', { feature: 'Mythal Ward' }),
  r(feat('Orcish Fury|XGE'), fixed(1), 'short'),
  r(feat('Portal Jumper|AU'), prof(), 'long', { feature: 'Portal Step' }),
  r(feat('Potent Dragonmark|EFA'), fixed(1), 'short', {
    feature: 'Dragonmark Spellcasting',
    label: 'Dragonmark spell slot',
  }),
  r(feat('Purple Dragon Commandant|FRHoF'), prof(), 'long', {
    feature: 'Encourage Ally',
  }),
  r(feat('Purple Dragon Rook|FRHoF'), fixed(1), 'long', { feature: 'Rallying Cry' }),
  r(feat('Putrefy|ABH'), fixed(1), 'short', { feature: 'Necrosis' }),
  r(feat('Rebuke|ABH'), fixed(1), 'short', { feature: 'Radiant Strike' }),
  r(feat('Righteous Heritor|SatO'), prof(), 'long'),
  r(feat('Ritual Caster|XPHB'), fixed(1), 'long', { feature: 'Quick Ritual' }),
  r(feat('Second Chance|XGE'), fixed(1), 'short'),
  r(feat('Sharp Eye|RHW'), prof(), 'long'),
  r(feat('Soul of the Storm Giant|BGG'), prof(), 'long'),
  r(feat('Spell Resistant|AU'), prof(), 'long', { feature: 'Magic Resistant' }),
  r(feat('Spellfire Spark|FRHoF'), prof(), 'long', { feature: 'Spellfire Flame' }),
  r(feat('Squire of Solamnia|DSotDQ'), prof(), 'long'),
  r(feat('Strike of the Giants|BGG'), prof(), 'long', { feature: 'Storm Strike' }),
  r(feat('Strixhaven Mascot|SCC'), fixed(1), 'long'),
  r(feat('Survivor|RHW'), fixed(1), 'long', { feature: 'Steel Yourself' }),
  r(feat('Symbiotic Being|RHW'), prof(), 'long', { feature: 'Sustained Symbiosis' }),
  r(feat('Tireless Reveler|ABH'), prof(), 'short'),
  r(feat('Transmuted Anatomy|AU'), prof(), 'long', { feature: 'Resilient Anatomy' }),
  r(feat('Treacherous Allure|ABH'), fixed(1), 'long', { feature: 'Enchanting Presence' }),
  r(feat('Vampire Hunter|ABH'), fixed(1), 'short', { feature: 'Vitality Ward' }),
  r(feat('Vampire Touched|ABH'), fixed(1), 'long', { feature: 'Vampire Magic' }),
  r(feat("Vampire's Plaything|ABH"), prof(), 'long', { feature: 'Timely Retreat' }),
  r(feat('Vampiric Exultation|PSX'), fixed(1), 'short'),
  r(option('Bewitching Whispers|PHB'), fixed(1), 'long'),
  r(option('Bond of the Talisman|TCE'), prof(), 'long'),
  r(option('Cloak of Flies|XGE'), fixed(1), 'short'),
  r(option('Cloud Rune|TCE'), fixed(1), 'short'),
  r(option('Dreadful Word|PHB'), fixed(1), 'long'),
  r(option('Fire Rune|TCE'), fixed(1), 'short'),
  r(option('Frost Rune|TCE'), fixed(1), 'short'),
  r(option('Ghostly Gaze|XGE'), fixed(1), 'short'),
  r(option('Gift of the Depths|XGE'), fixed(1), 'long'),
  r(option('Gift of the Protectors|TCE'), fixed(1), 'long'),
  r(option('Gift of the Protectors|XPHB'), fixed(1), 'long'),
  r(option('Hill Rune|TCE'), fixed(1), 'short'),
  r(option('Minions of Chaos|PHB'), fixed(1), 'long'),
  r(option('Mire the Mind|PHB'), fixed(1), 'long'),
  r(option('Pact of the Talisman|TCE'), prof(), 'long'),
  r(option('Protection of the Talisman|TCE'), prof(), 'long'),
  r(option('Sculptor of Flesh|PHB'), fixed(1), 'long'),
  r(option('Sign of Ill Omen|PHB'), fixed(1), 'long'),
  r(option('Stone Rune|TCE'), fixed(1), 'short'),
  r(option('Storm Rune|TCE'), fixed(1), 'short'),
  r(option('Superior Technique|TCE'), fixed(1), 'short', {
    label: 'Superiority Dice',
    adds: true,
  }),
  r(option('Thief of Five Fates|PHB'), fixed(1), 'long'),
  r(option('Tomb of Levistus|XGE'), fixed(1), 'short'),
  r(option("Trickster's Escape|XGE"), fixed(1), 'long'),
  r(race('Aarakocra', 'MPMM'), fixed(1), 'long', { feature: 'Wind Caller' }),
  r(race('Aasimar', 'MPMM'), fixed(1), 'long', { feature: 'Healing Hands' }),
  r(race('Aasimar', 'MPMM'), fixed(1), 'long', { feature: 'Celestial Revelation' }),
  r(race('Aasimar', 'VGM'), fixed(1), 'long', { feature: 'Healing Hands' }),
  r(race('Aasimar', 'XPHB'), fixed(1), 'long', { feature: 'Healing Hands' }),
  r(race('Aasimar', 'XPHB'), fixed(1), 'long', { feature: 'Celestial Revelation' }),
  r(race('Astral Elf', 'AAG'), prof(), 'long', { feature: 'Starlight Step' }),
  r(race('Autognome', 'AAG'), prof(), 'long', { feature: 'Built for Success' }),
  r(race('Deep Gnome', 'MPMM'), prof(), 'long', { feature: 'Svirfneblin Camouflage' }),
  r(race('Dhampir', 'RHW'), prof(), 'long', { feature: 'Vampiric Bite' }),
  r(race('Dhampir', 'VRGR'), prof(), 'long', { feature: 'Vampiric Bite' }),
  r(race('Dracthyr', 'WoW'), fixed(1), 'long', { feature: 'Draconic Flight' }),
  r(race('Draenei', 'WoW'), fixed(1), 'short', { feature: 'Heroic Presence' }),
  r(race('Dragonborn', 'PHB'), fixed(1), 'short', { feature: 'Breath Weapon' }),
  r(race('Dragonborn', 'XPHB'), prof(), 'long', { feature: 'Breath Weapon' }),
  r(race('Dragonborn', 'XPHB'), fixed(1), 'long', { feature: 'Draconic Flight' }),
  r(race('Dragonborn (Chromatic)', 'FTD'), prof(), 'long', { feature: 'Breath Weapon' }),
  r(race('Dragonborn (Chromatic)', 'FTD'), fixed(1), 'long', {
    feature: 'Chromatic Warding',
  }),
  r(race('Dragonborn (Gem)', 'FTD'), prof(), 'long', { feature: 'Breath Weapon' }),
  r(race('Dragonborn (Gem)', 'FTD'), fixed(1), 'long', { feature: 'Gem Flight' }),
  r(race('Dragonborn (Metallic)', 'FTD'), prof(), 'long', { feature: 'Breath Weapon' }),
  r(race('Dragonborn (Metallic)', 'FTD'), fixed(1), 'long', {
    feature: 'Metallic Breath Weapon',
  }),
  r(race('Dwarf', 'XPHB'), prof(), 'long', { feature: 'Stonecunning' }),
  r(race('Earthen', 'WoW'), prof(), 'long', { feature: 'Azerite Surge' }),
  r(race('Eladrin', 'MPMM'), prof(), 'long', { feature: 'Fey Step' }),
  r(race('Firbolg', 'MPMM'), fixed(1), 'long', { feature: 'Firbolg Magic' }),
  r(race('Firbolg', 'MPMM'), prof(), 'long', { feature: 'Hidden Step' }),
  r(race('Firbolg', 'VGM'), fixed(1), 'short', { feature: 'Hidden Step' }),
  r(race('Forsaken', 'WoW'), fixed(1), 'long', { feature: 'Touch of the Grave' }),
  r(race('Giff', 'AAG'), prof(), 'long', { feature: 'Astral Spark' }),
  r(race('Goblin', 'MPMM'), prof(), 'long', { feature: 'Fury of the Small' }),
  r(race('Goblin', 'VGM'), fixed(1), 'short', { feature: 'Fury of the Small' }),
  r(race('Goblin', 'WoW'), prof(), 'long', { feature: 'Fury of the Small' }),
  r(race('Goliath', 'MPMM'), prof(), 'long', { feature: "Stone's Endurance" }),
  r(race('Goliath', 'VGM'), fixed(1), 'short', { feature: "Stone's Endurance" }),
  r(race('Goliath', 'XPHB'), prof(), 'long', { feature: 'Giant Ancestry' }),
  r(race('Goliath', 'XPHB'), fixed(1), 'long', { feature: 'Large Form' }),
  r(race('Hadozee', 'AAG'), prof(), 'long', { feature: 'Hadozee Dodge' }),
  r(race('Half-Orc', 'PHB'), fixed(1), 'long', { feature: 'Relentless Endurance' }),
  r(race('Harengon', 'MPMM'), prof(), 'long', { feature: 'Rabbit Hop' }),
  r(race('Harengon', 'WBtW'), prof(), 'long', { feature: 'Rabbit Hop' }),
  r(race('Hexblood', 'VRGR'), fixed(1), 'long', { feature: 'Eerie Token' }),
  r(race('Hexblood', 'VRGR'), fixed(1), 'long', { feature: 'Hex Magic' }),
  r(race('Hobgoblin', 'MPMM'), prof(), 'long', { feature: 'Fey Gift' }),
  r(race('Hobgoblin', 'MPMM'), prof(), 'long', { feature: 'Fortune from the Many' }),
  r(race('Hobgoblin', 'VGM'), fixed(1), 'short', { feature: 'Saving Face' }),
  r(race('Kender', 'DSotDQ'), fixed(1), 'long', { feature: 'Fearless' }),
  r(race('Kender', 'DSotDQ'), prof(), 'long', { feature: 'Taunt' }),
  r(race('Kenku', 'MPMM'), prof(), 'long', { feature: 'Kenku Recall' }),
  r(race('Kobold', 'MPMM'), prof(), 'long', { feature: 'Draconic Cry' }),
  r(race('Kobold', 'VGM'), fixed(1), 'short', { feature: 'Grovel, Cower, and Beg' }),
  r(race('Leonin', 'MOT'), fixed(1), 'short', { feature: 'Daunting Roar' }),
  r(race('Lizardfolk', 'MPMM'), prof(), 'long', { feature: 'Hungry Jaws' }),
  r(race('Lizardfolk', 'VGM'), fixed(1), 'short', { feature: 'Hungry Jaws' }),
  r(race('Lupin', 'RHW'), prof(), 'long', { feature: 'Howl' }),
  r(race('Mechagnome', 'WoW'), prof(), 'long', { feature: 'Built for Success' }),
  r(race('Mechagnome', 'WoW'), fixed(1), 'short', { feature: 'Emergency Fail-Safe' }),
  r(race('Minotaur (Amonkhet)', 'PSA'), fixed(1), 'long', {
    feature: 'Relentless Endurance',
  }),
  r(race('Orc', 'MPMM'), prof(), 'long', { feature: 'Adrenaline Rush' }),
  r(race('Orc', 'MPMM'), fixed(1), 'long', { feature: 'Relentless Endurance' }),
  r(race('Orc', 'XPHB'), prof(), 'short', { feature: 'Adrenaline Rush' }),
  r(race('Orc', 'XPHB'), fixed(1), 'long', { feature: 'Relentless Endurance' }),
  r(race('Orc (Ixalan)', 'PSX'), fixed(1), 'long', { feature: 'Relentless Endurance' }),
  r(race('Reborn', 'RHW'), prof(), 'long', { feature: 'Knowledge from a Past Life' }),
  r(race('Reborn', 'VRGR'), prof(), 'long', { feature: 'Knowledge from a Past Life' }),
  r(race('Shadar-Kai', 'MPMM'), prof(), 'long', {
    feature: 'Blessing of the Raven Queen',
  }),
  r(race('Shifter', 'EFA'), prof(), 'long', { feature: 'Shifting' }),
  r(race('Shifter', 'ERLW'), fixed(1), 'short', { feature: 'Shifting' }),
  r(race('Shifter', 'MPMM'), prof(), 'long', { feature: 'Shifting' }),
  r(race('Simic Hybrid', 'GGR'), ability('con'), 'long', {
    feature: 'Animal Enhancement',
  }),
  r(race('Vedalken', 'GGR'), fixed(1), 'long', { feature: 'Partially Amphibious' }),
  r(race('Worgen', 'WoW'), prof(), 'long', { feature: 'Darkflight' }),
  r(race('Aasimar', 'VGM', 'Fallen'), fixed(1), 'long', { feature: 'Necrotic Shroud' }),
  r(race('Aasimar', 'VGM', 'Protector'), fixed(1), 'long', { feature: 'Radiant Soul' }),
  r(race('Aasimar', 'VGM', 'Scourge'), fixed(1), 'long', {
    feature: 'Radiant Consumption',
  }),
  r(race('Dragonborn', 'EGW', 'Draconblood'), fixed(1), 'short', {
    feature: 'Forceful Presence',
  }),
  r(race('Dragonborn', 'EGW', 'Ravenite'), fixed(1), 'short', {
    feature: 'Vengeful Assault',
  }),
  r(race('Dwarf', 'ERLW', 'Mark of Warding'), fixed(1), 'long', {
    feature: 'Wards and Seals',
  }),
  r(race('Elf', 'DMG', 'Eladrin'), fixed(1), 'short', { feature: 'Fey Step' }),
  r(race('Elf', 'MTF', 'Eladrin'), fixed(1), 'short', { feature: 'Fey Step' }),
  r(race('Elf', 'MTF', 'Shadar-kai'), fixed(1), 'long', {
    feature: 'Blessing of the Raven Queen',
  }),
  r(race('Genasi', 'EEPC', 'Air'), fixed(1), 'long', { feature: 'Mingle with the Wind' }),
  r(race('Genasi', 'EEPC', 'Earth'), fixed(1), 'long', { feature: 'Merge with Stone' }),
  r(race('Genasi', 'MPMM', 'Earth'), prof(), 'long', { feature: 'Merge with Stone' }),
  r(race('Half-Elf', 'ERLW', 'Variant; Mark of Storm'), fixed(1), 'long', {
    feature: 'Headwinds',
  }),
  r(race('Human', 'ERLW', 'Mark of Making'), fixed(1), 'long', { feature: 'Spellsmith' }),
  r(race('Human', 'ERLW', 'Mark of Passage'), fixed(1), 'long', {
    feature: 'Magical Passage',
  }),
  r(race('Human', 'ERLW', 'Mark of Sentinel'), fixed(1), 'long', {
    feature: "Guardian's Shield",
  }),
  r(race('Human', 'ERLW', 'Mark of Sentinel'), fixed(1), 'long', {
    feature: 'Vigilant Guardian',
  }),
]
