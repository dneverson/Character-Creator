import { describe, expect, it } from 'vitest'
import {
  checkLevelCap,
  checkMulticlass,
  checkOriginIncreases,
  meetsRequirements,
} from './compliance'
import type { AbilityTotals, ClassEntryScores } from './compliance'
import { createCharacter, type Character, type ClassRef } from '../character/model'
import type { PlayableBackground } from '../data/background'
import type { PlayableRace } from '../data/race'
import type { AbilityKey } from '../dice/dice'
import type { MulticlassRequirements } from '../data/class'
import { dataDir, records } from '../test/dataAudit'
import { stripTags } from '../text/tags'
import { readFileSync } from 'node:fs'

const totals = (over: Partial<AbilityTotals> = {}): AbilityTotals => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  ...over,
})

describe('meetsRequirements', () => {
  it('passes when direct minimums are met', () => {
    expect(meetsRequirements({ str: 13 }, totals({ str: 15 }))).toBe(true)
    expect(meetsRequirements({ str: 13 }, totals({ str: 12 }))).toBe(false)
  })
  it('handles "or" branches', () => {
    const req: MulticlassRequirements = { or: [{ str: 13 }, { dex: 13 }] }
    expect(meetsRequirements(req, totals({ dex: 13 }))).toBe(true)
    expect(meetsRequirements(req, totals())).toBe(false)
  })
  it('treats undefined requirements as met', () => {
    expect(meetsRequirements(undefined, totals())).toBe(true)
  })
})

/** The same scores at each class's entry, the classes taken at character levels 1 to 4. */
const same = (t: AbilityTotals): ClassEntryScores[] =>
  [1, 2, 3, 4].map((characterLevel) => ({ characterLevel, totals: t }))

describe('checkMulticlass', () => {
  const classes: ClassRef[] = [
    { name: 'Barbarian', source: 'PHB', level: 1 },
    { name: 'Wizard', source: 'PHB', level: 1 },
  ]
  const reqs = new Map<string, MulticlassRequirements | undefined>([
    ['Barbarian|PHB', { str: 13 }],
    ['Wizard|PHB', { int: 13 }],
  ])

  it('flags each unmet requirement but never for a single class', () => {
    expect(checkMulticlass([classes[0]], reqs, same(totals()))).toEqual([])
    const devs = checkMulticlass(classes, reqs, same(totals({ str: 15 })))
    // STR met, INT not.
    expect(devs).toHaveLength(1)
    expect(devs[0].category).toBe('multiclass-req')
    expect(devs[0].message).toContain('Wizard')
  })

  it('no deviations when all requirements met', () => {
    expect(checkMulticlass(classes, reqs, same(totals({ str: 15, int: 15 })))).toEqual([])
  })

  it('describes an unmet "or"-branched requirement in the message', () => {
    const orReqs = new Map<string, MulticlassRequirements | undefined>([
      ['Fighter|PHB', { or: [{ str: 13 }, { dex: 13 }] }],
      ['Wizard|PHB', { int: 13 }],
    ])
    const orClasses: ClassRef[] = [
      { name: 'Fighter', source: 'PHB', level: 1 },
      { name: 'Wizard', source: 'PHB', level: 1 },
    ]
    const devs = checkMulticlass(orClasses, orReqs, same(totals({ int: 15 })))
    // Fighter's STR-or-DEX prerequisite is unmet and must be spelled out.
    expect(devs).toHaveLength(1)
    expect(devs[0].message).toContain('Strength 13 or Dexterity 13')
  })

  it('names the class, the ability, the score needed and the score had', () => {
    const devs = checkMulticlass(classes, reqs, same(totals({ str: 15, int: 12 })))
    expect(devs.map((d) => d.message)).toEqual([
      'Wizard needs Intelligence 13 to multiclass, you have 12 at character level 2 - allowed with DM approval.',
    ])
  })

  it('says an unassigned ability is not set yet rather than short', () => {
    const devs = checkMulticlass(
      classes,
      reqs,
      same(totals({ int: 1 })),
      new Set(['str', 'int']),
    )
    expect(devs.map((d) => d.message)).toEqual([
      'Barbarian needs Strength 13 to multiclass, Strength is not set yet - allowed with DM approval.',
      'Wizard needs Intelligence 13 to multiclass, Intelligence is not set yet - allowed with DM approval.',
    ])
    // An unassigned ability never counts as met, whatever its bonuses add up to.
    expect(
      checkMulticlass(
        classes,
        reqs,
        same(totals({ str: 15, int: 15 })),
        new Set(['int']),
      ),
    ).toHaveLength(1)
    // An unassigned ability a requirement does not name raises nothing.
    expect(
      checkMulticlass(
        classes,
        reqs,
        same(totals({ str: 15, int: 15 })),
        new Set(['cha']),
      ),
    ).toEqual([])
  })

  it('checks each class against the scores it was taken with, not later ones', () => {
    const three: ClassRef[] = [...classes, { name: 'Druid', source: 'PHB', level: 1 }]
    const reqs3 = new Map(reqs).set('Druid|PHB', { wis: 13 })
    const entries: ClassEntryScores[] = [
      { characterLevel: 1, totals: totals({ str: 12 }) },
      { characterLevel: 2, totals: totals({ str: 13, int: 12, wis: 13 }) },
      { characterLevel: 3, totals: totals({ str: 13, int: 14, wis: 12 }) },
    ]
    expect(checkMulticlass(three, reqs3, entries).map((d) => d.message)).toEqual([
      // Wizard's later Intelligence 14 does not count.
      'Wizard needs Intelligence 13 to multiclass, you have 12 at character level 2 - allowed with DM approval.',
      'Druid needs Wisdom 13 to multiclass, you have 12 at character level 3 - allowed with DM approval.',
    ])
    // The first class is checked when the second is taken, not at character level 1.
    entries[1] = { characterLevel: 2, totals: totals({ str: 12, int: 13, wis: 13 }) }
    entries[2] = { characterLevel: 3, totals: totals({ str: 13, int: 13, wis: 13 }) }
    expect(checkMulticlass(three, reqs3, entries).map((d) => d.message)).toEqual([
      'Barbarian needs Strength 13 to multiclass, you have 12 at character level 2 - allowed with DM approval.',
    ])
  })

  describe('2024 primary abilities', () => {
    // As multiclassRequirements reads the 2024 Fighter, Monk and Bard.
    const reqs2024 = new Map<string, MulticlassRequirements | undefined>([
      ['Fighter|XPHB', { or: [{ str: 13 }, { dex: 13 }] }],
      ['Monk|XPHB', { dex: 13, wis: 13 }],
      ['Bard|XPHB', { cha: 13 }],
      ['Druid|PHB', { wis: 13 }],
    ])
    const ref = (key: string): ClassRef => {
      const [name, source] = key.split('|')
      return { name, source, level: 1 }
    }
    const check = (
      keys: string[],
      over: Partial<AbilityTotals>,
      unset?: Set<AbilityKey>,
    ) =>
      checkMulticlass(keys.map(ref), reqs2024, same(totals(over)), unset).map(
        (d) => d.message,
      )

    it('takes either of the Fighter primary abilities', () => {
      expect(check(['Fighter|XPHB', 'Monk|XPHB'], { str: 13, dex: 13, wis: 13 })).toEqual(
        [],
      )
      expect(check(['Fighter|XPHB', 'Bard|XPHB'], { dex: 14, cha: 13 })).toEqual([])
      expect(check(['Fighter|XPHB', 'Bard|XPHB'], { dex: 12, cha: 13 })).toEqual([
        'Fighter needs Strength 13 or Dexterity 13 to multiclass, you have Strength 10 and Dexterity 12 at character level 2 - allowed with DM approval.',
      ])
    })

    it('needs both Monk primary abilities', () => {
      expect(check(['Monk|XPHB', 'Bard|XPHB'], { dex: 15, wis: 12, cha: 13 })).toEqual([
        'Monk needs Dexterity 13 and Wisdom 13 to multiclass, you have Wisdom 12 at character level 2 - allowed with DM approval.',
      ])
      expect(
        check(
          ['Monk|XPHB', 'Bard|XPHB'],
          { dex: 12, cha: 13 },
          new Set<AbilityKey>(['wis']),
        ),
      ).toEqual([
        'Monk needs Dexterity 13 and Wisdom 13 to multiclass, you have Dexterity 12 at character level 2; Wisdom is not set yet - allowed with DM approval.',
      ])
    })

    it('checks every class of mixed editions, in either order', () => {
      const flagged =
        'Bard needs Charisma 13 to multiclass, you have 12 at character level 2 - allowed with DM approval.'
      for (const keys of [
        ['Druid|PHB', 'Bard|XPHB'],
        ['Bard|XPHB', 'Druid|PHB'],
      ]) {
        expect(check(keys, { wis: 13, cha: 12 })).toEqual([flagged])
        expect(check(keys, { wis: 13, cha: 13 })).toEqual([])
        expect(check(keys, { wis: 12, cha: 13 })).toEqual([
          'Druid needs Wisdom 13 to multiclass, you have 12 at character level 2 - allowed with DM approval.',
        ])
      }
    })
  })
})

describe.skipIf(!dataDir)('multiclass entry against the data', () => {
  const text = (file: string) =>
    stripTags(readFileSync(`${dataDir ?? ''}/${file}`, 'utf8')).replace(/\s+/g, ' ')

  it('checks the current and the new class when a new class is taken, in both editions', () => {
    expect(text('variantrules.json')).toContain(
      'To qualify for a new class, you must meet the ability score prerequisites for both your current class and your new one',
    )
    expect(text('generated/gendata-variantrules.json')).toContain(
      'To qualify for a new class, you must have a score of at least 13 in the primary ability of the new class and your current classes',
    )
  })

  it('gives no Ability Score Improvement at class level 1, so none counts at entry', () => {
    const asis = records(dataDir ?? '').filter(
      ({ collection, record }) =>
        collection === 'classFeature' &&
        (record.name === 'Ability Score Improvement' || record.name === 'Epic Boon'),
    )
    expect(asis.length).toBeGreaterThan(20)
    expect(
      asis.filter(({ record }) => Number(record.level) < 2).map(({ record }) => record),
    ).toEqual([])
  })
})

describe('checkLevelCap', () => {
  it('flags totals above 20 only', () => {
    expect(checkLevelCap(20)).toEqual([])
    expect(checkLevelCap(21)).toHaveLength(1)
    expect(checkLevelCap(60)[0].message).toContain('60')
  })
})

describe('checkOriginIncreases', () => {
  const dwarf: PlayableRace = {
    key: 'hill dwarf|phb',
    name: 'Hill Dwarf',
    baseName: 'Dwarf',
    subraceName: 'Hill',
    source: 'PHB',
    speed: 25,
    abilityOptions: [{ fixed: { con: 2, wis: 1 }, amounts: [], from: [] }],
    featGrants: [],
  }
  const halfElf: PlayableRace = {
    ...dwarf,
    key: 'half-elf|phb',
    name: 'Half-Elf',
    baseName: 'Half-Elf',
    subraceName: undefined,
    abilityOptions: [
      {
        fixed: { cha: 2 },
        amounts: [1, 1],
        from: ['str', 'dex', 'con', 'int', 'wis'],
      },
    ],
  }
  const human2024: PlayableRace = {
    ...dwarf,
    key: 'human|xphb',
    name: 'Human',
    baseName: 'Human',
    subraceName: undefined,
    source: 'XPHB',
    edition: 'one',
    abilityOptions: [],
  }
  const background = (
    name: string,
    edition: 'classic' | 'one',
    abilityOptions: PlayableBackground['abilityOptions'],
  ): PlayableBackground => ({
    key: `${name.toLowerCase()}|x`,
    name,
    source: edition === 'one' ? 'XPHB' : 'PHB',
    edition,
    abilityOptions,
    featGrants: [],
    storyTables: [],
    entries: [],
  })
  const from: AbilityKey[] = ['int', 'wis', 'cha']
  const sage = background('Sage', 'one', [
    { fixed: {}, amounts: [2, 1], from },
    { fixed: {}, amounts: [1, 1, 1], from },
  ])
  const soldier = background('Soldier', 'classic', [])
  const character = (
    race?: Partial<Character['race']>,
    bg?: Partial<NonNullable<Character['background']>>,
    bases: Partial<Record<AbilityKey, number>> = {},
  ): Character => {
    const c = createCharacter('Test')
    for (const [k, base] of Object.entries(bases))
      c.abilities = { ...c.abilities, [k]: { base, other: 0 } }
    if (race)
      c.race = {
        name: 'Hill Dwarf',
        baseName: 'Dwarf',
        source: 'PHB',
        abilityFixed: {},
        abilityChoices: {},
        ...race,
      }
    if (bg) c.background = { name: 'Sage', source: 'XPHB', abilityChoices: {}, ...bg }
    return c
  }

  it('passes the increases a race gives outright', () => {
    const c = character({ abilityFixed: { con: 2, wis: 1 } })
    expect(checkOriginIncreases(c, dwarf, undefined)).toEqual([])
  })

  it('flags a fixed increase the race does not give, naming both, and the abilities', () => {
    const c = character({ abilityFixed: { con: 2, str: 1 } })
    expect(checkOriginIncreases(c, dwarf, undefined)).toEqual([
      {
        id: 'origin-increase:race',
        category: 'origin-increase',
        message:
          'Hill Dwarf allows +2 Constitution, +1 Wisdom; you entered +1 Strength, +2 Constitution - allowed with DM approval.',
        abilities: ['str', 'wis'],
      },
    ])
  })

  it('flags a placed increase on an ability the choice does not offer', () => {
    const ok = character({ abilityFixed: { cha: 2 }, abilityChoices: { str: 1, dex: 1 } })
    expect(checkOriginIncreases(ok, halfElf, undefined)).toEqual([])
    const off = character({
      abilityFixed: { cha: 2 },
      abilityChoices: { cha: 1, dex: 1 },
    })
    const [flag] = checkOriginIncreases(off, halfElf, undefined)
    expect(flag.abilities).toEqual(['cha'])
    expect(flag.message).toContain(
      'Half-Elf allows +2 Charisma, +1 to two other ability scores; you entered +1 Dexterity, +3 Charisma',
    )
  })

  it('flags increases on a 2024 species and a 2014 background, which give none', () => {
    const c = character({ abilityChoices: { str: 1 } }, { abilityChoices: { dex: 2 } })
    const flags = checkOriginIncreases(c, human2024, soldier)
    expect(flags.map((d) => d.message)).toEqual([
      'Human gives no ability score increases; you entered +1 Strength - allowed with DM approval.',
      'Soldier gives no ability score increases; you entered +2 Dexterity - allowed with DM approval.',
    ])
  })

  it('passes the 2024 background +2/+1 and +1/+1/+1, and flags other amounts', () => {
    const twoOne = character(undefined, {
      abilityOption: 0,
      abilityChoices: { int: 2, wis: 1 },
    })
    expect(checkOriginIncreases(twoOne, undefined, sage)).toEqual([])
    const ones = character(undefined, {
      abilityOption: 1,
      abilityChoices: { int: 1, wis: 1, cha: 1 },
    })
    expect(checkOriginIncreases(ones, undefined, sage)).toEqual([])
    const twoTwo = character(undefined, {
      abilityOption: 0,
      abilityChoices: { int: 2, wis: 2 },
    })
    expect(checkOriginIncreases(twoTwo, undefined, sage)[0]).toMatchObject({
      id: 'origin-increase:background',
      abilities: ['wis'],
    })
    const offList = character(undefined, { abilityChoices: { str: 2, wis: 1 } })
    expect(checkOriginIncreases(offList, undefined, sage)[0].message).toBe(
      'Sage allows +2 to Intelligence or Wisdom or Charisma and +1 to another; you entered +2 Strength, +1 Wisdom - allowed with DM approval.',
    )
  })

  it('flags a 2024 background increase that raises a score above 20', () => {
    const c = character(
      undefined,
      { abilityChoices: { int: 2, wis: 1 } },
      { int: 19, wis: 15 },
    )
    expect(checkOriginIncreases(c, undefined, sage)).toEqual([
      {
        id: 'ability-cap:background',
        category: 'ability-cap',
        message:
          "Sage's increases cannot raise a score above 20; Intelligence would be 21 (19 +2) - allowed with DM approval.",
        abilities: ['int'],
      },
    ])
    const at20 = character(undefined, { abilityChoices: { int: 2, wis: 1 } }, { int: 18 })
    expect(checkOriginIncreases(at20, undefined, sage)).toEqual([])
  })

  it('has nothing to check without the species or background data', () => {
    const c = character({ abilityChoices: { str: 1 } }, { abilityChoices: { dex: 2 } })
    expect(checkOriginIncreases(c, undefined, undefined)).toEqual([])
  })
})
