import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { fetchData } from '../data/dataClient'
import type { Item } from '../data/items'
import { loadItems } from '../data/items'
import { startingGold } from '../data/background'
import { makeItem } from '../test/itemFixtures'
import {
  addCoin,
  coinParts,
  defaultSelection,
  goldOf,
  isGoldOnly,
  matchesEquipmentType,
  parseGoldRoll,
  pickOf,
  pickRows,
  selectedGear,
  selectionGold,
  selectionOf,
  skipStarting,
  stacksOf,
  startingChoices,
  takeStarting,
  unpickedSlots,
  type StartingChoices,
} from './startingEquipment'

// The real data: the full content when it is pulled, else the free rules the site hosts.
const dataDir = existsSync('.local/data/items.json') ? '.local/data' : 'public/data'
vi.mock('../data/dataClient', () => ({ fetchData: vi.fn() }))
const readJson = (path: string) =>
  JSON.parse(readFileSync(`${dataDir}/${path}`, 'utf8')) as unknown

const mace = makeItem({ name: 'Mace', source: 'PHB', kind: 'weapon' })
const sword = makeItem({
  name: 'Longsword',
  source: 'PHB',
  kind: 'weapon',
  weapon: {
    category: 'martial',
    melee: true,
    damageTypes: [],
    properties: [],
    mastery: [],
  },
})
const bow = makeItem({
  name: 'Longbow',
  source: 'PHB',
  kind: 'weapon',
  weapon: {
    category: 'martial',
    melee: false,
    damageTypes: [],
    properties: [],
    mastery: [],
  },
})
const dagger = makeItem({
  name: 'Dagger',
  source: 'PHB',
  kind: 'weapon',
  weapon: {
    category: 'simple',
    melee: true,
    damageTypes: [],
    properties: [],
    mastery: [],
  },
})
const pack = makeItem({ name: "Explorer's Pack", source: 'PHB' })
const catalog = [mace, sword, bow, dagger, pack]

const data2014 = [
  { a: ['mace|phb'], b: [{ equipmentType: 'weaponMartial', quantity: 2 }] },
  { _: [{ item: 'dagger|phb', quantity: 2 }, { special: 'a letter' }, 'rope|phb'] },
]
const data2024 = [
  {
    A: [{ item: "explorer's pack|phb" }, { value: 400 }],
    B: [{ value: 15500 }],
  },
]

describe('startingChoices', () => {
  it('reads blocks with their fixed gear and options', () => {
    const choices = startingChoices('Fighter|PHB', data2014, catalog)
    expect(choices.blocks).toHaveLength(2)
    expect(choices.blocks[0].options.map((o) => o.key)).toEqual(['a', 'b'])
    expect(choices.blocks[1].options).toEqual([])
    // A name the catalog lacks stays, as a custom item; a special is custom too.
    expect(choices.blocks[1].fixed.map((g) => g.kind)).toEqual([
      'item',
      'custom',
      'custom',
    ])
    expect(choices.blocks[1].fixed[2]).toMatchObject({ name: 'Rope' })
  })

  it('makes a pick of quantity two into two picks', () => {
    const choices = startingChoices('Fighter|PHB', data2014, catalog)
    const picks = choices.blocks[0].options[1].gear
    expect(picks.map((g) => g.kind)).toEqual(['pick', 'pick'])
    expect(picks[0]).toMatchObject({ label: 'Martial weapon', types: ['weaponMartial'] })
    expect(new Set(picks.map((g) => (g.kind === 'pick' ? g.slot : ''))).size).toBe(2)
  })

  it('reads coin, the gold-only option and a pouch of coin', () => {
    const choices = startingChoices('Fighter|PHB', data2024, catalog)
    const [a, b] = choices.blocks[0].options
    expect([a.gold, b.gold]).toEqual([400, 15500])
    expect(isGoldOnly(a)).toBe(false)
    expect(isGoldOnly(b)).toBe(true)
    const pouch = startingChoices(
      'Acolyte|PHB',
      [{ _: [{ item: 'pouch|phb', containsValue: 1500 }] }],
      catalog,
    )
    expect(goldOf(pouch.blocks[0].fixed)).toBe(1500)
  })

  it('keeps a flavour name as the note of the item, and the worth of a special', () => {
    const choices = startingChoices(
      'Acolyte|PHB',
      [
        {
          _: [
            { item: 'mace|phb', displayName: 'ceremonial mace' },
            { special: 'a gem', worthValue: 1000 },
          ],
        },
      ],
      catalog,
    )
    const [item, gem] = choices.blocks[0].fixed
    expect(item).toMatchObject({ kind: 'item', note: 'ceremonial mace' })
    expect(gem).toMatchObject({ kind: 'custom', name: 'A gem', value: 1000 })
  })

  it('reads the gold roll of a 2014 class', () => {
    expect(parseGoldRoll('{@dice 5d4 × 10|5d4 × 10|Starting Gold}')).toEqual({
      dice: 5,
      sides: 4,
      multiplier: 10,
    })
    expect(parseGoldRoll('{@dice 5d4|5d4|Starting Gold}')).toEqual({
      dice: 5,
      sides: 4,
      multiplier: 1,
    })
    expect(parseGoldRoll(undefined)).toBeUndefined()
    expect(parseGoldRoll('nothing')).toBeUndefined()
  })

  it('has no choices for a source with no data', () => {
    expect(startingChoices('Sidekick|TCE', undefined, catalog).blocks).toEqual([])
  })
})

describe('matchesEquipmentType', () => {
  it('matches weapons by category and melee', () => {
    expect(matchesEquipmentType('weaponMartial', sword)).toBe(true)
    expect(matchesEquipmentType('weaponMartialMelee', bow)).toBe(false)
    expect(matchesEquipmentType('weaponSimple', dagger)).toBe(true)
    expect(matchesEquipmentType('weaponSimpleMelee', dagger)).toBe(true)
    expect(matchesEquipmentType('weaponSimple', sword)).toBe(false)
  })

  it('matches foci, instruments, tools and sets, never a magic item', () => {
    const typed = (type: string, extra: Partial<Item> = {}) =>
      makeItem({ name: type, type, ...extra })
    expect(
      matchesEquipmentType('focusSpellcastingArcane', typed('SCF', { focus: 'arcane' })),
    ).toBe(true)
    expect(
      matchesEquipmentType('focusSpellcastingHoly', typed('SCF', { focus: 'holy' })),
    ).toBe(true)
    expect(
      matchesEquipmentType('focusSpellcastingDruidic', typed('SCF', { focus: 'druid' })),
    ).toBe(true)
    expect(
      matchesEquipmentType(
        'instrumentMusical',
        makeItem({ name: 'Lute', kind: 'instrument' }),
      ),
    ).toBe(true)
    expect(matchesEquipmentType('toolArtisan', typed('AT'))).toBe(true)
    expect(matchesEquipmentType('setGaming', typed('GS'))).toBe(true)
    expect(matchesEquipmentType('setGaming', typed('GS', { magic: true }))).toBe(false)
    expect(matchesEquipmentType('unknownKind', typed('GS'))).toBe(false)
  })
})

describe('pickRows', () => {
  const firearm = makeItem({
    name: 'Laser Rifle',
    source: 'DMG',
    kind: 'weapon',
    weapon: {
      category: 'martial',
      melee: false,
      damageTypes: [],
      properties: [],
      mastery: [],
    },
  })
  const oneSword = makeItem({
    name: 'Longsword',
    source: 'XPHB',
    kind: 'weapon',
    weapon: {
      category: 'martial',
      melee: true,
      damageTypes: [],
      properties: [],
      mastery: [],
    },
  })
  const pick = { types: ['weaponMartial'] }

  it("offers the edition's Player's Handbook items that fit, not a laser rifle", () => {
    const rows = [sword, bow, dagger, firearm, oneSword]
    expect(pickRows(pick, rows, 'classic').map((i) => i.name)).toEqual([
      'Longsword',
      'Longbow',
    ])
    expect(pickRows(pick, rows, 'one').map((i) => i.key)).toEqual(['Longsword|XPHB'])
  })

  it('offers every item that fits when that book has none', () => {
    expect(pickRows(pick, [firearm], 'classic')).toEqual([firearm])
  })

  it('offers a member of an umbrella item by its group', () => {
    const symbol = makeItem({ name: 'Amulet', groups: ['Holy Symbol'] })
    expect(
      pickRows({ types: [], group: 'holy symbol' }, [symbol, mace], 'classic'),
    ).toEqual([symbol])
  })
})

describe('a selection', () => {
  const choices = startingChoices('Fighter|PHB', data2014, catalog)

  it('defaults to the first option of each block that offers some', () => {
    const selection = defaultSelection(choices)
    expect(selection.options).toEqual({ 0: 'a' })
    expect(selectedGear(choices, selection)).toHaveLength(1 + 3)
  })

  it('lists the picks still to make, and gives the item chosen', () => {
    const selection = { options: { 0: 'b' }, picks: {} }
    const open = unpickedSlots(choices, selection)
    expect(open).toHaveLength(2)
    const taken = {
      ...selection,
      picks: { [open[0].slot]: 'Longsword|PHB', [open[1].slot]: 'Longsword|PHB' },
    }
    expect(unpickedSlots(choices, taken)).toEqual([])
    const stacks = stacksOf(choices, taken, catalog, 'class', [])
    expect(stacks.find((s) => s.name === 'Longsword')).toMatchObject({
      quantity: 2,
      from: 'class',
    })
    expect(stacks.find((s) => s.name === 'Dagger')?.quantity).toBe(2)
    // The unknown special and name are custom stacks, named so they never clash.
    expect(stacks.filter((s) => s.source === 'Custom').map((s) => s.name)).toEqual([
      'A letter',
      'Rope',
    ])
  })

  it('gives nothing for a pick not made', () => {
    const stacks = stacksOf(
      choices,
      { options: { 0: 'b' }, picks: {} },
      catalog,
      'class',
      [],
    )
    expect(stacks.some((s) => s.name === 'Longsword')).toBe(false)
  })

  it('stores what was taken and restores the selection from it', () => {
    const selection = {
      options: { 0: 'b' },
      picks: { '0.b.0.0': 'Longsword|PHB', stray: 'x' },
    }
    const pick = pickOf(choices, selection, 0)
    expect(pick).toEqual({
      source: 'Fighter|PHB',
      option: 'b',
      picks: { '0.b.0.0': 'Longsword|PHB' },
      gold: 0,
    })
    expect(selectionOf(choices, pick)).toEqual({
      options: { 0: 'b' },
      picks: { '0.b.0.0': 'Longsword|PHB' },
    })
    expect(selectionOf(choices, undefined)).toEqual(defaultSelection(choices))
    // Gold taken is restored as the gold, over the default kit.
    expect(selectionOf(choices, { ...pick, option: 'gold' })).toEqual({
      ...defaultSelection(choices),
      gold: 0,
    })
    expect(selectionOf(choices, { ...pick, option: 'z' }).options).toEqual({ 0: 'a' })
  })

  it('adds up the coin of a selection', () => {
    const coins: StartingChoices = startingChoices('X|PHB', data2024, catalog)
    expect(selectionGold(coins, { options: { 0: 'B' }, picks: {} })).toBe(15500)
  })
})

describe('taking and skipping', () => {
  const choices = startingChoices('Fighter|PHB', data2024, catalog)
  const empty = {
    items: [],
    currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    starting: {},
  }

  it('adds the items and coin and keeps the pick', () => {
    const taken = takeStarting(
      empty,
      'class',
      choices,
      defaultSelection(choices),
      catalog,
    )
    expect(taken.items).toEqual([
      { name: "Explorer's Pack", source: 'PHB', quantity: 1, from: 'class' },
    ])
    expect(taken.currency.gp).toBe(4)
    expect(taken.starting.class).toMatchObject({ option: 'A', gold: 400 })
  })

  it('replaces only what that source gave, and takes its coin back', () => {
    const own = { name: 'Rope', source: 'Custom', quantity: 1 }
    const given = {
      name: 'Mace',
      source: 'PHB',
      quantity: 1,
      from: 'background' as const,
    }
    const before = takeStarting(
      { ...empty, items: [own, given], currency: { ...empty.currency, gp: 10 } },
      'class',
      choices,
      defaultSelection(choices),
      catalog,
    )
    const after = takeStarting(
      before,
      'class',
      choices,
      { options: { 0: 'B' }, picks: {} },
      catalog,
    )
    expect(after.items).toEqual([own, given])
    expect(after.currency.gp).toBe(10 + 155)
    expect(after.starting.class?.option).toBe('B')
  })

  it('takes gold in place of everything', () => {
    const taken = takeStarting(
      empty,
      'class',
      choices,
      { ...defaultSelection(choices), gold: 12000 },
      catalog,
    )
    expect(taken.items).toEqual([])
    expect(taken.currency.gp).toBe(120)
    expect(taken.starting.class).toEqual({
      source: 'Fighter|PHB',
      option: 'gold',
      picks: {},
      gold: 12000,
    })
    expect(selectionOf(choices, taken.starting.class)).toMatchObject({ gold: 12000 })
  })

  it('skipping gives nothing and replaces what was given', () => {
    const before = takeStarting(
      empty,
      'class',
      choices,
      defaultSelection(choices),
      catalog,
    )
    const skipped = skipStarting(before, 'class', 'Fighter|PHB')
    expect(skipped.items).toEqual([])
    expect(skipped.currency.gp).toBe(0)
    expect(skipped.starting.class?.option).toBe('none')
  })
})

describe('coin', () => {
  it('splits copper into gold, silver and copper', () => {
    expect(coinParts(1575)).toEqual({ gp: 15, sp: 7, cp: 5 })
  })

  it('adds and takes back, never below nothing', () => {
    const purse = { pp: 1, gp: 2, ep: 0, sp: 0, cp: 0 }
    expect(addCoin(purse, 1550)).toEqual({ pp: 1, gp: 17, ep: 0, sp: 5, cp: 0 })
    expect(addCoin(purse, -1550)).toEqual({ pp: 1, gp: 0, ep: 0, sp: 0, cp: 0 })
  })
})

// Every class and background of the data resolves, with the gold of every way of
// taking it matching `startingGold`, and every named item found in the catalog.
describe('every class and background of the data', () => {
  type Source = { name: string; source: string; startingEquipment?: unknown }
  const classEntries = (): Source[] => {
    const index = readJson('class/index.json') as Record<string, string>
    return Object.values(index).flatMap(
      (file) => (readJson(`class/${file}`) as { class?: Source[] }).class ?? [],
    )
  }
  const waysOf = (choices: StartingChoices): number[] => {
    let totals = [0]
    for (const block of choices.blocks) {
      const fixed = goldOf(block.fixed)
      const ways = block.options.length > 0 ? block.options.map((o) => o.gold) : [0]
      totals = totals.flatMap((t) => ways.map((w) => t + fixed + w))
    }
    return [...new Set(totals)].sort((a, b) => a - b)
  }

  it('reads without throwing, with the gold startingGold finds', async () => {
    vi.mocked(fetchData).mockImplementation(
      (path: string) => Promise.resolve(readJson(path)) as Promise<never>,
    )
    const items = await loadItems()
    const classes = classEntries().filter((c) => c.startingEquipment)
    const backgrounds = (
      readJson('backgrounds.json') as { background: Source[] }
    ).background.filter((b) => Array.isArray(b.startingEquipment))

    expect(classes.length).toBeGreaterThan(0)
    expect(backgrounds.length).toBeGreaterThan(0)

    // An item the data names that the catalog has no row for (a special is no item).
    const unmatched: string[] = []
    const checkNames = (choices: StartingChoices) => {
      for (const block of choices.blocks)
        for (const gear of [...block.fixed, ...block.options.flatMap((o) => o.gear)])
          if (gear.kind === 'custom' && !gear.special)
            unmatched.push(`${choices.source}: ${gear.name}`)
    }

    for (const c of classes) {
      const data = c.startingEquipment as {
        defaultData?: unknown[]
        goldAlternative?: string
      }
      const choices = startingChoices(
        `${c.name}|${c.source}`,
        data.defaultData,
        items,
        data.goldAlternative,
      )
      checkNames(choices)
      expect(waysOf(choices), c.name).toEqual(startingGold(data.defaultData))
      // A 2014 class offers gold as a roll, a 2024 one as an option.
      if (data.goldAlternative) expect(choices.goldRoll, c.name).toBeDefined()
    }
    for (const b of backgrounds) {
      const blocks = b.startingEquipment as unknown[]
      const choices = startingChoices(`${b.name}|${b.source}`, blocks, items)
      checkNames(choices)
      expect(waysOf(choices), b.name).toEqual(startingGold(blocks))
      // Taking the default of each gives stacks, with no custom clash on a name.
      const stacks = stacksOf(choices, defaultSelection(choices), items, 'background', [])
      const names = stacks.map((s) => `${s.name}|${s.source}`)
      expect(new Set(names).size, b.name).toBe(names.length)
    }

    expect(unmatched).toEqual([])
  })
})
