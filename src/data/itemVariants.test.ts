import { describe, expect, it } from 'vitest'
import { makeItem } from '../test/itemFixtures'
import { makeLookups, type RawItem } from './itemRead'
import type { Item, ItemKind } from './itemTypes'
import {
  appliesToText,
  applyVariant,
  evaluateExpression,
  readVariant,
  variantApplies,
} from './itemVariants'

const lookups = makeLookups(
  {
    properties: [
      {
        abbreviation: 'F',
        source: 'XPHB',
        template: '{{prop_name}}',
        entries: [{ type: 'entries', name: 'Finesse', entries: ['Use Dex.'] }],
      },
    ],
    masteries: [],
    types: [],
  },
  () => 'one',
)
const noNamed = (): ItemKind | undefined => undefined
const variant = (
  raw: RawItem,
  kindOfNamed: (name: string, source: string) => ItemKind | undefined = noNamed,
): Item => readVariant(raw, lookups, kindOfNamed)

const plusOneWeapon = variant({
  name: '+1 Weapon',
  source: '',
  requires: [{ weapon: true }],
  excludes: { net: true },
  inherits: {
    namePrefix: '+1 ',
    source: 'XDMG',
    page: 213,
    rarity: 'uncommon',
    bonusWeapon: '+1',
    srd52: true,
    entries: ['You have a {=bonusWeapon} bonus to attack and damage rolls.'],
  },
})

const longsword = makeItem({
  name: 'Longsword',
  source: 'XPHB',
  type: 'M',
  kind: 'weapon',
  category: 'Martial melee weapon',
  weight: 3,
  value: 1500,
  weapon: {
    category: 'martial',
    melee: true,
    damage: { text: '1d8', average: 4.5 },
    damageTypes: ['Slashing'],
    properties: [],
    mastery: [],
  },
  family: ['sword'],
})

describe('readVariant', () => {
  it('makes one row of the table of a template, with where it applies', () => {
    expect(plusOneWeapon.key).toBe('+1 Weapon|XDMG')
    expect(plusOneWeapon.kind).toBe('weapon')
    expect(plusOneWeapon.category).toBe('Weapon (generic variant)')
    expect(plusOneWeapon.rarity).toBe('uncommon')
    expect(plusOneWeapon.magic).toBe(true)
    expect(plusOneWeapon.free).toBe(true)
    expect(plusOneWeapon.bonuses).toEqual([
      { what: 'weapon attack and damage', value: '+1' },
    ])
    expect(plusOneWeapon.variant?.appliesTo).toBe('Any weapon')
  })

  it('fills the bonus into the text the book prints', () => {
    expect(plusOneWeapon.entries).toEqual([
      'You have a +1 bonus to attack and damage rolls.',
    ])
  })

  it('knows what a template for armor, shields and ammunition makes', () => {
    const armor = variant({
      name: '+2 Armor',
      source: '',
      requires: [{ type: 'LA|XPHB' }, { type: 'MA|XPHB' }, { type: 'HA|XPHB' }],
      inherits: { namePrefix: '+2 ', source: 'DMG', bonusAc: '+2' },
    })
    expect(armor.kind).toBe('armor')
    expect(armor.variant?.appliesTo).toBe('Any light, medium or heavy armor')
    expect(armor.bonuses).toEqual([{ what: 'AC', value: '+2' }])
    const shield = variant({
      name: '+1 Shield',
      source: '',
      requires: [{ type: 'S' }],
      inherits: { namePrefix: '+1 ', source: 'DMG' },
    })
    expect(shield.kind).toBe('shield')
    const ammo = variant({
      name: '+1 Ammunition',
      source: '',
      requires: [{ type: 'A' }, { type: 'AF|DMG' }],
      inherits: { namePrefix: '+1 ', source: 'DMG' },
    })
    expect(ammo.kind).toBe('ammunition')
    expect(ammo.variant?.appliesTo).toBe('Any ammunition')
  })

  it('takes the kind of a template that names items from the items named', () => {
    const named = variant(
      {
        name: 'Dragon Scale Mail',
        source: '',
        requires: [{ name: 'Scale Mail', source: 'PHB' }],
        inherits: { source: 'DMG' },
      },
      (name) => (name === 'Scale Mail' ? 'armor' : undefined),
    )
    expect(named.kind).toBe('armor')
    expect(named.variant?.appliesTo).toBe('Scale Mail')
  })

  it('keeps a template with no requirements, as the Guardian items of Unearthed Arcana', () => {
    const guardian = variant({
      name: 'Guardian Thing',
      source: 'AU',
      inherits: { source: 'AU', rarity: 'rare' },
    })
    expect(guardian.kind).toBe('other')
    expect(guardian.variant?.appliesTo).toBe('See the item text')
    expect(variantApplies(guardian, longsword)).toBe(false)
  })

  it('works from a source of its own when the template carries none, and from ammo flags', () => {
    const rough = variant({ name: 'Rough', source: 'AU', ammo: true })
    expect(rough.source).toBe('AU')
    expect(rough.kind).toBe('ammunition')
  })
})

describe('applyVariant', () => {
  it('lays the template over the base item', () => {
    const made = applyVariant(plusOneWeapon, longsword)
    expect(made.name).toBe('+1 Longsword')
    expect(made.key).toBe('+1 Longsword|XDMG')
    expect(made.source).toBe('XDMG')
    expect(made.rarity).toBe('uncommon')
    expect(made.magic).toBe(true)
    expect(made.weapon?.damage?.text).toBe('1d8')
    expect(made.weight).toBe(3)
    expect(made.value).toBeUndefined()
    expect(made.bonuses).toEqual([{ what: 'weapon attack and damage', value: '+1' }])
    expect(made.variant).toBeUndefined()
    expect(made.twin).toBeUndefined()
    expect(made.entries).toEqual(['You have a +1 bonus to attack and damage rolls.'])
  })

  it('keeps the bonuses a base item already has', () => {
    const base = makeItem({ ...longsword, bonuses: [{ what: 'AC', value: '+1' }] })
    expect(applyVariant(plusOneWeapon, base).bonuses).toHaveLength(2)
  })

  it('adds a property the template grants', () => {
    const evolving = variant({
      name: 'Wave-Swept Weapon',
      source: '',
      requires: [{ name: 'Longsword', source: 'XPHB' }],
      inherits: { source: 'AU', propertyAdd: ['F|XPHB', 'Nope|XPHB'] },
    })
    const made = applyVariant(evolving, longsword)
    expect(made.weapon?.properties.map((p) => p.name)).toEqual(['Finesse'])
  })

  it('takes strength and stealth from the template for armor, and keeps the base', () => {
    const plate = makeItem({
      name: 'Plate Armor',
      type: 'HA',
      kind: 'armor',
      armor: { base: 18, strength: 15, stealth: true, class: 'heavy' },
    })
    const mithral = variant({
      name: 'Mithral Armor',
      source: '',
      requires: [{ type: 'MA' }, { type: 'HA' }],
      inherits: { namePrefix: 'Mithral ', source: 'DMG', strength: '0', stealth: false },
    })
    expect(applyVariant(mithral, plate).armor).toEqual({
      base: 18,
      strength: 15,
      stealth: true,
      class: 'heavy',
    })
    const adamantine = variant({
      name: 'Adamantine Armor',
      source: '',
      requires: [{ type: 'HA' }],
      inherits: { source: 'DMG', strength: '13', stealth: true },
    })
    expect(applyVariant(adamantine, plate).armor).toMatchObject({
      strength: 13,
      stealth: true,
    })
    expect(applyVariant(adamantine, makeItem({ name: 'Cloak' })).armor).toBeUndefined()
  })

  it('works a price and a weight out of the base item, and drops a word from its name', () => {
    const barding = variant({
      name: 'Barding',
      source: '',
      requires: [{ type: 'HA' }],
      inherits: {
        nameRemove: ' Armor',
        nameSuffix: ' Barding',
        source: 'PHB',
        valueExpression: '[[baseItem.value]] * 4',
        weightExpression: '[[baseItem.weight]] * 2',
      },
    })
    const base = makeItem({ name: 'Plate Armor', value: 150000, weight: 65 })
    const made = applyVariant(barding, base)
    expect(made.name).toBe('Plate Barding')
    expect(made.value).toBe(600000)
    expect(made.weight).toBe(130)
  })

  it('is the base item itself for something that is not a template', () => {
    expect(applyVariant(longsword, longsword)).toBe(longsword)
  })
})

describe('evaluateExpression', () => {
  it('works out the three shapes the data uses', () => {
    expect(evaluateExpression('[[baseItem.value]] * 4', 100)).toBe(400)
    expect(evaluateExpression('[[baseItem.value]] + 50000', 100)).toBe(50100)
    expect(evaluateExpression('[[baseItem.value]] - 10', 100)).toBe(90)
  })

  it('has nothing for an expression it cannot read or a base without the number', () => {
    expect(evaluateExpression('[[baseItem.value]] * 4', undefined)).toBeUndefined()
    expect(evaluateExpression('something else', 100)).toBeUndefined()
  })
})

describe('variantApplies', () => {
  it('fits a weapon, not armor, and never a magic item or another template', () => {
    expect(variantApplies(plusOneWeapon, longsword)).toBe(true)
    expect(
      variantApplies(
        plusOneWeapon,
        makeItem({ name: 'Chain Mail', armor: { stealth: false } }),
      ),
    ).toBe(false)
    expect(variantApplies(plusOneWeapon, makeItem({ ...longsword, magic: true }))).toBe(
      false,
    )
    expect(variantApplies(plusOneWeapon, plusOneWeapon)).toBe(false)
    expect(variantApplies(longsword, longsword)).toBe(false)
  })

  it('leaves out what the template excludes', () => {
    const net = makeItem({ ...longsword, name: 'Net', family: ['net'] })
    expect(variantApplies(plusOneWeapon, net)).toBe(false)
    const unknownExclusion = variant({
      name: 'Cell',
      source: '',
      requires: [{ weapon: true }],
      excludes: { cellEnergy: true },
      inherits: { source: 'DMG' },
    })
    expect(variantApplies(unknownExclusion, longsword)).toBe(true)
  })

  it('fits by type, category, name, property, damage type, family, focus and armor flag', () => {
    const fits = (requires: Record<string, unknown>[], base: Item) =>
      variantApplies(
        variant({ name: 'T', source: '', requires, inherits: { source: 'DMG' } }),
        base,
      )
    const dagger = makeItem({
      ...longsword,
      name: 'Dagger',
      weapon: {
        ...longsword.weapon!,
        properties: [{ code: 'F', name: 'Finesse', rule: '', label: 'Finesse' }],
        damageTypes: ['Piercing'],
      },
      family: ['dagger'],
    })
    expect(fits([{ type: 'M|XPHB' }], longsword)).toBe(true)
    expect(fits([{ type: 'R' }], longsword)).toBe(false)
    expect(fits([{ weaponCategory: 'martial', sword: true }], longsword)).toBe(true)
    expect(fits([{ weaponCategory: 'simple' }], longsword)).toBe(false)
    expect(fits([{ name: 'longsword', source: 'XPHB' }], longsword)).toBe(true)
    expect(fits([{ name: 'longsword', source: 'PHB' }], longsword)).toBe(false)
    expect(fits([{ property: 'F|XPHB' }], dagger)).toBe(true)
    expect(fits([{ property: 'F|XPHB' }], longsword)).toBe(false)
    expect(fits([{ dmgType: 'P' }], dagger)).toBe(true)
    expect(fits([{ dmgType: 'S' }], dagger)).toBe(false)
    expect(fits([{ axe: true }], dagger)).toBe(false)
    expect(
      fits([{ scfType: 'arcane' }], makeItem({ name: 'Orb', focus: 'arcane' })),
    ).toBe(true)
    const mail = makeItem({
      name: 'Chain Mail',
      armor: { stealth: false, class: 'heavy' },
    })
    const shield = makeItem({
      name: 'Shield',
      armor: { stealth: false, class: 'shield' },
    })
    expect(fits([{ armor: true }], mail)).toBe(true)
    expect(fits([{ armor: true }], shield)).toBe(false)
    expect(fits([{ weapon: true }], mail)).toBe(false)
  })
})

describe('appliesToText', () => {
  const name = (reference: string) => (reference.startsWith('T|') ? 'Thrown' : reference)

  it('says it in words', () => {
    expect(appliesToText([{ sword: true }], name)).toBe('Any sword')
    expect(appliesToText([{ type: 'M' }, { type: 'R' }], name)).toBe(
      'Any melee weapon or any ranged weapon',
    )
    expect(appliesToText([{ weaponCategory: 'simple', property: 'T|XPHB' }], name)).toBe(
      'Any simple weapon with the thrown property',
    )
    expect(appliesToText([{ dmgType: 'S', sword: true }], name)).toBe(
      'Any slashing sword',
    )
    expect(appliesToText([{ scfType: 'holy' }, { scfType: 'other' }], name)).toBe(
      'Any holy symbol or any other',
    )
    expect(appliesToText([{ type: 'S' }, { armor: true }], name)).toBe(
      'Any shield or any armor',
    )
    expect(
      appliesToText(
        [{ type: 'LA' }, { type: 'MA' }, { type: 'HA' }, { type: 'S' }],
        name,
      ),
    ).toBe('Any light, medium or heavy armor or any shield')
    expect(appliesToText([{ type: 'LA' }, { type: 'MA' }], name)).toBe(
      'Any light armor or any medium armor',
    )
    expect(appliesToText([{ arrow: true }], name)).toBe('Any arrow')
    expect(appliesToText([], name)).toBe('See the item text')
  })
})
