import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Item } from '../../data/items'
import { makeItem } from '../../test/itemFixtures'
import { factValue, type Fact } from '../table/facts'
import type { Column } from '../table/types'
import {
  armorText,
  attunementText,
  damageText,
  describeItems,
  itemColumns,
  itemKey,
  itemName,
  itemRowMeta,
  itemSearchText,
  itemSummaryColumns,
  itemTags,
  withItemVersions,
} from './itemFacts'

const longsword = makeItem({
  name: 'Longsword',
  source: 'XPHB',
  edition: 'one',
  twin: 'Longsword|PHB',
  kind: 'weapon',
  category: 'Martial melee weapon',
  weight: 3,
  value: 1500,
  page: 62,
  free: true,
  groups: ['Swords'],
  entries: ['A fine blade.'],
  weapon: {
    category: 'martial',
    melee: true,
    damage: { text: '1d8', average: 4.5 },
    versatile: { text: '1d10', average: 5.5 },
    damageTypes: ['Slashing'],
    properties: [
      {
        code: 'V',
        name: 'Versatile',
        rule: 'Can be used with two hands.',
        label: 'Versatile (1d10)',
      },
    ],
    mastery: [{ name: 'Sap', rule: 'The target has Disadvantage on its next attack.' }],
  },
})
const oldLongsword = makeItem({
  name: 'Longsword',
  source: 'PHB',
  twin: 'Longsword|XPHB',
  kind: 'weapon',
})
const longbow = makeItem({
  name: 'Longbow',
  kind: 'weapon',
  weight: 2,
  value: 5000,
  weapon: {
    category: 'martial',
    melee: false,
    damage: { text: '1d8', average: 4.5 },
    damageTypes: ['Piercing'],
    properties: [],
    range: { normal: 150, long: 600 },
    mastery: [],
    ammoType: 'Arrow',
  },
})
const chainMail = makeItem({
  name: 'Chain Mail',
  kind: 'armor',
  category: 'Heavy armor',
  value: 7500,
  weight: 55,
  armor: { base: 16, strength: 13, stealth: true, class: 'heavy' },
})
const halfPlate = makeItem({
  name: 'Half Plate Armor',
  kind: 'armor',
  armor: { base: 15, stealth: true, dexterityMax: 2, class: 'medium' },
})
const leather = makeItem({
  name: 'Leather Armor',
  kind: 'armor',
  armor: { base: 11, stealth: false, class: 'light' },
})
const shield = makeItem({
  name: 'Shield',
  kind: 'shield',
  armor: { bonus: 2, stealth: false, class: 'shield' },
})
const wand = makeItem({
  name: 'Wand of Fireballs',
  source: 'DMG',
  kind: 'wand',
  magic: true,
  rarity: 'rare',
  tier: 'major',
  attunement: {
    required: true,
    optional: false,
    text: 'by a wizard',
    classes: ['wizard'],
  },
  bonuses: [{ what: 'spell attack', value: '+1' }],
  charges: { max: '7', recharge: 'at dawn', amount: '1d6 + 1' },
  spells: [{ name: 'Fireball', how: '1 charge' }],
  traits: ['Resistance to fire'],
})
const pack = makeItem({
  name: "Explorer's Pack",
  kind: 'gear',
  pack: [
    { name: 'Backpack', quantity: 1 },
    { name: 'Torch', quantity: 10 },
  ],
})
const bag = makeItem({
  name: 'Bag of Holding',
  kind: 'wondrous',
  rarity: 'uncommon',
  container: { weight: 500, weightless: true },
  attunement: { required: false, optional: true, classes: [] },
})
const galleon = makeItem({
  name: 'Galleon',
  kind: 'vehicle',
  vehicle: { speed: '4 mph', ac: 15, hp: 500, cargoTons: 150, crew: '30' },
  rarity: 'legendary',
})
const template = makeItem({
  name: '+1 Weapon',
  kind: 'weapon',
  rarity: 'uncommon',
  variant: {
    requires: [],
    excludes: {},
    appliesTo: 'Any weapon',
    propertyAdd: [],
  },
})
const odd = makeItem({ name: 'Odd', rarity: 'varies' })

const column = (key: string): Column<Item> => {
  const found = itemColumns.find((c) => c.key === key)
  if (!found) throw new Error(`no column ${key}`)
  return found
}
const sortOf = (key: string, item: Item) => column(key).sortValue?.(item)
const filterOf = (key: string, item: Item) => column(key).filterValue?.(item)

const factsOf = (item: Item) =>
  Object.fromEntries(
    describeItems([item])
      .flatMap((group) => group.facts)
      .map((fact: Fact<Item>) => [fact.key, fact.text(item)]),
  )

describe('the name sort', () => {
  it('ignores a leading +N, so bonus items do not all come first', () => {
    const named = (name: string) => makeItem({ name })
    expect(sortOf('name', named('+1 Longsword'))).toBe('Longsword')
    expect(sortOf('name', named('+3 Armor'))).toBe('Armor')
    expect(sortOf('name', named('Ring of +1 Protection'))).toBe('Ring of +1 Protection')
  })
})

describe('item keys', () => {
  it('names an item by its key and name, and tags it with its edition', () => {
    expect(itemKey(longsword)).toBe('Longsword|XPHB')
    expect(itemName(longsword)).toBe('Longsword')
    expect(itemTags(longsword)).toEqual(['2024'])
    expect(itemTags(oldLongsword)).toEqual(['2014'])
  })
})

describe('what an item says of itself', () => {
  it('writes weapon damage in one line, with the two-handed die', () => {
    expect(damageText(longsword)).toBe('1d8 slashing, versatile 1d10')
    expect(damageText(longbow)).toBe('1d8 piercing')
    expect(damageText(chainMail)).toBe('')
  })

  it('writes armor class by the kind of armor', () => {
    expect(armorText(chainMail)).toBe('16')
    expect(armorText(halfPlate)).toBe('15 + Dexterity (max 2)')
    expect(armorText(leather)).toBe('11 + Dexterity')
    expect(armorText(shield)).toBe('+2')
    expect(armorText(longsword)).toBe('')
    expect(armorText(makeItem({ name: 'Plus One', armor: { stealth: false } }))).toBe('')
  })

  it('writes what attuning asks', () => {
    expect(attunementText(wand)).toBe('By a wizard')
    expect(attunementText(bag)).toBe('Optional')
    expect(
      attunementText(
        makeItem({
          name: 'Ring',
          attunement: { required: true, optional: false, classes: [] },
        }),
      ),
    ).toBe('Yes')
    expect(attunementText(longsword)).toBe('')
  })

  it('states every stat the data has, in words', () => {
    expect(factsOf(longsword)).toMatchObject({
      type: 'Martial melee weapon',
      cost: '15 gp',
      weight: '3 lb.',
      rarity: '',
      source: 'XPHB',
      edition: '2024',
      free: 'Yes',
      page: 'p. 62',
      partOf: 'Swords',
      weaponCategory: 'Martial melee',
      damage: '1d8 slashing, versatile 1d10',
      properties: 'Versatile (1d10), Mastery: Sap',
      ac: '',
    })
    expect(factsOf(longbow)).toMatchObject({
      range: '150/600 ft.',
      ammunition: 'Arrow',
      cost: '50 gp',
    })
    expect(factsOf(chainMail)).toMatchObject({
      ac: '16',
      strength: 'Strength 13',
      stealth: 'Disadvantage',
    })
    expect(factsOf(wand)).toMatchObject({
      rarity: 'Rare',
      tier: 'Major',
      attunement: 'By a wizard',
      bonuses: '+1 spell attack',
      charges: '7, regains 1d6 + 1 at dawn',
      spells: 'Fireball (1 charge)',
      traits: 'Resistance to fire',
    })
    expect(factsOf(pack)).toMatchObject({
      pack: 'Backpack, Torch (10)',
    })
    expect(factsOf(bag)).toMatchObject({
      container: 'Holds 500 lb., contents weigh nothing',
    })
    expect(factsOf(galleon)).toMatchObject({
      'vehicle-Speed': '4 mph',
      'vehicle-Cargo': '150 tons',
      'vehicle-Passengers': '',
    })
    expect(sortOf('vehicle', galleon)).toBe(
      'Speed 4 mph; Armor class 15; Hit points 500; Crew 30; Cargo 150 tons',
    )
    expect(factsOf(template)).toMatchObject({ appliesTo: 'Any weapon' })
  })

  it('puts the weight note with the weight', () => {
    expect(
      factsOf(makeItem({ name: 'Cart', weight: 200, weightNote: 'empty' })).weight,
    ).toBe('200 lb., empty')
    expect(factsOf(makeItem({ name: 'Smoke', weightNote: 'varies' })).weight).toBe(
      'varies',
    )
  })

  it('draws the text last, as entries', () => {
    const groups = describeItems([longsword])
    expect(groups.map((g) => g.key)).toEqual([
      'overview',
      'weapon',
      'armor',
      'magic',
      'container',
      'vehicle',
      'text',
    ])
    const description = groups[groups.length - 1].facts[0]
    render(<>{factValue(description, longsword)}</>)
    expect(screen.getByText('A fine blade.')).toBeInTheDocument()
    expect(factValue(description, odd)).toBeNull()
  })
})

describe('the item table', () => {
  it('opens on the stats compared by, with the rest in the chooser', () => {
    const shown = itemColumns.filter((c) => !c.defaultHidden).map((c) => c.key)
    expect(shown).toEqual([
      'name',
      'type',
      'cost',
      'weight',
      'damage',
      'properties',
      'ac',
      'rarity',
      'attunement',
      'edition',
      'source',
    ])
    const hidden = itemColumns.filter((c) => c.defaultHidden).map((c) => c.key)
    expect(hidden).toEqual(
      expect.arrayContaining([
        'range',
        'strength',
        'stealth',
        'bonuses',
        'charges',
        'spells',
        'container',
        'pack',
        'traits',
        'tier',
        'free',
        'weaponCategory',
        'vehicle',
        'page',
      ]),
    )
  })

  it('sorts cost, weight, damage and armor class as numbers', () => {
    expect(sortOf('cost', longsword)).toBe(1500)
    expect(sortOf('cost', odd)).toBe(-1)
    expect(sortOf('weight', chainMail)).toBe(55)
    expect(sortOf('weight', odd)).toBe(-1)
    expect(sortOf('damage', longsword)).toBe(5.5)
    expect(sortOf('damage', chainMail)).toBe(0)
    expect(sortOf('ac', chainMail)).toBe(16)
    expect(sortOf('ac', shield)).toBe(2)
    expect(sortOf('ac', longsword)).toBe(-1)
    expect(sortOf('range', longbow)).toBe(150)
    expect(sortOf('range', longsword)).toBe(-1)
    expect(sortOf('strength', chainMail)).toBe(13)
    expect(sortOf('page', longsword)).toBe(62)
    expect(sortOf('page', odd)).toBe(-1)
  })

  it('sorts rarity from common to artifact, with the unplaced after', () => {
    const rank = (item: Item) => sortOf('rarity', item) as number
    const rarities = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']
    const ranks = rarities.map((r) => rank(makeItem({ name: r, rarity: r })))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(rank(longsword)).toBeLessThan(rank(makeItem({ name: 'c', rarity: 'common' })))
    expect(rank(odd)).toBeGreaterThan(rank(makeItem({ name: 'a', rarity: 'artifact' })))
  })

  it('offers each kind of damage, armor, property and bonus to filter by', () => {
    expect(filterOf('damage', longsword)).toEqual(['Slashing'])
    expect(filterOf('damage', chainMail)).toEqual(['-'])
    expect(filterOf('ac', chainMail)).toBe('Heavy armor')
    expect(filterOf('ac', halfPlate)).toBe('Medium armor')
    expect(filterOf('ac', leather)).toBe('Light armor')
    expect(filterOf('ac', shield)).toBe('Shield')
    expect(filterOf('ac', longsword)).toBe('-')
    expect(filterOf('properties', longsword)).toEqual(['Versatile', 'Mastery: Sap'])
    expect(filterOf('properties', chainMail)).toEqual(['-'])
    expect(filterOf('bonuses', wand)).toEqual(['spell attack'])
    expect(filterOf('spells', wand)).toEqual(['Fireball'])
    expect(filterOf('attunement', wand)).toBe('By a wizard')
    expect(filterOf('attunement', longsword)).toBe('No')
    expect(filterOf('stealth', chainMail)).toBe('Yes')
    expect(filterOf('stealth', longsword)).toBe('No')
    expect(filterOf('charges', wand)).toBe('Yes')
    expect(filterOf('container', bag)).toBe('Yes')
    expect(filterOf('free', longsword)).toBe('Yes')
    expect(filterOf('free', oldLongsword)).toBe('No')
  })

  it('says No where nothing is needed to attune, and a dash where a stat is blank', () => {
    render(<>{column('attunement').render(longsword)}</>)
    expect(screen.getByText('No')).toBeInTheDocument()
    render(<>{column('cost').render(odd)}</>)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('gives each property its rule on hover, and the mastery too', async () => {
    const user = userEvent.setup()
    render(<>{column('properties').render(longsword)}</>)
    await user.hover(screen.getByText('Versatile (1d10)'))
    expect(await screen.findByText('Can be used with two hands.')).toBeInTheDocument()
    await user.hover(screen.getByText('Mastery: Sap'))
    expect(
      await screen.findByText('The target has Disadvantage on its next attack.'),
    ).toBeInTheDocument()
  })

  it('spells out the coin, the pound and the foot on hover', async () => {
    const user = userEvent.setup()
    render(
      <>
        {column('cost').render(longsword)}
        {column('weight').render(longsword)}
        {column('range').render(longbow)}
      </>,
    )
    await user.hover(screen.getByText('gp'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('gold pieces')
    await user.hover(screen.getByText('lb'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('pounds')
    await user.hover(screen.getByText('ft'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('feet')
  })

  it('names the armor class column in words on hover', async () => {
    const user = userEvent.setup()
    render(<>{column('ac').header}</>)
    await user.hover(screen.getByText('AC'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Armor Class')
  })

  it('tells a template to choose a base', () => {
    render(<>{column('name').render(template)}</>)
    expect(screen.getByText('+1 Weapon')).toBeInTheDocument()
    expect(screen.getByText('Choose a base')).toBeInTheDocument()
    render(<>{column('name').render(longsword)}</>)
    expect(screen.getAllByText('Choose a base')).toHaveLength(1)
  })

  it('keeps a short table of the stats played with', () => {
    expect(itemSummaryColumns.map((c) => c.key)).toEqual([
      'name',
      'type',
      'damage',
      'ac',
      'properties',
      'weight',
      'cost',
    ])
  })
})

describe('the two editions of an item', () => {
  it('puts the edition year beside the name of an item with a twin only', () => {
    const name = withItemVersions(itemColumns).find((c) => c.key === 'name')
    render(
      <>
        {name?.render(longsword)}
        {name?.render(longbow)}
      </>,
    )
    expect(screen.getAllByText('2024')).toHaveLength(1)
    expect(screen.getByText('Longbow')).toBeInTheDocument()
    expect(withItemVersions(itemColumns)).toHaveLength(itemColumns.length)
  })

  it('greys the other edition of an item and says which one to choose', () => {
    const meta = itemRowMeta('one')
    expect(meta(longsword)).toEqual({ standard: true })
    expect(meta(oldLongsword)).toEqual({
      standard: false,
      reason: '2014 version; the 2024 one is Longsword XPHB',
    })
    expect(meta(longbow)).toEqual({ standard: true })
    expect(itemRowMeta('classic')(longsword)).toEqual({
      standard: false,
      reason: '2024 version; the 2014 one is Longsword PHB',
    })
  })

  it('names a twin that has no book after its name', () => {
    const lone = makeItem({ name: 'Rope', edition: 'one', twin: 'Rope' })
    expect(itemRowMeta('classic')(lone).reason).toBe('2024 version; the 2014 one is Rope')
  })
})

describe('what the search box looks through', () => {
  it('finds an item by its group, type, property, spell or text', () => {
    const text = itemSearchText(longsword)
    for (const word of [
      'Longsword',
      'Swords',
      'Martial melee',
      'Versatile',
      'Sap',
      'blade',
    ]) {
      expect(text).toContain(word)
    }
    expect(itemSearchText(wand)).toContain('Fireball')
  })
})
