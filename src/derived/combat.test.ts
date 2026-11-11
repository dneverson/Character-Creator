import { describe, expect, it } from 'vitest'
import { combatNumbers } from './combat'
import { collectSources } from './sources'
import { characterAbilityTotals } from '../character/derive'
import type { Character } from '../character/model'
import { buildSkillSources, skillRows } from '../character/skills'
import { proficiencyBonus } from '../data/skills'
import type { LoadedClass } from '../data/class'
import { build, deps, featOf, loadedClass } from '../test/derivedFixtures'
import { sumLines } from './types'

const feature = (name: string, className: string, level: number, source = 'PHB') => ({
  name,
  source,
  className,
  classSource: source,
  level,
  entries: [],
})

const bard = loadedClass('Bard', [], [], {
  classFeature: [feature('Jack of All Trades', 'Bard', 2)],
})

const champion = (): LoadedClass => ({
  ...loadedClass('Fighter', [], [], {
    subclassFeature: [
      {
        name: 'Remarkable Athlete',
        source: 'PHB',
        className: 'Fighter',
        classSource: 'PHB',
        subclassShortName: 'Champion',
        subclassSource: 'PHB',
        level: 7,
        entries: [],
      },
    ],
  }),
})

function numbers(
  c: Character,
  classes: LoadedClass[],
  feats: string[] = [],
  proficient: string[] = [],
) {
  const d = deps(classes)
  const base = collectSources(c, d)
  const sources = {
    ...base,
    feats: feats.map((name) => {
      const [n, source] = name.split('|')
      return {
        feat: featOf(n, source),
        source: { kind: 'feat' as const, tag: `feat:${name}`, label: n },
      }
    }),
  }
  c.grantPicks = { skill: Object.fromEntries(proficient.map((k) => [k, 'manual'])) }
  const totals = characterAbilityTotals(c)
  const prof = proficiencyBonus(c.classes.reduce((n, r) => n + r.level, 0))
  const rows = skillRows(c, buildSkillSources(c, d.classByKey), {})
  return combatNumbers(sources, totals, rows, prof)
}

describe('initiative', () => {
  it('is the Dexterity modifier with the manual line', () => {
    const c = build('Fighter', 1, { dex: 14 }, [])
    c.manualBonuses = { initiative: 1 }
    const { initiative } = numbers(c, [loadedClass('Fighter', [], [])])
    expect(initiative.value).toBe(3)
    expect(initiative.lines.map((l) => l.label)).toEqual(['Dexterity', 'Other bonus'])
    expect(sumLines(initiative.lines)).toBe(3)
  })

  it('adds +5 for Alert of 2014 and the proficiency bonus for Alert of 2024', () => {
    const c = build('Fighter', 5, { dex: 10 }, [])
    const fighter = [loadedClass('Fighter', [], [])]
    expect(numbers(c, fighter, ['Alert|PHB']).initiative.value).toBe(5)
    expect(numbers(c, fighter, ['Alert|XPHB']).initiative.value).toBe(3)
  })

  it('adds half the proficiency bonus with Jack of All Trades, not beside proficiency', () => {
    const c = build('Bard', 5, { dex: 10 }, [])
    expect(numbers(c, [bard]).initiative.value).toBe(1)
    const alert = numbers(c, [bard], ['Alert|XPHB']).initiative
    expect(alert.value).toBe(3)
    expect(alert.lines.find((l) => l.label === 'Jack of All Trades')).toMatchObject({
      status: 'inactive',
      why: 'You already add your proficiency bonus.',
    })
  })

  it('rounds the half up for Remarkable Athlete and counts the larger of two', () => {
    const c = build('Fighter', 7, { dex: 10 }, [])
    c.classes = [
      {
        ...c.classes[0],
        subclass: { name: 'Champion', shortName: 'Champion', source: 'PHB' },
      },
    ]
    expect(numbers(c, [champion()]).initiative.value).toBe(2)
    c.classes = [...c.classes, { name: 'Bard', source: 'PHB', level: 2 }]
    const both = numbers(c, [champion(), bard]).initiative
    expect(both.value).toBe(2)
    expect(both.lines.filter((l) => l.status === 'inactive')).toHaveLength(1)
  })

  it('shows advantage as a note that adds nothing', () => {
    const c = build('Barbarian', 7, { dex: 10 }, [])
    const barbarian = loadedClass('Barbarian', [], [], {
      classFeature: [feature('Feral Instinct', 'Barbarian', 7)],
    })
    const { initiative } = numbers(c, [barbarian])
    expect(initiative.value).toBe(0)
    expect(initiative.lines.find((l) => l.label === 'Feral Instinct')).toMatchObject({
      op: 'note',
    })
  })
})

describe('passive scores', () => {
  it('is 10 plus the skill modifier, with proficiency', () => {
    const c = build('Fighter', 1, { wis: 14 }, [])
    const { passives } = numbers(c, [loadedClass('Fighter', [], [])], [], ['perception'])
    expect(passives.map((p) => [p.key, p.score.value])).toEqual([
      ['perception', 14],
      ['investigation', 10],
      ['insight', 12],
    ])
  })

  it('adds +5 to Perception and Investigation with Observant of 2014', () => {
    const c = build('Fighter', 1, {}, [])
    const { passives } = numbers(c, [loadedClass('Fighter', [], [])], ['Observant|PHB'])
    expect(passives.map((p) => p.score.value)).toEqual([15, 15, 10])
  })

  it('adds half the proficiency bonus for Jack of All Trades to a skill without it', () => {
    const c = build('Bard', 5, {}, [])
    const { passives } = numbers(c, [bard], [], ['insight'])
    expect(passives.map((p) => p.score.value)).toEqual([11, 11, 13])
  })
})
