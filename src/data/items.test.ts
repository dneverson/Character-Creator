import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadItems, _clearItemCache, rarityLabel, goldLabel, costLabel } from './items'
import { fetchData } from './dataClient'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))
const mockFetch = vi.mocked(fetchData)

beforeEach(() => {
  _clearItemCache()
  mockFetch.mockReset()
})

describe('loadItems', () => {
  it('merges base + magic items, normalizes, and sorts by name', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === 'items-base.json') {
        return Promise.resolve({
          baseitem: [
            { name: 'Longsword', source: 'PHB', type: 'M|PHB', weight: 3, value: 1500 },
          ],
        })
      }
      return Promise.resolve({
        item: [{ name: 'Amulet', source: 'DMG', rarity: 'rare' }],
      })
    })

    const items = await loadItems()
    expect(items.map((i) => i.name)).toEqual(['Amulet', 'Longsword'])
    const sword = items.find((i) => i.name === 'Longsword')!
    expect(sword.type).toBe('M') // source suffix stripped
    expect(sword.key).toBe('Longsword|PHB')
    expect(sword.entries).toEqual([])
  })

  it('sorts a bonus item by the name after its +N', async () => {
    mockFetch.mockImplementation((path: string) =>
      Promise.resolve(
        path === 'items-base.json'
          ? { baseitem: [{ name: 'Longsword', source: 'PHB', type: 'M|PHB' }] }
          : {
              item: [
                { name: '+1 Zweihander', source: 'DMG', rarity: 'uncommon' },
                { name: '+2 Amulet', source: 'DMG', rarity: 'rare' },
              ],
            },
      ),
    )
    const items = await loadItems()
    expect(items.map((i) => i.name)).toEqual(['+2 Amulet', 'Longsword', '+1 Zweihander'])
  })

  it('drops rarity "none" but keeps real rarities', async () => {
    mockFetch.mockImplementation((path: string) =>
      Promise.resolve(
        path === 'items-base.json'
          ? { baseitem: [{ name: 'Club', source: 'PHB', rarity: 'none' }] }
          : { item: [{ name: 'Wand', source: 'DMG', rarity: 'uncommon' }] },
      ),
    )
    const items = await loadItems()
    expect(items.find((i) => i.name === 'Club')!.rarity).toBeUndefined()
    expect(items.find((i) => i.name === 'Wand')!.rarity).toBe('uncommon')
  })

  it('caches the result across calls', async () => {
    mockFetch.mockResolvedValue({})
    await loadItems()
    await loadItems()
    // The first load fetches the four files (base, magic, variants, books); the second none.
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('carries the name the SRD gives an item when the book names it differently', async () => {
    mockFetch.mockImplementation((path: string) =>
      Promise.resolve(
        path === 'items-base.json'
          ? { baseitem: [{ name: 'Club', source: 'PHB', srd: true }] }
          : {
              item: [
                { name: 'Orb of Dragonkind', source: 'XDMG', srd52: 'Dragon Orb' },
                { name: 'Wand of Web', source: 'DMG', srd: true },
              ],
            },
      ),
    )
    const items = await loadItems()
    expect(items.map((i) => [i.name, i.srdName])).toEqual([
      ['Club', undefined],
      ['Orb of Dragonkind', 'Dragon Orb'],
      ['Wand of Web', undefined],
    ])
  })

  it('handles files missing their arrays', async () => {
    mockFetch.mockResolvedValue({})
    const items = await loadItems()
    expect(items).toEqual([])
  })
})

describe('rarityLabel', () => {
  it('maps known rarities and passes through unknown ones', () => {
    expect(rarityLabel('very rare')).toBe('Very Rare')
    expect(rarityLabel('legendary')).toBe('Legendary')
    expect(rarityLabel('mythic')).toBe('mythic')
    expect(rarityLabel()).toBe('')
  })
})

describe('goldLabel', () => {
  it('formats copper values as gold and dashes when absent', () => {
    expect(goldLabel(1550)).toBe('15.5 gp')
    expect(goldLabel(100)).toBe('1 gp')
    expect(goldLabel(0)).toBe('0 gp')
    expect(goldLabel()).toBe('-')
  })
})

describe('costLabel', () => {
  it('writes a price in the largest coin that keeps it whole', () => {
    expect(costLabel(1500)).toBe('15 gp')
    expect(costLabel(100)).toBe('1 gp')
    expect(costLabel(50)).toBe('5 sp')
    expect(costLabel(25)).toBe('25 cp')
    expect(costLabel(1)).toBe('1 cp')
    expect(costLabel(150)).toBe('15 sp')
    expect(costLabel(0)).toBe('0 cp')
    expect(costLabel()).toBe('-')
  })
})

/** Answer each data file of the loader from a small table. */
function serve(files: Record<string, object>) {
  mockFetch.mockImplementation((path: string) => Promise.resolve(files[path] ?? {}))
}

describe('loadItems, reading an item', () => {
  it('reads a weapon with its damage, versatile die, properties and mastery', async () => {
    serve({
      'items-base.json': {
        baseitem: [
          {
            name: 'Longsword',
            source: 'XPHB',
            type: 'M|XPHB',
            weaponCategory: 'martial',
            dmg1: '1d8',
            dmg2: '1d10',
            dmgType: 'S',
            property: ['V|XPHB'],
            mastery: ['Sap|XPHB'],
            weight: 3,
            value: 1500,
            sword: true,
            srd52: true,
          },
          {
            name: 'Shortbow',
            source: 'PHB',
            type: 'R',
            weaponCategory: 'simple',
            dmg1: '1d6',
            dmgType: 'P',
            range: '80/320',
            property: ['A', 'T|XPHB'],
            ammoType: 'arrow|phb',
          },
        ],
        itemType: [{ abbreviation: 'M', name: 'Melee Weapon', source: 'XPHB' }],
        itemProperty: [
          {
            abbreviation: 'V',
            source: 'XPHB',
            template: '{{prop_name}} ({{item.dmg2}})',
            entries: [
              {
                type: 'entries',
                name: 'Versatile',
                entries: ['Two hands: {@dice 1d10}.'],
              },
            ],
          },
          {
            abbreviation: 'A',
            source: 'PHB',
            template: '{{prop_name_lower}} ({{item.range}} ft.)',
            entries: [
              { type: 'entries', name: 'Ammunition', entries: ['Needs ammunition.'] },
            ],
          },
        ],
        itemMastery: [
          { name: 'Sap', source: 'XPHB', entries: ['Disadvantage on next attack.'] },
        ],
      },
    })
    const items = await loadItems()
    const sword = items.find((i) => i.name === 'Longsword')!
    expect(sword.kind).toBe('weapon')
    expect(sword.category).toBe('Martial melee weapon')
    expect(sword.weapon).toMatchObject({
      category: 'martial',
      melee: true,
      damage: { text: '1d8', average: 4.5 },
      versatile: { text: '1d10', average: 5.5 },
      damageTypes: ['Slashing'],
    })
    expect(sword.weapon?.properties).toEqual([
      {
        code: 'V',
        name: 'Versatile',
        rule: 'Two hands: 1d10.',
        label: 'Versatile (1d10)',
      },
    ])
    expect(sword.weapon?.mastery).toEqual([
      { name: 'Sap', rule: 'Disadvantage on next attack.' },
    ])
    expect(sword.family).toEqual(['sword'])
    expect(sword.free).toBe(true)
    const bow = items.find((i) => i.name === 'Shortbow')!
    expect(bow.category).toBe('Simple ranged weapon')
    expect(bow.weapon?.range).toEqual({ normal: 80, long: 320 })
    expect(bow.weapon?.ammoType).toBe('Arrow')
    // No source on a property means the 2014 Player's Handbook; one it lacks keeps its code.
    expect(bow.weapon?.properties.map((p) => p.label)).toEqual([
      'Ammunition (80/320 ft.)',
      'T',
    ])
    expect(bow.weapon?.mastery).toEqual([])
  })

  it('reads armor, a shield, magic, attunement, charges and spells', async () => {
    serve({
      'items-base.json': {
        baseitem: [
          {
            name: 'Plate Armor',
            source: 'PHB',
            type: 'HA',
            ac: 18,
            strength: '15',
            stealth: true,
          },
          { name: 'Shield', source: 'PHB', type: 'S', ac: 2 },
        ],
      },
      'items.json': {
        item: [
          {
            name: 'Staff of Power',
            source: 'DMG',
            staff: true,
            rarity: 'very rare',
            tier: 'major',
            reqAttune: 'by a sorcerer, warlock, or wizard',
            reqAttuneTags: [
              { class: 'sorcerer' },
              { class: 'warlock' },
              { class: 'wizard' },
            ],
            bonusWeapon: '+2',
            charges: 20,
            recharge: 'dawn',
            rechargeAmount: '{@dice 2d8 + 4}',
            attachedSpells: { charges: { '5': ['fireball'] } },
            containerCapacity: { weight: [500], weightless: true },
            detail1: 'green',
            page: 123,
            entries: ['Power.'],
          },
        ],
      },
    })
    const items = await loadItems()
    expect(items.find((i) => i.name === 'Plate Armor')?.armor).toEqual({
      base: 18,
      bonus: undefined,
      strength: 15,
      stealth: true,
      dexterityMax: undefined,
      class: 'heavy',
    })
    expect(items.find((i) => i.name === 'Shield')?.armor).toMatchObject({
      base: undefined,
      bonus: 2,
      class: 'shield',
    })
    const staff = items.find((i) => i.name === 'Staff of Power')!
    expect(staff).toMatchObject({
      kind: 'staff',
      category: 'Staff',
      magic: true,
      tier: 'major',
      rarity: 'very rare',
      page: 123,
      details: ['green'],
      attunement: {
        required: true,
        text: 'by a sorcerer, warlock, or wizard',
        classes: ['sorcerer', 'warlock', 'wizard'],
      },
      charges: { max: '20', recharge: 'at dawn', amount: '2d8 + 4' },
      spells: [{ name: 'Fireball', how: '5 charges' }],
      container: { weight: 500, weightless: true },
    })
    expect(staff.bonuses).toEqual([{ what: 'weapon attack and damage', value: '+2' }])
  })

  it('treats an item with an unstated rarity as magic only when the data says so', async () => {
    serve({
      'items.json': {
        item: [
          { name: 'Doom', source: 'SCC', rarity: 'unknown' },
          { name: 'Odd Thing', source: 'DMG', rarity: 'unknown (magic)' },
          { name: 'Orb', source: 'DMG', wondrous: true },
        ],
      },
    })
    const items = await loadItems()
    const by = (name: string) => items.find((i) => i.name === name)!
    expect(by('Doom')).toMatchObject({ rarity: 'unknown', magic: false })
    expect(by('Odd Thing')).toMatchObject({ rarity: 'unknown', magic: true })
    expect(by('Orb')).toMatchObject({ rarity: undefined, magic: true, kind: 'wondrous' })
  })

  it('gives an item its edition from the data, else from the date of its book', async () => {
    serve({
      'books.json': {
        book: [
          { source: 'PHB', published: '2014-08-19' },
          { source: 'XDMG', published: '2024-11-12' },
        ],
      },
      'items.json': {
        item: [
          { name: 'Ring A', source: 'PHB' },
          { name: 'Ring B', source: 'XDMG' },
          { name: 'Ring C', source: 'PHB', edition: 'one' },
        ],
      },
    })
    const items = await loadItems()
    expect(items.map((i) => [i.name, i.edition])).toEqual([
      ['Ring A', 'classic'],
      ['Ring B', 'one'],
      ['Ring C', 'one'],
    ])
  })

  it('marks coinage so a table can leave it to the purse', async () => {
    serve({
      'items-base.json': {
        baseitem: [{ name: 'Gold (gp)', source: 'PHB', type: '$C', value: 100 }],
      },
    })
    expect((await loadItems())[0].kind).toBe('coin')
  })
})

describe('loadItems, copies and base items', () => {
  it('lets a copied item inherit from its original and override', async () => {
    serve({
      'items-base.json': {
        baseitem: [
          {
            name: "Alchemist's Fire (flask)",
            source: 'PHB',
            type: 'G',
            weight: 1,
            value: 5000,
          },
        ],
      },
      'items.json': {
        item: [
          {
            name: "Alchemist's Doom",
            source: 'SCC',
            _copy: { name: "Alchemist's Fire (flask)", source: 'PHB' },
            rarity: 'unknown',
            entries: ['Doom.'],
          },
          {
            name: 'Lost Copy',
            source: 'SCC',
            _copy: { name: 'Missing', source: 'PHB' },
            weight: 2,
          },
        ],
      },
    })
    const items = await loadItems()
    const doom = items.find((i) => i.name === "Alchemist's Doom")!
    expect(doom).toMatchObject({ type: 'G', weight: 1, value: 5000, entries: ['Doom.'] })
    expect(items.find((i) => i.name === 'Lost Copy')).toMatchObject({ weight: 2 })
  })

  it('gives a magic weapon that names a base item the numbers of that item', async () => {
    serve({
      'items-base.json': {
        baseitem: [
          {
            name: 'Sickle',
            source: 'PHB',
            type: 'M',
            weight: 2,
            dmg1: '1d4',
            dmgType: 'S',
            weaponCategory: 'simple',
            property: ['L'],
          },
        ],
      },
      'items.json': {
        item: [
          {
            name: '+1 Moon Sickle',
            source: 'PHB',
            baseItem: 'sickle|PHB',
            type: 'M',
            rarity: 'uncommon',
            dmg1: '1d6',
          },
          { name: 'Plain Thing', source: 'PHB', baseItem: 'nothing|PHB' },
        ],
      },
    })
    const items = await loadItems()
    const sickle = items.find((i) => i.name === '+1 Moon Sickle')!
    expect(sickle.weight).toBe(2)
    expect(sickle.weapon).toMatchObject({
      category: 'simple',
      damageTypes: ['Slashing'],
      damage: { text: '1d6' },
    })
    expect(items.find((i) => i.name === 'Plain Thing')?.weight).toBeUndefined()
  })
})

describe('loadItems, twins, groups and packs', () => {
  it('pairs the two editions of an item by reprintedAs, never by name', async () => {
    serve({
      'items-base.json': {
        baseitem: [
          { name: 'Longsword', source: 'PHB', reprintedAs: ['Longsword|XPHB'] },
          { name: 'Longsword', source: 'XPHB' },
          { name: 'Longsword', source: 'HOME' },
          { name: 'Orphan', source: 'PHB', reprintedAs: ['Orphan|XPHB'] },
        ],
      },
      'magicvariants.json': {
        magicvariant: [
          {
            name: '+1 Weapon',
            requires: [{ weapon: true }],
            inherits: { source: 'DMG', reprintedAs: ['+1 Weapon|XDMG'] },
          },
          {
            name: '+1 Weapon',
            requires: [{ weapon: true }],
            inherits: { source: 'XDMG' },
          },
        ],
      },
    })
    const items = await loadItems()
    const twinOf = (key: string) => items.find((i) => i.key === key)?.twin
    expect(twinOf('Longsword|PHB')).toBe('Longsword|XPHB')
    expect(twinOf('Longsword|XPHB')).toBe('Longsword|PHB')
    expect(twinOf('Longsword|HOME')).toBeUndefined()
    expect(twinOf('Orphan|PHB')).toBeUndefined()
    expect(twinOf('+1 Weapon|DMG')).toBe('+1 Weapon|XDMG')
    expect(twinOf('+1 Weapon|XDMG')).toBe('+1 Weapon|DMG')
  })

  it('names the umbrella a member belongs to and ignores members it cannot find', async () => {
    serve({
      'items.json': {
        item: [
          { name: 'Crystal', source: 'PHB' },
          { name: 'Orb', source: 'PHB' },
        ],
        itemGroup: [
          {
            name: 'Arcane Focus',
            source: 'PHB',
            items: ['Crystal|phb', 'Orb', 'Ghost|phb', { odd: 1 }],
          },
          { name: 'Arcane Focus', source: 'PHB', items: ['Crystal|phb'] },
        ],
      },
    })
    const items = await loadItems()
    expect(items.map((i) => [i.name, i.groups])).toEqual([
      ['Crystal', ['Arcane Focus']],
      ['Orb', ['Arcane Focus']],
    ])
  })

  it('resolves the parts of a pack to the items they are', async () => {
    serve({
      'items.json': {
        item: [
          { name: 'Rope', source: 'XPHB' },
          {
            name: "Explorer's Pack",
            source: 'XPHB',
            packContents: [
              'rope|xphb',
              { item: 'torch|xphb', quantity: 10 },
              { item: 'arrow|phb', quantity: 20 },
              { special: 'a letter' },
              7,
            ],
          },
          { name: 'Empty Pack', source: 'XPHB', packContents: [] },
        ],
      },
    })
    const items = await loadItems()
    expect(items.find((i) => i.name === "Explorer's Pack")?.pack).toEqual([
      { key: 'Rope|XPHB', name: 'Rope', quantity: 1 },
      { key: undefined, name: 'Torch', quantity: 10 },
      { key: undefined, name: 'Arrow', quantity: 20 },
    ])
    expect(items.find((i) => i.name === 'Empty Pack')?.pack).toBeUndefined()
  })

  it('adds the generic variants as templates beside the items', async () => {
    serve({
      'items-base.json': {
        baseitem: [{ name: 'Longsword', source: 'PHB', type: 'M', dmg1: '1d8' }],
      },
      'magicvariants.json': {
        magicvariant: [
          {
            name: '+1 Weapon',
            requires: [{ weapon: true }],
            inherits: {
              namePrefix: '+1 ',
              source: 'DMG',
              rarity: 'uncommon',
              bonusWeapon: '+1',
            },
          },
          {
            name: 'All-Seeing Blade',
            source: 'AU',
            _copy: {
              name: 'Blade',
              source: 'AU',
              _mod: { 'inherits.rarity': { mode: 'setProp', value: 'legendary' } },
            },
          },
          {
            name: 'Blade',
            source: 'AU',
            requires: [{ sword: true }],
            inherits: { source: 'AU', rarity: 'rare' },
          },
        ],
      },
    })
    const items = await loadItems()
    expect(items.filter((i) => i.variant).map((i) => [i.key, i.rarity])).toEqual([
      ['All-Seeing Blade|AU', 'legendary'],
      ['Blade|AU', 'rare'],
      // Sorted by the name after the "+1", so after the others.
      ['+1 Weapon|DMG', 'uncommon'],
    ])
    expect(items.find((i) => i.name === 'Longsword')?.variant).toBeUndefined()
  })
})
