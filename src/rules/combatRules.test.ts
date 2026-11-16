import { describe, expect, it } from 'vitest'
import { dataDir, findIds, records, recordId } from '../test/dataAudit'
import { INITIATIVE_RULES, PASSIVE_EDGE_RULES, PASSIVE_RULES } from './combatRules'
import { holderId } from './holder'

/** What changes initiative or a passive score in text. */
const CHANGES_COMBAT_ROLL =
  /bonus to (your )?initiative|to your initiative|initiative rolls?|your passive (Wisdom|Intelligence)|bonus to your passive/i

/**
 * What the books say about initiative or passive scores that the sheet does not count as
 * a number, with the reason. A new book's feature fails the audit until it is in a table
 * or here.
 */
export const COMBAT_NOT_APPLIED: Record<string, string> = {
  "subclassFeature|Adventurer's Atlas|EFA|Artificer|Cartographer":
    'a die the artificer gives a creature it targets, not a bonus of its own',
  'subclassFeature|Tandem Footwork|XPHB|Bard|Dance':
    'a bonus the bard gives allies by a roll of a die in play',
  'classFeature|Battle Readiness|TCE|Warrior Sidekick':
    'a sidekick, not a character of its own',
  'feat|Zhentarim Ruffian|FRHoF': 'gives advantage by spending a use in play',
  'feat|Dungeon Delver|PHB':
    'removes a penalty to a passive score while traveling fast, not a bonus',
  'subclassFeature|Avatar of Battle|UATheMysticClass|Mystic|Avatar':
    'a bonus the mystic gives allies, in a class of an Unearthed Arcana',
  'subclassFeature|Aura of the Sentinel|TCE|Paladin|Watchers':
    'a bonus the paladin gives creatures near them when initiative is rolled',
  'optionalfeature|Ambush|TCE': 'spends a superiority die on the roll in play',
  'optionalfeature|Ambush|XPHB': 'spends a superiority die on the roll in play',
  'optionalfeature|Helm of Awareness|TCE': 'an option of a creature that wears a helm',
  'item|Deck of Wonder|BMT': 'a result of drawing a card, for 8 hours',
  'item|Sword of Kas|DMG': 'adds a die rolled at the start of combat, not a fixed number',
  'item|Sword of Kas|XDMG':
    'adds a die rolled at the start of combat, not a fixed number',
  'item|The Infernal Machine of Lum the Mad|IMR':
    'one result of a random table of the device, not a feature the character holds',
  'itemGroup|Eye and Hand of Vecna|XDMG':
    'holds only with both the Eye and the Hand attuned: a pair, not one item the sheet holds',
  'race|Lorwyn Changeling|LFL': 'a move after the roll, not a bonus to it',
}

describe.skipIf(!dataDir)('combat rules against the data', () => {
  const dir = dataDir ?? ''
  const rowIds = new Set(
    [...INITIATIVE_RULES, ...PASSIVE_RULES].map((r) => holderId(r.holder)),
  )

  it('applies or explains every feature that changes initiative or a passive score', () => {
    const found = findIds(
      dir,
      [
        'classFeature',
        'subclassFeature',
        'optionalfeature',
        'race',
        'subrace',
        'feat',
        'background',
        'action',
        'magicvariant',
        'item',
        'itemGroup',
      ],
      (text) => CHANGES_COMBAT_ROLL.test(text),
    )
    const unknown = [...found].filter(
      (id) => !rowIds.has(id) && !(id in COMBAT_NOT_APPLIED),
    )
    expect(unknown).toEqual([])
  })

  it('has every row of the tables present in the data', () => {
    const all = new Set(
      records(dir).map(({ collection, record }) => recordId(collection, record)),
    )
    const missing = [...INITIATIVE_RULES, ...PASSIVE_RULES].filter(
      (r) => !all.has(holderId(r.holder)),
    )
    expect(missing.map((r) => holderId(r.holder))).toEqual([])
  })
})

/** What the books say about advantage or disadvantage on the checks of a passive score. */
const EDGE_ON_PASSIVE =
  /(advantage|disadvantage) on [^.]{0,80}?\((perception|investigation|insight)\)|\((perception|investigation|insight)\)[^.]{0,40} checks? (are|is) made with (advantage|disadvantage)/i

const DIM_LIGHT = 'Removes the disadvantage of dim light; it gives no advantage.'

/** Advantage or disadvantage the passive scores do not take, with the reason. */
const EDGES_NOT_APPLIED: Readonly<Record<string, string>> = {
  'charoption|Watchers|VRGR': 'Holds only for the duration of a power used in play.',
  'subclassFeature|Eagle|PHB|Barbarian|Totem Warrior': DIM_LIGHT,
  'feat|Skulker|PHB': DIM_LIGHT,
  'subclassFeature|Spirit Totem|XGE|Druid|Shepherd':
    'Holds only in the aura of a spirit summoned with a bonus action.',
  'subclassFeature|Visage of the Astral Self|TCE|Monk|Astral Self':
    'Holds only while the astral visage is summoned.',
  'subclassFeature|Lunar Empowerment|DSotDQ|Sorcerer|Lunar':
    'Holds only in the Full Moon phase, within light shed with a bonus action.',
  'subclassFeature|Wild Magic Surge|PHB|Sorcerer|Wild': 'One result of a random roll.',
  'subclassFeature|Wild Magic Surge|XPHB|Sorcerer|Wild Magic':
    'One result of a random roll.',
  'feat|Illusion Adept|AU': "Disadvantage on other creatures' checks.",
  'item|Devil Mask|FRHoF': "Disadvantage on other creatures' checks.",
  'item|Teeth of Dahlver-Nar|TCE':
    'Comes with one of the eight teeth, which the sheet does not track.',
  'reward|Draconic Senses|FTD':
    'A reward (a blessing or charm), which the sheet does not hold.',
  'reward|Sight of the Earth-Warder|WoW':
    'A reward (a blessing or charm), which the sheet does not hold.',
}

describe.skipIf(!dataDir)('passive advantage and disadvantage against the data', () => {
  const collections = [
    'classFeature',
    'subclassFeature',
    'optionalfeature',
    'feat',
    'race',
    'subrace',
    'item',
    'charoption',
    'reward',
  ]
  const found = findIds(dataDir ?? '', collections, (text) => EDGE_ON_PASSIVE.test(text))
  const rows = new Set(PASSIVE_EDGE_RULES.map((r) => holderId(r.holder)))

  it('applies or explains every record that gives such advantage or disadvantage', () => {
    const unknown = [...found].filter((id) => !rows.has(id) && !(id in EDGES_NOT_APPLIED))
    expect(unknown).toEqual([])
  })

  it('names only records that say so, each once', () => {
    const named = [...rows, ...Object.keys(EDGES_NOT_APPLIED)]
    expect(named.filter((id) => !found.has(id))).toEqual([])
    const keys = PASSIVE_EDGE_RULES.map((r) => holderId(r.holder))
    expect(new Set(keys).size).toBe(keys.length)
    for (const rule of PASSIVE_EDGE_RULES)
      expect(rule.text.startsWith(rule.label)).toBe(true)
  })
})
