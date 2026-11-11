import { describe, expect, it } from 'vitest'
import {
  casterLevelContribution,
  casterFrom,
  classCaster,
  classMaxSpellLevel,
  evalPreparedFormula,
  spellbookFreeCount,
  spellSlots,
  usesSpellbook,
  type ClassCaster,
} from './spellcasting'
import type { ClassEntry, SubclassEntry } from '../data/class'

function entry(partial: Partial<ClassEntry> & Pick<ClassEntry, 'name'>): ClassEntry {
  return {
    source: 'PHB',
    hd: { number: 1, faces: 8 },
    classFeatures: [],
    ...partial,
  } as ClassEntry
}

const bard = entry({
  name: 'Bard',
  casterProgression: 'full',
  spellcastingAbility: 'cha',
  cantripProgression: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4],
  spellsKnownProgression: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14],
})
const cleric = entry({
  name: 'Cleric',
  casterProgression: 'full',
  spellcastingAbility: 'wis',
  cantripProgression: [3, 3, 3, 4, 4],
  preparedSpells: '<$level$> + <$wis_mod$>',
})
const paladin = entry({
  name: 'Paladin',
  casterProgression: '1/2',
  spellcastingAbility: 'cha',
  preparedSpells: '<$level$> / 2 + <$cha_mod$>',
})
const warlock = entry({
  name: 'Warlock',
  casterProgression: 'pact',
  spellcastingAbility: 'cha',
  cantripProgression: [2, 2, 2, 3, 3],
  spellsKnownProgression: [2, 3, 4, 5, 6],
})
const wizard = entry({
  name: 'Wizard',
  casterProgression: 'full',
  spellcastingAbility: 'int',
  cantripProgression: [3, 3, 3, 4, 4],
  preparedSpells: '<$level$> + <$int_mod$>',
})
const fighter = entry({ name: 'Fighter' })
const artificer = entry({
  name: 'Artificer',
  casterProgression: 'artificer',
  spellcastingAbility: 'int',
  preparedSpells: '<$level$> / 2 + <$int_mod$>',
})
// A caster that has slots but neither known nor prepared metadata.
const oddCaster = entry({ name: 'Odd', casterProgression: 'full' })

describe('classCaster', () => {
  it('classifies a known caster with cantrip and known counts', () => {
    const c = classCaster({ entry: bard, level: 5, abilityMod: 3 })
    expect(c.kind).toBe('known')
    expect(c.cantripsKnown).toBe(3)
    expect(c.spellsKnown).toBe(8)
  })

  it('classifies a prepared caster and computes its prepared max', () => {
    const c = classCaster({ entry: cleric, level: 5, abilityMod: 3 })
    expect(c.kind).toBe('prepared')
    expect(c.preparedMax).toBe(8) // level 5 + WIS +3
  })

  it('halves the level for half-caster prepared formulas', () => {
    const c = classCaster({ entry: paladin, level: 5, abilityMod: 2 })
    expect(c.preparedMax).toBe(4) // floor(5/2) + CHA +2
  })

  it('marks Warlock as a known caster using Pact Magic', () => {
    const c = classCaster({ entry: warlock, level: 5, abilityMod: 3 })
    expect(c.kind).toBe('known')
    expect(c.isPact).toBe(true)
  })

  it('returns a non-caster base for a class without progression', () => {
    const c = classCaster({ entry: fighter, level: 5, abilityMod: 3 })
    expect(c.kind).toBe('none')
    expect(c.cantripsKnown).toBe(0)
  })

  it('treats a caster lacking known/prepared metadata as prepared', () => {
    const c = classCaster({ entry: oddCaster, level: 5, abilityMod: 3 })
    expect(c.kind).toBe('prepared')
    expect(c.preparedMax).toBeUndefined()
  })
})

describe('2024 casters', () => {
  const cleric2024 = entry({
    name: 'Cleric',
    source: 'XPHB',
    casterProgression: 'full',
    spellcastingAbility: 'wis',
    cantripProgression: [3, 3, 3, 4, 4],
    preparedSpellsProgression: [
      4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22,
    ],
    preparedSpellsChange: 'restLong',
  })

  it('caps prepared spells by the class table, not a formula', () => {
    const c = classCaster({ entry: cleric2024, level: 1, abilityMod: 3 })
    expect(c.kind).toBe('prepared')
    expect(c.preparedMax).toBe(4)
    expect(c.changes).toBe('restLong')
    expect(classCaster({ entry: cleric2024, level: 20, abilityMod: 3 }).preparedMax).toBe(
      22,
    )
  })

  it('reads a level past the table as no spells, not no cap', () => {
    const short = entry({ ...cleric2024, preparedSpellsProgression: [4] })
    expect(classCaster({ entry: short, level: 3, abilityMod: 0 }).preparedMax).toBe(0)
  })

  it('prefers the table over the 2014 formula when a class has both', () => {
    const both = entry({ ...cleric2024, preparedSpells: '<$level$> + <$wis_mod$>' })
    expect(classCaster({ entry: both, level: 1, abilityMod: 3 }).preparedMax).toBe(4)
  })

  it('says when a class changes its list on gaining a level', () => {
    const sorcerer = entry({
      name: 'Sorcerer',
      casterProgression: 'full',
      preparedSpellsProgression: [2, 4],
      preparedSpellsChange: 'level',
    })
    expect(classCaster({ entry: sorcerer, level: 2, abilityMod: 0 }).changes).toBe(
      'level',
    )
  })

  it('reads the free spellbook spells from the class data', () => {
    const wizard2024 = entry({
      name: 'Wizard',
      source: 'XPHB',
      casterProgression: 'full',
      preparedSpellsProgression: [4, 5, 6],
      spellsKnownProgressionFixed: [6, 2, 2, 2],
    })
    expect(
      classCaster({ entry: wizard2024, level: 3, abilityMod: 0 }).spellbookFree,
    ).toBe(10)
    expect(
      classCaster({ entry: wizard, level: 3, abilityMod: 0 }).spellbookFree,
    ).toBeUndefined()
  })
})

describe('subclass casters', () => {
  const fighter2024 = entry({ name: 'Fighter', source: 'XPHB' })
  const eldritchKnight = {
    name: 'Eldritch Knight',
    shortName: 'Eldritch Knight',
    source: 'XPHB',
    className: 'Fighter',
    classSource: 'XPHB',
    subclassFeatures: [],
    casterProgression: '1/3',
    spellcastingAbility: 'int',
    cantripProgression: [0, 0, 2, 2, 2, 2, 2, 2, 2, 3],
    preparedSpellsProgression: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7],
  } satisfies SubclassEntry

  it('makes a Fighter with Eldritch Knight a third caster of its own subclass', () => {
    const c = classCaster({
      entry: fighter2024,
      level: 7,
      abilityMod: 2,
      subclass: eldritchKnight,
    })
    expect(c).toMatchObject({
      classKey: 'Fighter|XPHB',
      name: 'Fighter (Eldritch Knight)',
      subclassKey: 'Fighter|XPHB|Eldritch Knight',
      kind: 'prepared',
      progression: '1/3',
      ability: 'int',
      cantripsKnown: 2,
      preparedMax: 5,
    })
    // The Eldritch Knight's own table: four 1st-level and two 2nd-level slots at 7.
    expect(spellSlots([c]).standard).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(classMaxSpellLevel(c)).toBe(2)
  })

  it('is no caster below the level it starts casting', () => {
    const c = classCaster({
      entry: fighter2024,
      level: 2,
      abilityMod: 2,
      subclass: eldritchKnight,
    })
    expect(c.preparedMax).toBe(0)
    expect(classMaxSpellLevel(c)).toBe(0)
  })

  it('stays a non-caster with a subclass that does not cast, or none', () => {
    const champion = { ...eldritchKnight, casterProgression: undefined }
    expect(
      classCaster({ entry: fighter2024, level: 7, abilityMod: 0, subclass: champion })
        .kind,
    ).toBe('none')
    expect(classCaster({ entry: fighter2024, level: 7, abilityMod: 0 }).kind).toBe('none')
  })

  it('reads a 2014 third caster by spells known', () => {
    const arcaneTrickster = {
      ...eldritchKnight,
      source: 'PHB',
      classSource: 'PHB',
      className: 'Rogue',
      preparedSpellsProgression: undefined,
      spellsKnownProgression: [0, 0, 3, 4, 4, 4, 5],
    }
    const c = classCaster({
      entry: entry({ name: 'Rogue' }),
      level: 3,
      abilityMod: 0,
      subclass: arcaneTrickster,
    })
    expect(c.kind).toBe('known')
    expect(c.spellsKnown).toBe(3)
  })

  it('classifies a bare source of casting the same way (casterFrom)', () => {
    const c = casterFrom(
      { casterProgression: 'full', preparedSpells: '<$level$> + <$int_mod$>' },
      { classKey: 'X|Y', name: 'X', source: 'Y' },
      4,
      2,
    )
    expect(c).toMatchObject({ classKey: 'X|Y', kind: 'prepared', preparedMax: 6 })
  })
})

describe('classMaxSpellLevel', () => {
  const ranger = entry({
    name: 'Ranger',
    casterProgression: '1/2',
    spellcastingAbility: 'wis',
    spellsKnownProgression: [0, 2, 3, 3],
  })

  it('is the level the class learns on its own table, whatever else the character is', () => {
    const w = caster(wizard, 3)
    const r = caster(ranger, 4)
    // Together the slots reach 3rd level; the Wizard alone stops at 2nd.
    expect(spellSlots([w, r]).maxSpellLevel).toBe(3)
    expect(classMaxSpellLevel(w)).toBe(2)
    expect(classMaxSpellLevel(r)).toBe(1)
  })

  it('is the slot level of Pact Magic', () => {
    expect(classMaxSpellLevel(caster(warlock, 5))).toBe(3)
  })

  it('is 0 for a non-caster', () => {
    expect(classMaxSpellLevel(caster(fighter, 5))).toBe(0)
  })
})

describe('usesSpellbook', () => {
  it('is true only for the Wizard', () => {
    expect(usesSpellbook('Wizard')).toBe(true)
    expect(usesSpellbook('Cleric')).toBe(false)
    expect(usesSpellbook('Bard')).toBe(false)
  })
})

describe('spellbookFreeCount', () => {
  it('grants six spells at level 1 and two per level after', () => {
    expect(spellbookFreeCount(1)).toBe(6)
    expect(spellbookFreeCount(2)).toBe(8)
    expect(spellbookFreeCount(20)).toBe(44)
  })

  it('clamps a below-1 level to the level-1 baseline', () => {
    expect(spellbookFreeCount(0)).toBe(6)
  })

  it('adds up what the class data gives per level', () => {
    expect(spellbookFreeCount(3, [6, 2, 2, 2])).toBe(10)
    expect(spellbookFreeCount(0, [6, 2, 2, 2])).toBe(6)
  })
})

describe('casterLevelContribution', () => {
  it('maps each progression to its caster-level share', () => {
    expect(casterLevelContribution('full', 5)).toBe(5)
    expect(casterLevelContribution('artificer', 5)).toBe(3) // ceil(5/2)
    expect(casterLevelContribution('1/2', 5)).toBe(2) // floor(5/2)
    expect(casterLevelContribution('1/3', 5)).toBe(1) // floor(5/3)
    expect(casterLevelContribution('pact', 5)).toBe(0)
  })
})

describe('evalPreparedFormula', () => {
  it('adds level and modifier', () => {
    expect(evalPreparedFormula('<$level$> + <$int_mod$>', 3, 2)).toBe(5)
  })
  it('never drops below 1', () => {
    expect(evalPreparedFormula('<$level$> / 2 + <$cha_mod$>', 1, -1)).toBe(1)
  })
})

function caster(entryDef: ClassEntry, level: number): ClassCaster {
  return classCaster({ entry: entryDef, level, abilityMod: 0 })
}

describe('spellSlots', () => {
  it('uses the full table for a single full caster', () => {
    const s = spellSlots([caster(wizard, 5)])
    expect(s.standard).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0])
    expect(s.maxSpellLevel).toBe(3)
  })

  it('uses the half table for a single half caster', () => {
    const s = spellSlots([caster(paladin, 5)])
    expect(s.standard).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(s.maxSpellLevel).toBe(2)
  })

  it('gives Warlock separate Pact Magic slots', () => {
    const s = spellSlots([caster(warlock, 5)])
    expect(s.standard.every((n) => n === 0)).toBe(true)
    expect(s.pact).toEqual({ slots: 2, level: 3 })
    expect(s.maxSpellLevel).toBe(3)
  })

  it('combines multiclass caster levels on the full table', () => {
    const s = spellSlots([caster(wizard, 3), caster(cleric, 2)])
    // caster level 3 + 2 = 5
    expect(s.standard).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0])
  })

  it('uses the combined-table method for a single artificer', () => {
    const s = spellSlots([caster(artificer, 5)])
    // caster level ceil(5/2) = 3 -> full table row 3
    expect(s.standard).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(s.maxSpellLevel).toBe(2)
  })

  it('uses the third-caster table for a single Eldritch Knight, not the multiclass one', () => {
    const slotsAt = (level: number) =>
      spellSlots([
        {
          ...caster(wizard, level),
          progression: '1/3',
        },
      ]).standard.slice(0, 4)
    expect(slotsAt(2)).toEqual([0, 0, 0, 0])
    expect(slotsAt(3)).toEqual([2, 0, 0, 0])
    expect(slotsAt(4)).toEqual([3, 0, 0, 0])
    expect(slotsAt(7)).toEqual([4, 2, 0, 0])
    expect(slotsAt(10)).toEqual([4, 3, 0, 0])
    expect(slotsAt(13)).toEqual([4, 3, 2, 0])
    expect(slotsAt(16)).toEqual([4, 3, 3, 0])
    expect(slotsAt(19)).toEqual([4, 3, 3, 1])
  })

  it('grants no slots to a lone non-caster class', () => {
    const s = spellSlots([caster(fighter, 5)])
    expect(s.standard.every((n) => n === 0)).toBe(true)
    expect(s.maxSpellLevel).toBe(0)
  })
})
