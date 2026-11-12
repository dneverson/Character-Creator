import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import type { PlayableRace } from '../data/race'
import { build, deps, featOf, loadedClass, stack } from '../test/derivedFixtures'
import { characterEdition } from './edition'
import { hitDice } from './hitDice'
import { senseRows } from './senses'
import { deriveSlots } from './slots'
import { collectSources } from './sources'
import { speedQuantity } from './speed'
import type { SourceRef } from './types'

const feature = (name: string, className: string, level: number, source = 'PHB') => ({
  name,
  source,
  className,
  classSource: source,
  level,
  entries: [],
})

const elf: PlayableRace = {
  key: 'wood elf|phb',
  name: 'Wood Elf',
  baseName: 'Elf',
  source: 'PHB',
  speed: { walk: 35, fly: 30 },
  darkvision: 60,
  abilityOptions: [],
  featGrants: [],
}

const barbarian = loadedClass('Barbarian', [], [], {
  classFeature: [feature('Fast Movement', 'Barbarian', 5)],
})
const monk = loadedClass('Monk', [], [], {
  classFeature: [feature('Unarmored Movement', 'Monk', 2)],
})

function sourcesOf(
  c: ReturnType<typeof build>,
  classes = [barbarian],
  race?: PlayableRace,
  feats: string[] = [],
) {
  const base = collectSources(c, { ...deps(classes), race })
  return {
    ...base,
    feats: feats.map((name) => {
      const [n, source] = name.split('|')
      const ref: SourceRef = { kind: 'feat', tag: `feat:${name}`, label: n }
      return { feat: featOf(n, source), source: ref }
    }),
  }
}

describe('speed', () => {
  it('starts from the species and lists the other ways of moving as notes', () => {
    const c = build('Barbarian', 1, {}, [])
    const speed = speedQuantity(sourcesOf(c, [barbarian], elf))
    expect(speed.value).toBe(35)
    expect(speed.lines.map((l) => l.label)).toEqual(['Walking speed', 'Fly 30 ft.'])
    expect(speed.lines[1].op).toBe('note')
  })

  it('has no lines without a species', () => {
    const c = build('Barbarian', 1, {}, [])
    expect(speedQuantity(sourcesOf(c)).lines).toEqual([])
  })

  it('adds Fast Movement unless heavy armor is worn', () => {
    const open = build('Barbarian', 5, {}, [])
    expect(speedQuantity(sourcesOf(open, [barbarian], elf)).value).toBe(45)
    const heavy = build('Barbarian', 5, {}, [stack('Chain Mail')])
    const worn = speedQuantity(sourcesOf(heavy, [barbarian], elf))
    expect(worn.value).toBe(35)
    expect(worn.lines.at(-1)).toMatchObject({
      status: 'inactive',
      why: 'You are wearing heavy armor.',
    })
    const light = build('Barbarian', 5, {}, [stack('Leather Armor')])
    expect(speedQuantity(sourcesOf(light, [barbarian], elf)).value).toBe(45)
  })

  it('grows Unarmored Movement with the Monk level and stops with armor or a shield', () => {
    const at = (level: number, items: ReturnType<typeof stack>[] = []) =>
      speedQuantity(sourcesOf(build('Monk', level, {}, items), [monk], elf)).value
    expect(at(2)).toBe(45)
    expect(at(6)).toBe(50)
    expect(at(18)).toBe(65)
    expect(at(6, [stack('Leather Armor')])).toBe(35)
    expect(at(6, [stack('Shield')])).toBe(35)
  })

  it('adds the feats Mobile and Speedy', () => {
    const c = build('Barbarian', 1, {}, [])
    expect(speedQuantity(sourcesOf(c, [barbarian], elf, ['Mobile|PHB'])).value).toBe(45)
    expect(speedQuantity(sourcesOf(c, [barbarian], elf, ['Speedy|XPHB'])).value).toBe(45)
  })
})

describe('senses', () => {
  it('reads darkvision from the species with its source', () => {
    const c = build('Barbarian', 1, {}, [])
    const [dark] = senseRows(sourcesOf(c, [barbarian], elf))
    expect(dark).toMatchObject({ key: 'darkvision', label: 'Darkvision' })
    expect(dark.range.value).toBe(60)
    expect(dark.range.lines[0].source).toMatchObject({ kind: 'race', label: 'Wood Elf' })
  })

  it('uses the larger range of the same sense, and adds a bonus sense', () => {
    const c = build('Barbarian', 1, {}, [])
    const sources = sourcesOf(c, [barbarian], elf)
    const feat = (name: string, extra: object) => ({
      feat: { ...featOf(name, 'XPHB'), ...extra },
      source: { kind: 'feat' as const, tag: `feat:${name}`, label: name },
    })
    const bigger = senseRows({
      ...sources,
      feats: [feat('Far Eyes', { senses: [{ darkvision: 120 }] })],
    })
    expect(bigger[0].range.value).toBe(120)
    expect(bigger[0].range.lines.find((l) => l.label === 'Wood Elf')).toMatchObject({
      status: 'inactive',
    })
    const bonus = senseRows({
      ...sources,
      feats: [feat('Keenness', { bonusSenses: [{ darkvision: 60 }] })],
    })
    expect(bonus[0].range.value).toBe(120)
  })

  it('gives blindsight to the Blind Fighting style', () => {
    const c = build('Barbarian', 1, {}, [])
    const sources = { ...sourcesOf(c), options: new Set(['Blind Fighting|TCE']) }
    expect(senseRows(sources)).toMatchObject([{ key: 'blindsight' }])
    expect(senseRows(sources)[0].range.value).toBe(10)
  })

  it('is empty for a character with none', () => {
    expect(senseRows(sourcesOf(build('Barbarian', 1, {}, [])))).toEqual([])
  })
})

describe('hit dice', () => {
  it('count the levels of each die size with a line for each class', () => {
    const wizard = loadedClass('Wizard', [], [])
    wizard.entry.hd = { number: 1, faces: 6 }
    const fighter = loadedClass('Fighter', [], [])
    fighter.entry.hd = { number: 1, faces: 10 }
    const c = build('Fighter', 3, {}, [])
    c.classes = [...c.classes, { name: 'Wizard', source: 'PHB', level: 2 }]
    const dice = hitDice(c, deps([fighter, wizard]).classByKey)
    expect(dice.map((d) => [d.faces, d.count.value])).toEqual([
      [10, 3],
      [6, 2],
    ])
    expect(dice[0].count.lines[0].source.label).toBe('Fighter')
  })

  it('sum classes that share a die size', () => {
    const cleric = loadedClass('Cleric', [], [])
    const rogue = loadedClass('Rogue', [], [])
    const c = build('Cleric', 2, {}, [])
    c.classes = [...c.classes, { name: 'Rogue', source: 'PHB', level: 3 }]
    const dice = hitDice(c, deps([cleric, rogue]).classByKey)
    expect(dice).toHaveLength(1)
    expect(dice[0].count.value).toBe(5)
    expect(dice[0].count.lines).toHaveLength(2)
  })
})

describe('slots', () => {
  const caster = (name: string, progression: string, ability = 'int') => {
    const lc = loadedClass(name, [], [])
    lc.entry.casterProgression = progression
    lc.entry.spellcastingAbility = ability
    return lc
  }

  it('uses the combined caster level for several spellcasting classes', () => {
    const wizard = caster('Wizard', 'full')
    const paladin = caster('Paladin', '1/2', 'cha')
    const c = build('Wizard', 5, {}, [])
    c.classes = [...c.classes, { name: 'Paladin', source: 'PHB', level: 4 }]
    const d = deps([wizard, paladin])
    const slots = deriveSlots(c, d.classByKey, collectSources(c, d))
    // 5 + floor(4 / 2) = caster level 7.
    expect(slots.casterLevel.value).toBe(7)
    expect(slots.standard).toEqual([4, 3, 3, 1, 0, 0, 0, 0, 0])
    expect(slots.casterLevel.lines.map((l) => l.amount)).toEqual([5, 2])
    expect(slots.maxSpellLevel).toBe(4)
  })

  it('uses the own table of a single class and shows its contribution as not used', () => {
    const paladin = caster('Paladin', '1/2', 'cha')
    const c = build('Paladin', 5, {}, [])
    const d = deps([paladin])
    const slots = deriveSlots(c, d.classByKey, collectSources(c, d))
    expect(slots.standard.slice(0, 2)).toEqual([4, 2])
    expect(slots.casterLevel.value).toBe(0)
    expect(slots.casterLevel.lines[0].status).toBe('inactive')
  })

  it('keeps Pact Magic apart from the combined level', () => {
    const wizard = caster('Wizard', 'full')
    const warlock = caster('Warlock', 'pact', 'cha')
    const c = build('Wizard', 3, {}, [])
    c.classes = [...c.classes, { name: 'Warlock', source: 'PHB', level: 5 }]
    const d = deps([wizard, warlock])
    const slots = deriveSlots(c, d.classByKey, collectSources(c, d))
    expect(slots.standard.slice(0, 2)).toEqual([4, 2])
    expect(slots.pact).toEqual({ slots: 2, level: 3 })
    expect(slots.maxSpellLevel).toBe(3)
    expect(slots.casters).toHaveLength(2)
  })
})

describe('edition', () => {
  const one = (source: string) =>
    source === 'XPHB' ? ('one' as const) : ('classic' as const)

  it('follows the first class book, then the species, then the selected books', () => {
    const c = build('Fighter', 1, {}, [])
    expect(characterEdition(c, one)).toBe('classic')
    c.classes = [{ name: 'Fighter', source: 'XPHB', level: 1 }]
    expect(characterEdition(c, one)).toBe('one')
    c.classes = []
    c.race = {
      name: 'Human',
      baseName: 'Human',
      source: 'XPHB',
      abilityFixed: {},
      abilityChoices: {},
    }
    expect(characterEdition(c, one)).toBe('one')
    c.race = undefined
    c.selectedBooks = ['XPHB']
    expect(characterEdition(c, one)).toBe('one')
    c.selectedBooks = ['XPHB', 'PHB']
    expect(characterEdition(c, one)).toBe('classic')
  })

  it('knows the 2024 books by name when the books list is not loaded', () => {
    const c = build('Fighter', 1, {}, [])
    expect(characterEdition(c)).toBe('classic')
    c.classes = [{ name: 'Fighter', source: 'XPHB', level: 1 }]
    expect(characterEdition(c)).toBe('one')
  })

  it('is on the derived sheet, from the editions the dependencies give', () => {
    const c = build('Fighter', 1, {}, [])
    const sheet = deriveSheet(c, {
      ...deps([loadedClass('Fighter', [], [])]),
      editionOf: () => 'one',
    })
    expect(sheet.edition).toBe('one')
    expect(sheet.speed.lines).toEqual([])
    expect(sheet.slots.maxSpellLevel).toBe(0)
  })
})
