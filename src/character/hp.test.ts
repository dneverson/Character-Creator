import { describe, expect, it } from 'vitest'
import {
  averageDie,
  hitDiceGroups,
  hpBreakdown,
  isHillDwarf,
  levelDice,
  rollHitDice,
  type LevelDie,
} from './hp'
import { createCharacter, type Character, type RaceRef } from './model'
import type { LoadedClass } from '../data/class'

function race(baseName: string, subraceName?: string): RaceRef {
  return {
    name: subraceName ? `${baseName} (${subraceName})` : baseName,
    baseName,
    source: 'PHB',
    subraceName,
    abilityFixed: {},
    abilityChoices: {},
  }
}

function loaded(name: string, faces: number): LoadedClass {
  return {
    entry: { name, source: 'PHB', hd: { number: 1, faces }, classFeatures: [] },
    file: {},
  } as unknown as LoadedClass
}

const classByKey = new Map<string, LoadedClass>([
  ['Fighter|PHB', loaded('Fighter', 10)],
  ['Wizard|PHB', loaded('Wizard', 6)],
])

function fighter(level: number, con = 14): Character {
  const c = createCharacter('Test')
  c.classes = [{ name: 'Fighter', source: 'PHB', level }]
  c.abilities = { ...c.abilities, con: { base: con, other: 0 } }
  return c
}

describe('averageDie', () => {
  it('is half the die rounded up', () => {
    expect(averageDie(6)).toBe(4)
    expect(averageDie(8)).toBe(5)
    expect(averageDie(10)).toBe(6)
    expect(averageDie(12)).toBe(7)
  })
})

describe('hpBreakdown', () => {
  it('takes the max die at level 1 plus CON', () => {
    const bd = hpBreakdown(fighter(1), classByKey)
    // 10 (max d10) + 2 (CON +2)
    expect(bd.averageHP).toBe(12)
  })

  it('averages later levels and adds CON each level', () => {
    const bd = hpBreakdown(fighter(3), classByKey)
    // 10 + 6 + 6 dice, CON +2 x3
    expect(bd.averageDiceTotal).toBe(22)
    expect(bd.conTotal).toBe(6)
    expect(bd.averageHP).toBe(28)
  })

  it('applies feat HP (Tough +2 per level) and feat CON increases', () => {
    const tough = hpBreakdown(fighter(3), classByKey, {
      abilityBonus: {},
      slots: [{ feat: { key: 'tough|phb' } }],
    })
    expect(tough.lines.map((l) => [l.label, l.source, l.total])).toEqual([
      ['Tough', 'Feat', 6],
    ])
    expect(tough.perLevelTotal).toBe(6) // +2 x3
    expect(tough.averageHP).toBe(34)

    // Boon of Fortitude style flat HP plus a CON increase that lifts the modifier.
    const boon = hpBreakdown(fighter(3), classByKey, {
      abilityBonus: { con: 2 },
      slots: [{ feat: { key: 'boon of fortitude|xphb' } }],
    })
    expect(boon.lines.map((l) => l.total)).toEqual([40])
    expect(boon.conMod).toBe(3)
    expect(boon.averageHP).toBe(22 + 9 + 40)
  })

  it('uses stored rolls for rolled HP when they cover every level', () => {
    const c = fighter(3)
    c.hp = { ...c.hp, rolls: [10, 4, 5] } // index 0 ignored (max used)
    const bd = hpBreakdown(c, classByKey)
    // 10 (max) + 4 + 5 dice + 6 CON
    expect(bd.rolledHP).toBe(25)
  })

  it('omits rolled HP when rolls are stale', () => {
    const c = fighter(3)
    c.hp = { ...c.hp, rolls: [10, 4] }
    expect(hpBreakdown(c, classByKey).rolledHP).toBeUndefined()
  })

  it('adds the Hill Dwarf +1 and a per-level bonus each level', () => {
    const c = fighter(3)
    c.race = race('Dwarf', 'Hill')
    c.hp = { ...c.hp, perLevelBonus: 3 }
    const bd = hpBreakdown(c, classByKey)
    expect(bd.lines.map((l) => l.label)).toEqual(['Dwarven Toughness'])
    // (+1 Hill Dwarf + 3 per-level bonus) x3 levels.
    expect(bd.perLevelTotal).toBe(12)
  })

  it('ignores class rows with a non-positive level', () => {
    const c = fighter(0)
    // A level-0 class contributes no hit dice.
    expect(levelDice(c, classByKey)).toHaveLength(0)
    expect(hpBreakdown(c, classByKey).averageDiceTotal).toBe(0)
  })

  it('skips a class that is not resolved in the catalog', () => {
    const c = createCharacter('Test')
    // Unknown class -> no hit die -> the row is skipped.
    c.classes = [{ name: 'Homebrewer', source: 'HB', level: 3 }]
    expect(levelDice(c, classByKey)).toHaveLength(0)
    expect(hpBreakdown(c, classByKey).averageDiceTotal).toBe(0)
  })
})

describe('diceLines', () => {
  it('gives one line per class row with the first level separate and rolled totals', () => {
    const c = createCharacter('MC')
    c.classes = [
      { name: 'Fighter', source: 'PHB', level: 2 },
      { name: 'Wizard', source: 'PHB', level: 2 },
    ]
    c.hp = { ...c.hp, rolls: [10, 3, 2, 5] }
    const bd = hpBreakdown(c, classByKey)
    expect(bd.dice).toMatchObject([
      {
        className: 'Fighter',
        fromLevel: 1,
        toLevel: 2,
        hasFirst: true,
        averageTotal: 16,
      },
      { className: 'Wizard', fromLevel: 3, toLevel: 4, hasFirst: false, averageTotal: 8 },
    ])
    expect(bd.dice.map((d) => d.rolledTotal)).toEqual([13, 7])
  })
})

describe('isHillDwarf', () => {
  it('is true only for a Hill Dwarf', () => {
    const c = createCharacter('Test')
    expect(isHillDwarf(c)).toBe(false) // no race
    c.race = race('Elf', 'Wood')
    expect(isHillDwarf(c)).toBe(false) // wrong base
    c.race = race('Dwarf', 'Mountain')
    expect(isHillDwarf(c)).toBe(false) // wrong subrace
    c.race = race('Dwarf', 'Hill')
    expect(isHillDwarf(c)).toBe(true)
  })
})

describe('rollHitDice', () => {
  it('rolls within each die and yields 0 for a zero-faced die', () => {
    const dice: LevelDie[] = [
      { classIndex: 0, faces: 8, isFirst: true },
      { classIndex: 0, faces: 6, isFirst: false },
      { classIndex: 1, faces: 0, isFirst: false },
    ]
    const rolls = rollHitDice(dice)
    expect(rolls).toHaveLength(3)
    expect(rolls[0]).toBeGreaterThanOrEqual(1)
    expect(rolls[0]).toBeLessThanOrEqual(8)
    expect(rolls[1]).toBeGreaterThanOrEqual(1)
    expect(rolls[1]).toBeLessThanOrEqual(6)
    expect(rolls[2]).toBe(0)
  })
})

describe('levelDice / hitDiceGroups', () => {
  it('flags the first level and groups multiclass dice', () => {
    const c = createCharacter('MC')
    c.classes = [
      { name: 'Fighter', source: 'PHB', level: 2 },
      { name: 'Wizard', source: 'PHB', level: 1 },
    ]
    const dice = levelDice(c, classByKey)
    expect(dice[0].isFirst).toBe(true)
    expect(dice.filter((d) => d.isFirst)).toHaveLength(1)
    expect(hitDiceGroups(dice)).toEqual([
      { faces: 10, count: 2 },
      { faces: 6, count: 1 },
    ])
  })
})
