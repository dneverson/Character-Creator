import { describe, expect, it } from 'vitest'
import {
  armorClassOf,
  attachedSpellsOf,
  attunementOf,
  bonusesOf,
  categoryOf,
  chargesOf,
  chargesText,
  containerOf,
  damageTypesOf,
  diceText,
  kindOf,
  parseDice,
  parseRange,
  rangeLabel,
  rechargeText,
  signed,
  speedChangeOf,
  strengthOf,
  traitsOf,
  vehicleOf,
} from './itemText'

describe('parseDice', () => {
  it('reads a die with its average', () => {
    expect(parseDice('1d8')).toEqual({ text: '1d8', average: 4.5 })
    expect(parseDice('2d6 + 3')).toEqual({ text: '2d6 + 3', average: 10 })
    expect(parseDice('1d4 - 1')).toEqual({ text: '1d4 - 1', average: 1.5 })
    expect(parseDice(5)).toEqual({ text: '5', average: 5 })
  })

  it('strips the dice tag the data wraps rolls in', () => {
    expect(diceText('{@dice 1d6 + 4}')).toBe('1d6 + 4')
    expect(parseDice('{@dice 1d6 + 4}')?.average).toBe(7.5)
  })

  it('has nothing for text that is no roll', () => {
    expect(parseDice('lots')).toBeUndefined()
    expect(parseDice(undefined)).toBeUndefined()
  })
})

describe('parseRange', () => {
  it('reads normal and long range', () => {
    expect(parseRange('120/360')).toEqual({ normal: 120, long: 360 })
    expect(parseRange('30')).toEqual({ normal: 30 })
    expect(rangeLabel({ normal: 120, long: 360 })).toBe('120/360 ft.')
    expect(rangeLabel({ normal: 30 })).toBe('30 ft.')
  })

  it('has nothing for no range', () => {
    expect(parseRange(undefined)).toBeUndefined()
    expect(parseRange('far')).toBeUndefined()
  })
})

describe('bonuses', () => {
  it('signs a bonus', () => {
    expect(signed('+1')).toBe('+1')
    expect(signed('2')).toBe('+2')
    expect(signed(3)).toBe('+3')
    expect(signed(-1)).toBe('-1')
    expect(signed('')).toBeUndefined()
    expect(signed(undefined)).toBeUndefined()
  })

  it('says what each bonus applies to', () => {
    expect(
      bonusesOf({ bonusWeapon: '+1', bonusAc: '+2', bonusSpellSaveDc: '+1' }),
    ).toEqual([
      { what: 'weapon attack and damage', value: '+1' },
      { what: 'AC', value: '+2' },
      { what: 'spell save DC', value: '+1' },
    ])
    expect(bonusesOf({})).toEqual([])
  })
})

describe('strengthOf', () => {
  it('reads the number the data keeps as text', () => {
    expect(strengthOf('15')).toBe(15)
    expect(strengthOf(13)).toBe(13)
    expect(strengthOf('-')).toBeUndefined()
    expect(strengthOf(undefined)).toBeUndefined()
  })
})

describe('attunementOf', () => {
  it('has nothing for an item that needs none', () => {
    expect(attunementOf(undefined, undefined)).toBeUndefined()
    expect(attunementOf(false, undefined)).toBeUndefined()
  })

  it('knows required, optional and restricted attunement', () => {
    expect(attunementOf(true, undefined)).toEqual({
      required: true,
      optional: false,
      text: undefined,
      classes: [],
    })
    expect(attunementOf('optional', undefined)).toMatchObject({
      required: false,
      optional: true,
    })
    expect(
      attunementOf('by a cleric or paladin', [{ class: 'cleric' }, { class: 'paladin' }]),
    ).toEqual({
      required: true,
      optional: false,
      text: 'by a cleric or paladin',
      classes: ['cleric', 'paladin'],
    })
    expect(
      attunementOf('by an artificer', [{ class: 'artificer|tce' }, { race: 'elf' }])
        ?.classes,
    ).toEqual(['artificer'])
  })
})

describe('attachedSpellsOf', () => {
  it('reads a plain list', () => {
    expect(attachedSpellsOf(["bigby's hand#9", 'fireball'])).toEqual([
      { name: "Bigby's Hand", how: '' },
      { name: 'Fireball', how: '' },
    ])
  })

  it('says how each spell is cast', () => {
    const spells = attachedSpellsOf({
      charges: { '3': ['reverse gravity'] },
      daily: { '1e': ['animate objects'], '2': ['fireball'] },
      will: ['mage hand'],
      ritual: ['detect magic'],
      rest: { '1e': ['meld into stone'] },
      limited: { '6': ['arcane lock|xphb'] },
      other: ['teleport'],
      ability: 'int',
    })
    expect(spells.map((s) => `${s.name}: ${s.how}`)).toEqual([
      'Reverse Gravity: 3 charges',
      'Fireball: 2 per day',
      'Animate Objects: 1 per day each',
      'Mage Hand: at will',
      'Detect Magic: as a ritual',
      'Meld Into Stone: 1 per rest each',
      'Arcane Lock: 6 uses',
      'Teleport: ',
    ])
  })

  it('has nothing without spells', () => {
    expect(attachedSpellsOf(undefined)).toEqual([])
  })
})

describe('charges', () => {
  it('reads how many, when they return and how many return', () => {
    const charges = chargesOf({
      charges: 7,
      recharge: 'dawn',
      rechargeAmount: '{@dice 1d6 + 4}',
    })
    expect(charges).toEqual({ max: '7', recharge: 'at dawn', amount: '1d6 + 4' })
    expect(chargesText(charges!)).toBe('7, regains 1d6 + 4 at dawn')
    expect(chargesText({ max: '3' })).toBe('3')
    expect(chargesOf({ charges: '{@dice 1d6 + 1}', rechargeAmount: 5 })).toEqual({
      max: '1d6 + 1',
      recharge: undefined,
      amount: '5',
    })
    expect(chargesOf({})).toBeUndefined()
  })

  it('decodes every recharge word and keeps one it does not know', () => {
    expect(rechargeText('restLong')).toBe('after a long rest')
    expect(rechargeText('special')).toBe('as the item describes')
    expect(rechargeText('sundown')).toBe('sundown')
    expect(rechargeText(undefined)).toBeUndefined()
  })
})

describe('containerOf', () => {
  it('reads what a container holds', () => {
    expect(containerOf({ weight: [500], weightless: true })).toEqual({
      weight: 500,
      weightless: true,
    })
    expect(containerOf({ weight: [30] })).toEqual({ weight: 30, weightless: false })
    expect(containerOf(undefined)).toBeUndefined()
    expect(containerOf({ items: [] })).toBeUndefined()
  })
})

describe('kind and category', () => {
  it('reads the kind from the type code, then the flags, then the damage', () => {
    expect(kindOf({ type: 'M|XPHB' })).toBe('weapon')
    expect(kindOf({ type: 'HA' })).toBe('armor')
    expect(kindOf({ type: '$C' })).toBe('coin')
    expect(kindOf({ staff: true })).toBe('staff')
    expect(kindOf({ wondrous: true })).toBe('wondrous')
    expect(kindOf({ dmg1: '1d6' })).toBe('weapon')
    expect(kindOf({})).toBe('other')
  })

  it('names the armor class of a type', () => {
    expect(armorClassOf('MA')).toBe('medium')
    expect(armorClassOf('S')).toBe('shield')
    expect(armorClassOf('G')).toBeUndefined()
    expect(armorClassOf(undefined)).toBeUndefined()
  })

  it('writes the category in words', () => {
    expect(
      categoryOf('weapon', { weaponCategory: 'martial' }, 'Melee Weapon', true),
    ).toBe('Martial melee weapon')
    expect(categoryOf('weapon', { weaponCategory: 'simple' }, undefined, false)).toBe(
      'Simple ranged weapon',
    )
    expect(categoryOf('weapon', {}, undefined, true)).toBe('Melee weapon')
    expect(categoryOf('armor', {}, 'Heavy Armor', true)).toBe('Heavy Armor')
    expect(categoryOf('gear', {}, 'Adventuring Gear', true)).toBe('Adventuring Gear')
    expect(categoryOf('wondrous', { tattoo: true }, undefined, true)).toBe(
      'Wondrous item (tattoo)',
    )
    expect(categoryOf('staff', {}, undefined, true)).toBe('Staff')
    expect(categoryOf('shield', {}, undefined, true)).toBe('Shield')
  })
})

describe('damageTypesOf', () => {
  it('spells the letter out and keeps one it does not know', () => {
    expect(damageTypesOf('S')).toEqual(['Slashing'])
    expect(damageTypesOf('?')).toEqual(['?'])
    expect(damageTypesOf(undefined)).toEqual([])
  })
})

describe('traitsOf', () => {
  it('has none for a plain item', () => {
    expect(traitsOf({})).toEqual([])
  })

  it('lists what an item resists, is immune to and more', () => {
    const traits = traitsOf({
      resist: ['fire', { resist: ['cold'] }, 7],
      immune: ['poison'],
      vulnerable: ['radiant'],
      conditionImmune: ['charmed', 'frightened'],
      critThreshold: 19,
      light: [{ bright: 20, dim: 40 }],
      grantsLanguage: true,
      grantsProficiency: true,
      curse: true,
      sentient: true,
      poison: true,
      attachedSpells: { ability: 'int', will: ['mage hand'] },
    })
    expect(traits).toEqual([
      'Resistance to fire, cold',
      'Immune to poison',
      'Vulnerable to radiant',
      'Immune to the conditions charmed, frightened',
      'Spellcasting ability: Intelligence',
      'Critical hit on 19-20',
      'Sheds bright light 20 ft., dim light 40 ft. further',
      'Grants a language',
      'Grants a proficiency',
      'Cursed',
      'Sentient',
      'Poison',
    ])
  })

  it('says how an item changes speed', () => {
    expect(
      traitsOf({
        modifySpeed: {
          equal: { fly: 'walk' },
          bonus: { walk: 10 },
          multiply: { walk: 2 },
          static: { fly: 60 },
        },
      }),
    ).toEqual([
      'fly speed equals your walking speed',
      '+10 ft. walking speed',
      'walking speed multiplied by 2',
      'fly speed 60 ft.',
    ])
  })

  it('reads how an item changes speed, keeping only well formed parts', () => {
    expect(
      speedChangeOf({
        static: { walk: 30, fly: 'x' },
        equal: { climb: 'walk', swim: 5 },
        bonus: { '*': 5 },
        multiply: { walk: 2 },
        other: 1,
      }),
    ).toEqual({
      static: { walk: 30 },
      equal: { climb: 'walk' },
      bonus: { '*': 5 },
      multiply: { walk: 2 },
    })
    expect(speedChangeOf({ static: { fly: 'x' }, bonus: 3 })).toBeUndefined()
    expect(speedChangeOf(undefined)).toBeUndefined()
  })

  it('says how an item changes ability scores', () => {
    expect(
      traitsOf({
        ability: {
          static: { con: 19 },
          choose: [{ from: ['int'], count: 1, amount: 2 }],
          str: 2,
        },
      }),
    ).toEqual([
      'Sets your Constitution to 19',
      '+2 to one ability score of your choice',
      '+2 Strength',
    ])
    expect(traitsOf({ ability: { from: ['str', 'dex'], count: 2, amount: 1 } })).toEqual([
      '+1 to 2 ability scores of your choice',
    ])
    expect(traitsOf({ light: [{ bright: 5 }] })).toEqual(['Sheds bright light 5 ft.'])
  })
})

describe('vehicleOf', () => {
  it('reads a vehicle, a ship and a mount', () => {
    expect(
      vehicleOf({
        vehSpeed: 8,
        vehAc: 13,
        vehHp: 300,
        vehDmgThresh: 15,
        crew: 10,
        capCargo: 1,
        capPassenger: 20,
      }),
    ).toEqual({
      speed: '8 mph',
      ac: 13,
      hp: 300,
      damageThreshold: 15,
      crew: '10',
      cargoTons: 1,
      passengers: 20,
      carrying: undefined,
    })
    expect(vehicleOf({ speed: 50, carryingCapacity: 480 })).toMatchObject({
      speed: '50 ft.',
      carrying: 480,
    })
    expect(vehicleOf({ crewMin: 1, crewMax: 3 })?.crew).toBe('1-3')
    expect(vehicleOf({ weight: 3 })).toBeUndefined()
  })
})
