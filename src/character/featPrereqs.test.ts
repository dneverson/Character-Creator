import { describe, expect, it } from 'vitest'
import type { FeatPrerequisite } from '../data/feats'
import type { ClassEntry, LoadedClass } from '../data/class'
import type { PlayableRace } from '../data/race'
import { makeFeat } from '../test/featFixtures'
import { createCharacter, type RaceRef } from './model'
import { prerequisitesMet, proficiencySet, type PrereqContext } from './featPrereqs'

function ctx(over: Partial<PrereqContext> = {}): PrereqContext {
  return {
    character: createCharacter('Tester'),
    level: 1,
    classLevels: new Map(),
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    priorFeats: [],
    otherFeats: [],
    features: new Set(),
    proficiencies: { armor: new Set(), martial: 'none' },
    ...over,
  }
}

const check = (prerequisites: FeatPrerequisite[], c: PrereqContext) =>
  prerequisitesMet(makeFeat({ name: 'Subject', prerequisites }), c)

function raceRef(baseName: string, subraceName?: string): RaceRef {
  return {
    name: subraceName ? `${baseName} (${subraceName})` : baseName,
    baseName,
    subraceName,
    source: 'PHB',
    abilityFixed: {},
    abilityChoices: {},
  }
}

function withRace(ref: RaceRef) {
  const character = createCharacter('Tester')
  character.race = ref
  return character
}

function halfling(size?: string[]): PlayableRace {
  return {
    key: 'halfling|phb',
    name: 'Halfling',
    baseName: 'Halfling',
    source: 'PHB',
    size,
    abilityOptions: [],
    featGrants: [],
  }
}

describe('prerequisitesMet', () => {
  it('treats a feat without prerequisites as met', () => {
    expect(check([], ctx())).toBe('met')
  })

  it('checks character level and class level', () => {
    expect(check([{ level: 4 }], ctx({ level: 3 }))).toBe('unmet')
    expect(check([{ level: 4 }], ctx({ level: 4 }))).toBe('met')
    expect(check([{ level: { level: 4 } }], ctx({ level: 5 }))).toBe('met')
    const fighter5 = { level: { level: 5, class: { name: 'Fighter' } } }
    expect(check([fighter5], ctx({ classLevels: new Map([['fighter', 5]]) }))).toBe('met')
    // Total level does not count toward a class-level requirement.
    expect(check([fighter5], ctx({ level: 9 }))).toBe('unmet')
  })

  it('accepts any one of the listed minimum scores', () => {
    const prereq = [{ ability: [{ str: 13 }, { dex: 13 }] }]
    const abilities = { str: 10, dex: 13, con: 10, int: 10, wis: 10, cha: 10 }
    expect(check(prereq, ctx({ abilities }))).toBe('met')
    expect(check(prereq, ctx())).toBe('unmet')
  })

  it('matches race and subrace', () => {
    const elf = [{ race: [{ name: 'elf' }] }]
    expect(check(elf, ctx())).toBe('unmet')
    expect(check(elf, ctx({ character: withRace(raceRef('Elf')) }))).toBe('met')
    expect(check(elf, ctx({ character: withRace(raceRef('Dwarf')) }))).toBe('unmet')

    const woodElf = [{ race: [{ name: 'elf', subrace: 'wood' }] }]
    // A 2024 species picks its lineage in play, not as a subrace: unknown.
    expect(check(woodElf, ctx({ character: withRace(raceRef('Elf')) }))).toBe('unknown')
    expect(check(woodElf, ctx({ character: withRace(raceRef('Elf', 'Wood')) }))).toBe(
      'met',
    )
    expect(check(woodElf, ctx({ character: withRace(raceRef('Elf', 'High')) }))).toBe(
      'unmet',
    )
  })

  it('checks "small race" against the loaded race size', () => {
    const small = [{ race: [{ name: 'small race' }] }]
    const character = withRace(raceRef('Halfling'))
    expect(check(small, ctx({ character }))).toBe('unknown')
    expect(check(small, ctx({ character, race: halfling(['S']) }))).toBe('met')
    expect(check(small, ctx({ character, race: halfling(['M']) }))).toBe('unmet')
    expect(check(small, ctx({ character, race: halfling() }))).toBe('unmet')
  })

  it('matches the background by name', () => {
    const prereq = [{ background: [{ name: 'acolyte' }] }]
    expect(check(prereq, ctx())).toBe('unmet')
    const character = createCharacter('Tester')
    character.background = { name: 'Acolyte', source: 'XPHB', abilityChoices: {} }
    expect(check(prereq, ctx({ character }))).toBe('met')
  })

  it('checks class features', () => {
    const prereq = [{ feature: ['Fighting Style'] }]
    expect(check(prereq, ctx({ features: new Set(['fighting style']) }))).toBe('met')
    expect(check(prereq, ctx())).toBe('unmet')
  })

  it('checks earlier feats, including a named version', () => {
    const adept = makeFeat({ name: 'Elemental Adept', source: 'PHB' })
    const fire = makeFeat({
      name: 'Elemental Adept; Fire',
      baseName: 'Elemental Adept',
      source: 'PHB',
    })
    const cold = makeFeat({
      name: 'Elemental Adept; Cold',
      baseName: 'Elemental Adept',
      source: 'PHB',
    })
    const plain = [{ feat: ['elemental adept|phb'] }]
    expect(check(plain, ctx())).toBe('unmet')
    expect(check(plain, ctx({ priorFeats: [adept] }))).toBe('met')

    const versioned = [{ feat: ['elemental adept|phb|elemental adept (fire)'] }]
    expect(check(versioned, ctx({ priorFeats: [fire] }))).toBe('met')
    expect(check(versioned, ctx({ priorFeats: [cold] }))).toBe('unmet')
    // A feat without versions leaves the chosen element untracked.
    expect(check(versioned, ctx({ priorFeats: [adept] }))).toBe('unknown')
  })

  it('checks required and exclusive feat categories', () => {
    const style = makeFeat({ name: 'Archery', category: 'FS' })
    const mark = makeFeat({ name: 'Mark of Detection', category: 'DM' })
    const plain = makeFeat({ name: 'Alert' })
    expect(check([{ featCategory: ['FS'] }], ctx({ priorFeats: [style] }))).toBe('met')
    expect(check([{ featCategory: ['FS'] }], ctx({ priorFeats: [mark, plain] }))).toBe(
      'unmet',
    )
    const exclusive = [{ exclusiveFeatCategory: ['DM'] }]
    expect(check(exclusive, ctx({ otherFeats: [mark] }))).toBe('unmet')
    expect(check(exclusive, ctx({ otherFeats: [style, plain] }))).toBe('met')
  })

  it('checks the spellcasting variants', () => {
    const pact = new Set(['pact magic'])
    const casting = new Set(['spellcasting'])
    expect(check([{ spellcastingFeature: true }], ctx({ features: casting }))).toBe('met')
    expect(check([{ spellcastingFeature: true }], ctx({ features: pact }))).toBe('unmet')
    expect(check([{ spellcasting2020: true }], ctx({ features: pact }))).toBe('met')
    expect(check([{ spellcasting2020: true }], ctx())).toBe('unmet')
    expect(check([{ spellcasting: true }], ctx({ features: casting }))).toBe('met')
    // Racial and feat spells are not tracked yet, so no class casting is unknown.
    expect(check([{ spellcasting: true }], ctx())).toBe('unknown')
  })

  it('checks armor and martial weapon proficiencies', () => {
    const profs = (martial: 'full' | 'some' | 'none', armor: string[] = []) =>
      ctx({ proficiencies: { armor: new Set(armor), martial } })
    const medium = [{ proficiency: [{ armor: 'medium' }] }]
    expect(check(medium, profs('none', ['medium']))).toBe('met')
    expect(check(medium, profs('none'))).toBe('unmet')

    const weapon = [{ proficiency: [{ weapon: 'martial' }] }]
    expect(check(weapon, profs('full'))).toBe('met')
    expect(check(weapon, profs('some'))).toBe('unknown')
    expect(check(weapon, profs('none'))).toBe('unmet')

    const group = [{ proficiency: [{ weaponGroup: 'martial' }] }]
    expect(check(group, profs('full'))).toBe('met')
    expect(check(group, profs('some'))).toBe('unmet')

    expect(check([{ proficiency: [{ weapon: 'simple' }] }], profs('full'))).toBe(
      'unknown',
    )
  })

  it('cannot check campaign or free-text prerequisites', () => {
    expect(check([{ campaign: ['Eberron'] }], ctx())).toBe('unknown')
    expect(check([{ other: 'Must be a sorcerer' }], ctx())).toBe('unknown')
    expect(check([{ otherSummary: { entry: 'Some condition' } }], ctx())).toBe('unknown')
  })

  it('ANDs keys within an alternative and ORs alternatives', () => {
    // An unmet key outweighs an unknown one in the same alternative.
    expect(check([{ level: 5, spellcasting: true }], ctx())).toBe('unmet')
    const features = new Set(['x'])
    expect(check([{ level: 20 }, { feature: ['x'] }], ctx({ features }))).toBe('met')
    expect(check([{ level: 20 }, { campaign: ['Eberron'] }], ctx())).toBe('unknown')
  })
})

describe('proficiencySet', () => {
  const cls = (name: string, extra: Partial<ClassEntry>): LoadedClass => ({
    entry: {
      name,
      source: 'PHB',
      hd: { number: 1, faces: 10 },
      classFeatures: [],
      ...extra,
    },
    file: {},
  })

  it('uses the first class full list and later classes multiclass lists', () => {
    const fighter = cls('Fighter', {
      startingProficiencies: {
        armor: [
          'light',
          { proficiency: 'shield' },
          '{@item Plate Armor|PHB}',
          { other: 1 },
        ],
        weapons: ['simple', { proficiency: 'martial' }],
      },
      // Ignored: Fighter is the first class.
      multiclassing: { proficienciesGained: { armor: ['heavy'] } },
    })
    const rogue = cls('Rogue', {
      startingProficiencies: { armor: ['heavy'] },
      multiclassing: {
        proficienciesGained: { armor: ['medium'], weapons: ['rapier|phb'] },
      },
    })
    const character = createCharacter('Tester')
    character.classes = [
      { name: 'Fighter', source: 'PHB', level: 1 },
      { name: 'Rogue', source: 'PHB', level: 1 },
      { name: 'Ghost', source: 'ZZZ', level: 1 },
    ]
    const byKey = new Map([
      ['Fighter|PHB', fighter],
      ['Rogue|PHB', rogue],
    ])
    const set = proficiencySet(character, byKey, undefined, [])
    expect([...set.armor].sort()).toEqual(['light', 'medium', 'shield'])
    // A specific weapon is only part of the martial group.
    expect(set.martial).toBe('some')

    const paladin = cls('Paladin', { startingProficiencies: { weapons: ['martial'] } })
    character.classes = [{ name: 'Paladin', source: 'PHB', level: 1 }]
    const full = proficiencySet(
      character,
      new Map([['Paladin|PHB', paladin]]),
      undefined,
      [],
    )
    expect(full.martial).toBe('full')
  })

  it('reads race and feat proficiency blocks', () => {
    const character = createCharacter('Tester')
    const dwarf: PlayableRace = {
      ...halfling(['M']),
      armorProficiencies: [{ light: true, medium: false, exotic: true }, null],
      weaponProficiencies: [{ 'battleaxe|phb': true }, null],
    }
    const fromRace = proficiencySet(character, new Map(), dwarf, [])
    expect([...fromRace.armor]).toEqual(['light'])
    expect(fromRace.martial).toBe('some')

    const chooser = makeFeat({
      name: 'Martial Chooser',
      weaponProficiencies: [
        { choose: { fromFilter: 'type=martial weapon|miscellaneous=mundane' } },
      ],
    })
    expect(proficiencySet(character, new Map(), undefined, [chooser]).martial).toBe(
      'some',
    )

    const other = makeFeat({
      name: 'Dagger Chooser',
      weaponProficiencies: [{ choose: { from: ['dagger|phb'] } }],
    })
    expect(proficiencySet(character, new Map(), undefined, [other]).martial).toBe('none')

    const master = makeFeat({
      name: 'Weapon Master',
      armorProficiencies: [{ heavy: true }],
      weaponProficiencies: [{ martial: true }, { 'longsword|phb': true }],
    })
    // Full proficiency is never lowered by a later partial one.
    const set = proficiencySet(character, new Map(), undefined, [master])
    expect(set.martial).toBe('full')
    expect([...set.armor]).toEqual(['heavy'])
  })
})
