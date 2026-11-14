import { describe, expect, it } from 'vitest'
import { deps as depsOf, loadedClass } from '../test/derivedFixtures'
import { KNIGHT, SEER } from '../test/levelUpFixtures'
import {
  applyLevel,
  canGainLevel,
  levelUpSteps,
  newClassFlags,
  setLevelRoll,
  targetKey,
} from './levelUp'
import { createCharacter, type Character } from './model'
import { resolveFeats } from './feats'

const PLAIN = loadedClass('Plain', [], [])
const deps = depsOf([KNIGHT, SEER, PLAIN])
const KNIGHT_REF = { name: 'Knight', source: 'PHB' }
const SEER_REF = { name: 'Seer', source: 'PHB' }

function knight(level: number, patch: Partial<Character> = {}): Character {
  const c = createCharacter('Test')
  return {
    ...c,
    selectedBooks: ['PHB'],
    classes: [{ ...KNIGHT_REF, level }],
    abilities: { ...c.abilities, str: { base: 15, other: 0 } },
    ...patch,
  }
}

const summaryOf = (c: Character) =>
  resolveFeats(c, { feats: [], classByKey: deps.classByKey })

const stepsFor = (before: Character, target = KNIGHT_REF) => {
  const level = applyLevel(before, target, deps.classByKey)
  return { level, steps: levelUpSteps(before, level.draft, level, deps) }
}

describe('applyLevel', () => {
  it('raises the level of a class the character has', () => {
    const { draft, classIndex, from, to, die } = applyLevel(
      knight(2),
      KNIGHT_REF,
      deps.classByKey,
    )
    expect(draft.classes).toEqual([{ ...KNIGHT_REF, level: 3 }])
    expect({ classIndex, from, to }).toEqual({ classIndex: 0, from: 2, to: 3 })
    expect(die).toEqual({ index: 2, faces: 10, first: false, rolled: false })
  })

  it('adds a new class at level 1 after the others', () => {
    const { draft, classIndex, from, to } = applyLevel(
      knight(2),
      SEER_REF,
      deps.classByKey,
    )
    expect(draft.classes.at(-1)).toEqual({ ...SEER_REF, level: 1 })
    expect({ classIndex, from, to }).toEqual({ classIndex: 1, from: 0, to: 1 })
  })

  it('puts the average of the new die in the rolls of a rolling character', () => {
    const before = knight(2, {
      hp: { ...knight(2).hp, method: 'rolled', rolls: [10, 7] },
    })
    const { draft, die } = applyLevel(before, KNIGHT_REF, deps.classByKey)
    expect(die?.rolled).toBe(true)
    expect(draft.hp.rolls).toEqual([10, 7, 6])
  })

  it('places the die of a class in its class order, before a later class', () => {
    const before = knight(1, {
      classes: [
        { ...KNIGHT_REF, level: 1 },
        { ...SEER_REF, level: 1 },
      ],
      hp: { ...knight(1).hp, method: 'rolled', rolls: [10, 4] },
    })
    const { draft, die } = applyLevel(before, KNIGHT_REF, deps.classByKey)
    expect(die?.index).toBe(1)
    expect(draft.hp.rolls).toEqual([10, 6, 4])
  })

  it('gives no die for a class with no hit die in the data', () => {
    const before = knight(1)
    const { die, to } = applyLevel(
      before,
      { name: 'Unknown', source: 'PHB' },
      deps.classByKey,
    )
    expect(die).toBeUndefined()
    expect(to).toBe(1)
  })
})

describe('setLevelRoll', () => {
  const die = { index: 1, faces: 8, first: false, rolled: true }
  it('replaces the new level value, kept between 1 and the die size', () => {
    expect(setLevelRoll([8, 5, 3], die, 7)).toEqual([8, 7, 3])
    expect(setLevelRoll([8, 5], die, 12)).toEqual([8, 8])
    expect(setLevelRoll([8, 5], die, 0)).toEqual([8, 1])
  })
})

describe('canGainLevel and targetKey', () => {
  it('stops at level 20', () => {
    expect(canGainLevel(knight(19))).toBe(true)
    expect(canGainLevel(knight(20))).toBe(false)
  })
  it('keys a class by name and source', () => {
    expect(targetKey(KNIGHT_REF)).toBe('Knight|PHB')
  })
})

describe('newClassFlags', () => {
  it('flags a new class whose prerequisite is not met, and only its own', () => {
    const flags = newClassFlags(
      knight(3),
      SEER_REF,
      deps.classByKey,
      summaryOf(knight(3)),
    )
    expect(flags.map((f) => f.category)).toEqual(['multiclass-req'])
    expect(flags[0].message).toMatch(/Seer/)
  })
  it('flags nothing when the scores meet both classes', () => {
    const c = knight(3)
    const wise = { ...c, abilities: { ...c.abilities, wis: { base: 14, other: 0 } } }
    expect(newClassFlags(wise, SEER_REF, deps.classByKey, summaryOf(wise))).toEqual([])
  })
})

describe('levelUpSteps', () => {
  it('asks for the subclass at the level that grants it', () => {
    const { steps } = stepsFor(knight(2))
    expect(steps.subclass).toBe(true)
    expect(steps.featSlots).toEqual([])
  })

  it('does not ask for the subclass before or after that level', () => {
    expect(stepsFor(knight(1)).steps.subclass).toBe(false)
    expect(stepsFor(knight(3)).steps.subclass).toBe(false)
  })

  it('asks for an ability score improvement or feat at its level', () => {
    const { steps } = stepsFor(knight(3))
    expect(steps.featSlots).toHaveLength(1)
    expect(steps.featSlots[0]).toMatch(/Ability Score Improvement/)
    expect(steps.spells).toBeNull()
  })

  it('asks a caster for its new spells, and lets a known caster replace one', () => {
    const seer = { ...knight(0), classes: [{ ...SEER_REF, level: 3 }] }
    const { steps } = stepsFor(seer, SEER_REF)
    expect(steps.spells).toEqual({ classKey: 'Seer|PHB', swap: true, grantIds: [] })
  })

  it('asks a new caster for its spells but offers no replacement yet', () => {
    const { steps } = stepsFor(knight(3), SEER_REF)
    expect(steps.spells).toEqual({ classKey: 'Seer|PHB', swap: false, grantIds: [] })
    expect(steps.features.map((f) => f.name)).toEqual(['Sight'])
  })

  it('asks nothing of a level that brings nothing to choose', () => {
    const plain = { ...knight(0), classes: [{ name: 'Plain', source: 'PHB', level: 1 }] }
    const { steps } = stepsFor(plain, { name: 'Plain', source: 'PHB' })
    expect(steps).toEqual({
      subclass: false,
      featSlots: [],
      spells: null,
      options: [],
      features: [],
    })
  })
})
