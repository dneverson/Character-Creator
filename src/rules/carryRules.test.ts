import { describe, expect, it } from 'vitest'
import { kindOf } from '../data/itemText'
import { dataDir, records, recordId } from '../test/dataAudit'
import { worksWhileCarried } from './carryRules'

describe('the carry rule', () => {
  it('lets an item work while carried when its text says so', () => {
    const stone = [
      'While this polished agate is on your person, you gain a +1 bonus to ability checks and saving throws.',
    ]
    expect(worksWhileCarried('wondrous', stone)).toBe(true)
    expect(
      worksWhileCarried('wondrous', ['While you carry it, you can cast light.']),
    ).toBe(true)
  })

  it('keeps an item that is worn, and every weapon, armor and shield, to equipping', () => {
    const cloak = [
      'You gain a +1 bonus to AC and saving throws while you wear this cloak.',
    ]
    expect(worksWhileCarried('wondrous', cloak)).toBe(false)
    const sword = ['While the sword is on your person, you add a d10 to your initiative.']
    expect(worksWhileCarried('weapon', sword)).toBe(false)
    expect(worksWhileCarried('shield', sword)).toBe(false)
    expect(worksWhileCarried('armor', sword)).toBe(false)
  })
})

/** Any words of an item about being on the person or carried. */
const SPEAKS_OF_CARRYING =
  /on your person|while (?:you are )?carry|while you carry|in your possession/i

const WIELDED =
  'Wielded to work, as every weapon and shield is; what its text gives while only carried is not counted then.'
const ABOUT_OTHERS = 'The words are about other things carried, not about this item.'

/** Items whose text speaks of carrying yet that do not work while only carried, with why. */
const NOT_CARRIED: Readonly<Record<string, string>> = {
  'item|Ruidium Shield|CRCotN': WIELDED,
  'item|Akmon, Hammer of Purphoros|MOT': WIELDED,
  'item|Draconic Longsword|ToA': WIELDED,
  'item|Mastix, Whip of Erebos|MOT': WIELDED,
  'item|Silken Spite (Dormant)|EGW': WIELDED,
  'item|Staff of Adornment|XDMG': WIELDED,
  'item|Staff of Adornment|XGE': 'Works while held, as its text says.',
  'item|Staff of the Lost|AU': WIELDED,
  'item|Sword of Kas|DMG': WIELDED,
  'item|Sword of Kas|XDMG': WIELDED,
  "item|Tloques' Berserker Battleaxe|TftYP": WIELDED,
  'item|Topaz Annihilator|FTD': WIELDED,
  'item|Trident of Fish Command|DMG': WIELDED,
  'item|Trident of Fish Command|XDMG': WIELDED,
  'item|Wave|XDMG': WIELDED,
  'item|Broom of Flying|DMG': 'The words are about the load the broom carries.',
  'item|Broom of Flying|XDMG': 'The words are about the load the broom carries.',
  'item|Claw of the Wyrm Rune|SKT':
    'Works while displayed on your person, that is, worn in view: equipped.',
  'item|Deck of Dimensions|BMT': ABOUT_OTHERS,
  'item|Deck of Many Things|DMG': ABOUT_OTHERS,
  'item|Deck of Many Things|XDMG': ABOUT_OTHERS,
  'item|Deck of Wonder|BMT': ABOUT_OTHERS,
  'item|Helm of Disjunction|HAT-LMI': ABOUT_OTHERS,
  "item|Masquerader's Brooch|AUD": 'Works while worn or held, as its text says.',
  'item|Orzhov Keyrune|GGR': 'The words are about the keyrune carrying out orders.',
  'item|Stone of Golorr|WDH': 'The words are about forgetting the stone was carried.',
  'item|The Infernal Machine of Lum the Mad|IMR': ABOUT_OTHERS,
}

describe.skipIf(!dataDir)('the carry rule against the data', () => {
  const speaking = records(dataDir ?? '').filter(
    ({ collection, record }) =>
      collection === 'item' &&
      SPEAKS_OF_CARRYING.test(JSON.stringify(record.entries ?? '')),
  )
  const ruled = (record: (typeof speaking)[number]['record']) =>
    worksWhileCarried(kindOf(record), record.entries)

  it('rules every item whose text speaks of carrying, or says why it does not', () => {
    const unknown = speaking
      .filter(({ record }) => !ruled(record))
      .map(({ collection, record }) => recordId(collection, record))
      .filter((id) => !(id in NOT_CARRIED))
    expect(unknown).toEqual([])
  })

  it('excuses only items that speak of carrying and are not ruled carried', () => {
    const open = new Set(
      speaking
        .filter(({ record }) => !ruled(record))
        .map(({ collection, record }) => recordId(collection, record)),
    )
    expect(Object.keys(NOT_CARRIED).filter((id) => !open.has(id))).toEqual([])
  })

  it('finds the items the books say work while carried, Stone of Good Luck among them', () => {
    const carried = speaking
      .filter(({ record }) => ruled(record))
      .map(({ collection, record }) => recordId(collection, record))
    expect(carried).toContain('item|Stone of Good Luck|DMG')
    expect(carried).toContain('item|Stone of Good Luck|XDMG')
    expect(carried.length).toBeGreaterThan(30)
  })
})
