import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFTextField } from 'pdf-lib'
import {
  attackLines,
  buildCharacterSheet,
  equipmentLines,
  optionPickLines,
  otherSpeedLines,
  proficiencyLines,
  defenseLines,
  senseLines,
  usesLines,
  walkSpeedText,
  spellStatLines,
} from './characterSheet'
import { deriveSheet } from '../derived'
import { FIGHTER, ITEMS, build, loadedClass, stack } from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'
import { createCharacter } from '../character/model'
import type { LoadedClass } from '../data/class'
import type { DerivedSheet } from '../derived'
import { quantity } from '../derived/types'

function loaded(name: string): LoadedClass {
  return {
    entry: {
      name,
      source: 'PHB',
      hd: { number: 1, faces: 8 },
      proficiency: ['str', 'con'],
      classFeatures: [],
    },
    file: {},
  } as unknown as LoadedClass
}

describe('buildCharacterSheet', () => {
  it('produces a non-empty PDF for a filled character', async () => {
    const c = createCharacter('Tordek')
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
    c.abilities.str = { base: 16, other: 0 }
    c.story.alignment = 'Lawful Good'
    c.story.backstory = 'A dwarf far from home.'
    c.grantPicks = { skill: { athletics: 'class:Fighter|PHB', stealth: 'manual' } }

    const classByKey = new Map([['Fighter|PHB', loaded('Fighter')]])
    const bytes = await buildCharacterSheet(c, { classByKey })

    expect(bytes.byteLength).toBeGreaterThan(1000)
    // PDF header magic.
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('handles an empty character without throwing', async () => {
    const bytes = await buildCharacterSheet(createCharacter('Blank'), {
      classByKey: new Map(),
    })
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })

  it('renders spell slots, wrapped spell lists, and deviations', async () => {
    const fighter: LoadedClass = {
      entry: {
        name: 'Fighter',
        source: 'PHB',
        hd: { number: 1, faces: 10 },
        proficiency: ['str', 'con'],
        classFeatures: [],
      },
      file: {},
    }
    const wizard: LoadedClass = {
      entry: {
        name: 'Wizard',
        source: 'PHB',
        hd: { number: 1, faces: 6 },
        spellcastingAbility: 'int',
        casterProgression: 'full',
        preparedSpells: '<$level$> + <$int_mod$>',
        classFeatures: [],
        // A prerequisite the character will not meet -> a multiclass deviation.
        multiclassing: { requirements: { int: 13 } },
      },
      file: {},
    }

    const warlock: LoadedClass = {
      entry: {
        name: 'Warlock',
        source: 'PHB',
        hd: { number: 1, faces: 8 },
        spellcastingAbility: 'cha',
        casterProgression: 'pact',
        spellsKnownProgression: Array.from({ length: 20 }, () => 2),
        classFeatures: [],
      },
      file: {},
    }

    const c = createCharacter('Elminster')
    c.statMethod = 'pointbuy'
    c.abilities.int = { base: 8, other: 0 }
    c.classes = [
      { name: 'Fighter', source: 'PHB', level: 5 },
      {
        name: 'Wizard',
        source: 'PHB',
        level: 5,
        subclass: { name: 'Evocation', shortName: 'Evocation', source: 'PHB' },
      },
      // A pact caster exercises the Pact-slot line on the sheet.
      { name: 'Warlock', source: 'PHB', level: 3 },
    ]
    // A long spell list forces the wrapped-line path in drawWrapped.
    c.spells['Wizard|PHB'] = {
      cantrips: [{ name: 'Fire Bolt', source: 'PHB', level: 0 }],
      spells: Array.from({ length: 12 }, (_, i) => ({
        name: `Prestidigitation Variant Number ${i + 1}`,
        source: 'PHB',
        level: 1,
      })),
    }

    const classByKey = new Map([
      ['Fighter|PHB', fighter],
      ['Wizard|PHB', wizard],
      ['Warlock|PHB', warlock],
    ])
    const bytes = await buildCharacterSheet(c, { classByKey })
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })

  it('renders race/background fields, standard-only slots, and empty spell lists', async () => {
    const wizard: LoadedClass = {
      entry: {
        name: 'Wizard',
        source: 'PHB',
        hd: { number: 1, faces: 6 },
        spellcastingAbility: 'int',
        casterProgression: 'full',
        preparedSpells: '<$level$> + <$int_mod$>',
        classFeatures: [],
      },
      file: {},
    }

    const c = createCharacter('Mordenkainen')
    c.classes = [{ name: 'Wizard', source: 'PHB', level: 3 }]
    // A named race and background fill the id fields instead of blanks.
    c.race = {
      name: 'Elf (High)',
      baseName: 'Elf',
      subraceName: 'High',
      source: 'PHB',
      abilityFixed: {},
      abilityChoices: {},
    }
    c.background = { name: 'Sage', source: 'PHB', abilityChoices: {} }
    // A caster with no picks -> the cantrip/spell lines fall back to em-dashes,
    // and a full caster with no warlock -> standard slots with no pact line.
    c.spells['Wizard|PHB'] = { cantrips: [], spells: [] }

    const classByKey = new Map([['Wizard|PHB', wizard]])
    const bytes = await buildCharacterSheet(c, { classByKey })
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })
})

describe('equipmentLines', () => {
  const rope = makeItem({ name: 'Rope', weight: 10 })
  const ring = makeItem({ name: 'Ring of Mystery', source: 'DMG' })
  const withItems = () => {
    const c = createCharacter('Tordek')
    c.equipment.items = [
      { name: 'Rope', source: 'PHB', quantity: 2 },
      {
        name: 'Ring of Mystery',
        source: 'DMG',
        quantity: 1,
        equipped: true,
        attuned: true,
      },
    ]
    c.equipment.currency.gp = 100
    return c
  }

  it('marks quantity, equipped and attuned, and weighs the carried load', () => {
    const lines = equipmentLines(withItems(), [rope, ring], 10)
    expect(lines.items).toBe('Rope ×2, Ring of Mystery ×1 (equipped) (attuned)')
    // 2 ropes of 10 lb and 100 coins at 50 to the pound; the ring has no weight listed.
    expect(lines.carried).toBe('Carried 22 of 150 lb; 1 item has no listed weight')
  })

  it('leaves out the capacity without a Strength and counts several unlisted items', () => {
    const c = withItems()
    c.equipment.items.push({ name: 'Gem', source: 'Custom', quantity: 1 })
    expect(equipmentLines(c, [rope, ring], 0).carried).toBe(
      'Carried 22 lb; 2 items have no listed weight',
    )
  })

  it('writes the items alone when there is no catalog, and a dash for none', () => {
    expect(equipmentLines(withItems(), undefined, 10).carried).toBeUndefined()
    expect(equipmentLines(createCharacter('Blank'), undefined, 10).items).toBe('-')
  })

  it('builds a sheet with the inventory weighed', async () => {
    const bytes = await buildCharacterSheet(withItems(), {
      classByKey: new Map(),
      items: [rope, ring],
    })
    expect(bytes.byteLength).toBeGreaterThan(1000)
  })
})

describe('combat numbers on the sheet', () => {
  const deps = () => ({
    classByKey: new Map([[FIGHTER.entry.name + '|PHB', FIGHTER]]),
    items: ITEMS,
  })
  const armed = () =>
    build('Fighter', 1, { str: 16, dex: 14 }, [
      stack('Chain Mail'),
      stack('Longsword'),
      stack('Shield'),
    ])

  it('writes the derived armor class in the Armor Class field', async () => {
    const bytes = await buildCharacterSheet(armed(), deps())
    const fields = (await PDFDocument.load(bytes))
      .getForm()
      .getFields()
      .filter((f): f is PDFTextField => f instanceof PDFTextField)
      .map((f) => f.getText())
    // Chain mail 16 + shield 2.
    expect(fields).toContain('18')
    // The Speed field has the derived walking speed.
    expect(fields).toContain(walkSpeedText(deriveSheet(armed(), deps())))
  })

  it('lists each attack with its bonus and damage', () => {
    const lines = attackLines(deriveSheet(armed(), deps()))
    expect(lines).toContain('Longsword +5, 1d8 + 3 slashing (1d10 + 3 with two hands)')
    expect(lines).toContain('Unarmed strike +5, 4 bludgeoning')
  })

  it('lists the proficiencies by kind', () => {
    const lines = proficiencyLines(deriveSheet(armed(), deps()))
    expect(lines).toContain('Armor: Light armor, Medium armor, Heavy armor, Shields')
    expect(lines.find((l) => l.startsWith('Weapons:'))).toContain('Simple weapons')
  })

  it('lists the spell save DC and attack bonus of each caster', () => {
    const wizard = loadedClass('Wizard', [], [])
    wizard.entry.spellcastingAbility = 'int'
    wizard.entry.casterProgression = 'full'
    const c = build('Wizard', 1, { int: 16 }, [])
    const lines = spellStatLines(
      deriveSheet(c, { classByKey: new Map([['Wizard|PHB', wizard]]) }),
    )
    expect(lines).toEqual(['Wizard: spell save DC 13, spell attack +5'])
  })
})

describe('derived values on the sheet, as the sheet derives them', () => {
  const q = (n: number) =>
    quantity([
      {
        id: 'x',
        label: 'x',
        source: { kind: 'base', tag: 'base', label: '' },
        op: 'add',
        amount: n,
        status: 'applied',
      },
    ])
  const derived = {
    speed: q(25),
    speeds: [
      { label: 'Fly', speed: q(60), hover: true },
      { label: 'Swim', speed: q(25), hover: false },
      { label: 'Burrow', speed: q(0), hover: false },
    ],
    senses: [
      { label: 'Darkvision', range: q(60) },
      {
        label: 'Truesight',
        range: q(0),
        conditional: { when: 'while raging', range: 30 },
      },
      { label: 'Tremorsense', range: q(0) },
    ],
    defenses: [
      { kind: 'resist', label: 'Fire', held: q(1) },
      { kind: 'resist', label: 'Poison', held: q(1) },
      { kind: 'immune', label: 'Cold', held: q(1) },
      { kind: 'vulnerable', label: 'Radiant', held: q(1) },
      { kind: 'condition', label: 'Charmed', held: q(1) },
      { kind: 'resist', label: 'Slashing', held: q(0), conditional: 'while raging' },
    ],
    resources: [
      {
        label: 'Rage',
        max: 3,
        recharge: 'long',
        shortRegain: 0,
        restores: 'All on a long rest',
      },
      {
        label: 'Channel',
        max: undefined,
        recharge: 'short',
        shortRegain: 0,
        restores: '',
      },
    ],
    classOptions: [
      {
        label: 'Warlock - Invocations',
        picks: ['agonizing blast|phb', 'x|y'],
        chips: [{ value: 'agonizing blast|phb', label: 'Agonizing Blast' }],
      },
      { label: 'Fighter - Mastery', picks: [], chips: [] },
    ],
  } as unknown as DerivedSheet

  it('writes the walking speed with its changes, and the other speeds beside it', () => {
    expect(walkSpeedText(derived)).toBe('25 ft.')
    expect(otherSpeedLines(derived)).toEqual(['Fly 60 ft. (hover)', 'Swim 25 ft.'])
  })

  it('lists the senses in force and those a condition would give', () => {
    expect(senseLines(derived)).toEqual([
      'Darkvision 60 ft.',
      'Truesight 30 ft. (while raging)',
    ])
  })

  it('lists the defenses by kind, a conditional one with its condition', () => {
    expect(defenseLines(derived)).toEqual([
      'Resistance: Fire, Poison, Slashing (while raging)',
      'Immunity: Cold',
      'Vulnerability: Radiant',
      'Condition immunity: Charmed',
    ])
  })

  it('lists the limited uses with what restores them', () => {
    expect(usesLines(derived)).toEqual([
      'Rage: 3 uses, Long rest',
      'Channel: unlimited uses, Short or long rest',
    ])
  })

  it('lists the options picked, by the name the card shows', () => {
    expect(optionPickLines(derived)).toEqual([
      'Warlock - Invocations: Agonizing Blast, x|y',
    ])
  })

  it('writes the derived walking speed, and the weapon mastery of an attack', () => {
    const sheet = deriveSheet(
      build('Fighter', 1, { str: 10, dex: 10 }, [stack('Chain Mail')]),
      {
        classByKey: new Map([[FIGHTER.entry.name + '|PHB', FIGHTER]]),
        items: ITEMS,
      },
    )
    // The sheet writes the value the derived sheet has, whatever changed it.
    expect(walkSpeedText(sheet)).toBe(`${sheet.speed.value} ft.`)
    const mastered = {
      ...sheet,
      attacks: [{ ...sheet.attacks[0], mastery: { name: 'Sap', rule: '' } }],
    }
    expect(attackLines(mastered)[0]).toMatch(/; Mastery: Sap$/)
  })
})
