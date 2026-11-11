import { describe, expect, it } from 'vitest'
import type { Item } from '../data/items'
import { readVariant } from '../data/itemVariants'
import { makeLookups } from '../data/itemRead'
import { makeItem } from '../test/itemFixtures'
import {
  CUSTOM_SOURCE,
  customItem,
  indexItems,
  inventoryKey,
  resolveInventoryItem,
  uniqueCustomName,
  unlistedItem,
  unpackStack,
} from './inventory'
import type { InventoryItem } from './model'

const longsword = makeItem({
  name: 'Longsword',
  source: 'XPHB',
  kind: 'weapon',
  weight: 3,
  weapon: {
    melee: true,
    damageTypes: ['Slashing'],
    properties: [],
    mastery: [],
  },
})
const template: Item = readVariant(
  {
    name: '+1 Weapon',
    source: '',
    requires: [{ weapon: true }],
    inherits: {
      namePrefix: '+1 ',
      source: 'XDMG',
      rarity: 'uncommon',
      bonusWeapon: '+1',
    },
  },
  makeLookups({ properties: [], masteries: [], types: [] }, () => 'one'),
  () => undefined,
)
const catalog = indexItems([longsword, template])

const stack = (extra: Partial<InventoryItem>): InventoryItem => ({
  name: 'Longsword',
  source: 'XPHB',
  quantity: 1,
  ...extra,
})

describe('inventoryKey', () => {
  it('is the name and source the history addresses a stack by', () => {
    expect(inventoryKey(stack({}))).toBe('Longsword|XPHB')
  })
})

describe('resolveInventoryItem', () => {
  it('finds a catalog item by name and source', () => {
    expect(resolveInventoryItem(stack({}), catalog)).toBe(longsword)
  })

  it('makes an item of a generic variant and its base item', () => {
    const made = resolveInventoryItem(
      stack({
        name: '+1 Longsword',
        source: 'XDMG',
        variantOf: '+1 Weapon|XDMG',
        base: 'Longsword|XPHB',
      }),
      catalog,
    )
    expect(made?.name).toBe('+1 Longsword')
    expect(made?.rarity).toBe('uncommon')
    expect(made?.weapon?.damageTypes).toEqual(['Slashing'])
  })

  it('has nothing for a variant whose template or base is gone', () => {
    const gone = stack({
      name: '+1 Axe',
      source: 'XDMG',
      variantOf: '+1 Weapon|XDMG',
      base: 'Axe|XPHB',
    })
    expect(resolveInventoryItem(gone, catalog)).toBeUndefined()
    expect(
      resolveInventoryItem(
        { ...gone, variantOf: 'Nope|XDMG', base: 'Longsword|XPHB' },
        catalog,
      ),
    ).toBeUndefined()
  })

  it('makes an item of the player own from what was kept of it', () => {
    const own = resolveInventoryItem(
      stack({
        name: 'Gift of the Duke',
        source: CUSTOM_SOURCE,
        custom: {
          kind: 'wondrous',
          rarity: 'rare',
          weight: 2,
          value: 5000,
          attunement: true,
          description: 'Glows.',
        },
      }),
      catalog,
    )
    expect(own).toMatchObject({
      key: 'Gift of the Duke|Custom',
      kind: 'wondrous',
      category: 'Wondrous item',
      magic: true,
      weight: 2,
      value: 5000,
      attunement: { required: true },
      entries: ['Glows.'],
    })
  })

  it('knows a plain custom item is not magic and needs no attunement', () => {
    const plain = customItem('Odd Rock', { kind: 'gear', description: '' })
    expect(plain).toMatchObject({ magic: false, attunement: undefined, entries: [] })
    expect(
      customItem('Odd Rock', { kind: 'gear', rarity: 'none', description: '' }).magic,
    ).toBe(false)
  })

  it('has nothing for an item of a book that is not there', () => {
    expect(
      resolveInventoryItem(stack({ name: 'Ghost', source: 'GONE' }), catalog),
    ).toBeUndefined()
  })
})

describe('unlistedItem', () => {
  it('names a stack nothing identifies, with no stats to count', () => {
    const item = unlistedItem(stack({ name: 'Ghost', source: 'GONE' }))
    expect(item).toMatchObject({ key: 'Ghost|GONE', name: 'Ghost', source: 'GONE' })
    expect(item.weight).toBeUndefined()
    expect(item.category).toBeUndefined()
  })
})

describe('uniqueCustomName', () => {
  const own = (name: string): InventoryItem => ({
    name,
    source: CUSTOM_SOURCE,
    quantity: 1,
  })

  it('keeps a name nobody has', () => {
    expect(uniqueCustomName([], 'Sword')).toBe('Sword')
    // A book item of the same name is another item.
    expect(uniqueCustomName([stack({ name: 'Sword', source: 'PHB' })], 'Sword')).toBe(
      'Sword',
    )
  })

  it('numbers a name that clashes', () => {
    expect(uniqueCustomName([own('Sword')], 'Sword')).toBe('Sword (2)')
    expect(uniqueCustomName([own('Sword'), own('Sword (2)')], 'Sword')).toBe('Sword (3)')
  })
})

describe('unpackStack', () => {
  const rope = makeItem({ name: 'Rope', source: 'PHB' })
  const pack = makeItem({
    name: "Explorer's Pack",
    source: 'PHB',
    pack: [
      { key: rope.key, name: 'rope', quantity: 1 },
      { name: 'a mystery', quantity: 2 },
    ],
  })
  const catalog = indexItems([rope, pack])

  it('opens one pack into what it holds, keeping what gave it', () => {
    const stacks: InventoryItem[] = [
      { name: pack.name, source: 'PHB', quantity: 2, from: 'class' },
      { name: 'Rope', source: 'PHB', quantity: 1 },
    ]
    const next = unpackStack(stacks, pack, catalog)
    expect(next).toEqual([
      { name: pack.name, source: 'PHB', quantity: 1, from: 'class' },
      { name: 'Rope', source: 'PHB', quantity: 2 },
      {
        name: 'a mystery',
        source: CUSTOM_SOURCE,
        quantity: 2,
        from: 'class',
        custom: { kind: 'gear', description: '' },
      },
    ])
    // The stacks given are not changed.
    expect(stacks[0].quantity).toBe(2)
  })

  it('removes the pack when it was the last one', () => {
    const next = unpackStack(
      [{ name: pack.name, source: 'PHB', quantity: 1 }],
      pack,
      catalog,
    )
    expect(next.map((s) => s.name)).toEqual(['Rope', 'a mystery'])
  })
})
