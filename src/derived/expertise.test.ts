import { describe, expect, it } from 'vitest'
import { expertise, skillTable } from './expertise'
import { collectSources } from './sources'
import { createCharacter } from '../character/model'
import { buildSkillSources } from '../character/skills'
import { build, deps, featOf, loadedClass } from '../test/derivedFixtures'
import type { LoadedClass } from '../data/class'

const feature = (name: string, level: number, className: string, source = 'PHB') => ({
  name,
  source,
  className,
  classSource: source,
  level,
  entries: [],
})

const rogue = (source = 'PHB'): LoadedClass => ({
  ...loadedClass('Rogue', [], [], {
    classFeature: [
      feature('Expertise', 1, 'Rogue', source),
      feature('Expertise', 6, 'Rogue', source),
    ],
  }),
})

const character = (level: number, picks = {}) => {
  const c = build('Rogue', level, {}, [])
  c.grantPicks = {
    skill: {
      stealth: 'class:Rogue|PHB',
      acrobatics: 'class:Rogue|PHB',
      perception: 'class:Rogue|PHB',
    },
    ...picks,
  }
  return c
}

const tableOf = (
  c: ReturnType<typeof character>,
  extra: Partial<ReturnType<typeof collectSources>> = {},
) => {
  const d = deps([rogue()])
  const sources = { ...collectSources(c, d), ...extra }
  return skillTable(
    c,
    sources,
    [...buildSkillSources(c, d.classByKey), ...sources.summary.skillSources],
    {},
  )
}

describe('expertise', () => {
  it('gives a Rogue two picks at level 1 and two more at level 6, from the skills they have', () => {
    const one = tableOf(character(1))
    expect(one.expertise.cards).toHaveLength(1)
    expect(one.expertise.cards[0]).toMatchObject({
      tag: 'class:Rogue|PHB',
      label: 'Class · Rogue expertise',
      count: 2,
      left: 2,
    })
    expect(one.expertise.cards[0].chips.map((c) => c.value)).toEqual([
      'acrobatics',
      'perception',
      'stealth',
    ])
    expect(tableOf(character(6)).expertise.cards[0]).toMatchObject({ count: 4, left: 4 })
  })

  it('doubles the proficiency bonus of a skill picked, and says what gives it', () => {
    const { rows, expertise: state } = tableOf(
      character(1, { expertise: { stealth: 'class:Rogue|PHB' } }),
    )
    const stealth = rows.find((r) => r.key === 'stealth')
    // Dexterity 10 (+0), proficiency +2 twice.
    expect(stealth).toMatchObject({ modifier: 4, expertise: 'Rogue' })
    expect(rows.find((r) => r.key === 'acrobatics')).toMatchObject({ modifier: 2 })
    expect(state.cards[0].chips.map((c) => c.state)).toEqual([
      'available',
      'available',
      'picked',
    ])
  })

  it('ignores a pick in a skill the character is not proficient in', () => {
    const { rows } = tableOf(character(1, { expertise: { arcana: 'class:Rogue|PHB' } }))
    expect(rows.find((r) => r.key === 'arcana')).toMatchObject({ modifier: 0 })
    expect(rows.find((r) => r.key === 'arcana')?.expertise).toBeUndefined()
  })

  it("lets the 2014 Rogue pick thieves' tools when proficient with them", () => {
    const c = character(1, {
      tool: { "thieves' tools": 'manual' },
      expertise: { "thieves' tools": 'class:Rogue|PHB' },
    })
    const { expertise: state } = tableOf(c)
    expect(state.cards[0].chips.map((x) => x.value)).toContain("thieves' tools")
    expect(state.held.get("thieves' tools")?.label).toBe('Rogue')
  })

  it('reads the expertise of a feat from its data, a pick and a fixed one', () => {
    const c = character(1, { expertise: { acrobatics: 'feat:slot' } })
    const base = collectSources(c, deps([rogue()]))
    const skillExpert = {
      ...featOf('Skill Expert', 'XPHB'),
      expertise: [{ anyProficientSkill: 1 }],
    }
    const anatomy = {
      ...featOf('Aberrant Anatomy', 'RHW'),
      expertise: [{ perception: true }],
    }
    const feats = [
      {
        feat: skillExpert,
        source: { kind: 'feat' as const, tag: 'feat:slot', label: 'Skill Expert' },
      },
      {
        feat: anatomy,
        source: { kind: 'feat' as const, tag: 'feat:two', label: 'Aberrant Anatomy' },
      },
    ]
    const state = expertise(
      { ...base, feats },
      { picks: c.grantPicks },
      {
        skills: new Set(['acrobatics', 'perception']),
        tools: new Set(),
      },
    )
    expect(state.held.get('acrobatics')?.label).toBe('Skill Expert')
    expect(state.held.get('perception')?.label).toBe('Aberrant Anatomy')
    const card = state.cards.find((x) => x.tag === 'feat:slot')
    expect(card).toMatchObject({ count: 1, left: 0, kind: 'feat' })
    // Perception is covered by the other feat: it is taken, not offered again.
    expect(card?.chips.find((x) => x.value === 'perception')).toMatchObject({
      state: 'taken',
      takenBy: 'Aberrant Anatomy',
    })
  })

  it('counts a pick charged to no source of the character as non-standard', () => {
    const { expertise: state } = tableOf(
      character(1, { expertise: { stealth: 'manual' } }),
    )
    expect(state.held.get('stealth')?.label).toBe('Non-standard (DM approval)')
  })

  it('limits a Wizard Scholar to its list and holds a multiclass feature as a multiclass card', () => {
    const wizard = loadedClass('Wizard', [], [], {
      classFeature: [feature('Scholar', 2, 'Wizard', 'XPHB')],
    })
    wizard.entry.source = 'XPHB'
    const c = createCharacter('W')
    c.classes = [
      { name: 'Rogue', source: 'PHB', level: 1 },
      { name: 'Wizard', source: 'XPHB', level: 2 },
    ]
    c.grantPicks = { skill: { arcana: 'manual', stealth: 'manual' } }
    const d = deps([rogue(), wizard])
    const sources = collectSources(c, d)
    const state = expertise(
      sources,
      { picks: c.grantPicks },
      {
        skills: new Set(['arcana', 'stealth']),
        tools: new Set(),
      },
    )
    const scholar = state.cards.find((x) => x.tag === 'class:Wizard|XPHB')
    expect(scholar).toMatchObject({ label: 'Multiclass · Wizard expertise', count: 1 })
    expect(scholar?.chips.map((x) => x.value)).toEqual(['arcana'])
  })
})
