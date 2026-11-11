import { describe, expect, it } from 'vitest'
import {
  buildSkillSources,
  classSourceTag,
  grantedLine,
  otherPicks,
  pickSkill,
  skillCards,
  skillRows,
  sourceBudgets,
  toggleSkillProficiency,
  type SkillSource,
} from './skills'
import { SKILLS } from '../data/skills'
import { createCharacter, type SkillProficiencies } from './model'
import type { LoadedClass, SkillChoice } from '../data/class'
import type { PlayableBackground } from '../data/background'
import type { PlayableRace } from '../data/race'

const sources: SkillSource[] = [
  {
    tag: 'bg',
    label: 'Background · Acolyte',
    kind: 'background',
    fixed: ['insight', 'religion'],
    choices: [],
  },
  {
    tag: 'class:Barbarian|PHB',
    label: 'Class · Barbarian',
    kind: 'class',
    fixed: [],
    choices: [
      {
        count: 2,
        from: ['animal handling', 'athletics', 'intimidation', 'perception'],
      },
    ],
  },
]

describe('toggleSkillProficiency', () => {
  it('charges a pick to the offering source with budget', () => {
    const next = toggleSkillProficiency({}, sources, 'athletics')
    expect(next).toEqual({ athletics: 'class:Barbarian|PHB' })
  })

  it('does not toggle fixed (locked) skills', () => {
    const next = toggleSkillProficiency({}, sources, 'insight')
    expect(next).toEqual({})
  })

  it('marks a pick manual when no source offers it', () => {
    const next = toggleSkillProficiency({}, sources, 'stealth')
    expect(next).toEqual({ stealth: 'manual' })
  })

  it('overflows to manual once a source budget is spent', () => {
    let chosen: SkillProficiencies = {}
    chosen = toggleSkillProficiency(chosen, sources, 'athletics')
    chosen = toggleSkillProficiency(chosen, sources, 'perception')
    // Budget of 2 is now full; a third class-list skill overflows to manual.
    chosen = toggleSkillProficiency(chosen, sources, 'intimidation')
    expect(chosen['intimidation']).toBe('manual')
  })

  it('removes a proficiency when toggled off', () => {
    const chosen = { athletics: 'class:Barbarian|PHB' }
    expect(toggleSkillProficiency(chosen, sources, 'athletics')).toEqual({})
  })
})

describe('sourceBudgets', () => {
  it('reports used vs available and over-budget', () => {
    const chosen = { athletics: 'class:Barbarian|PHB' }
    const [barb] = sourceBudgets(chosen, sources)
    expect(barb).toMatchObject({ count: 2, used: 1, over: false })
  })
})

function loadedClass(
  name: string,
  skills: SkillChoice[],
  multi?: SkillChoice[],
): LoadedClass {
  return {
    entry: {
      name,
      source: 'PHB',
      hd: { number: 1, faces: 8 },
      classFeatures: [],
      startingProficiencies: { skills },
      multiclassing: multi ? { proficienciesGained: { skills: multi } } : undefined,
    },
    file: {},
  }
}

const bg: PlayableBackground = {
  featGrants: [],
  key: 'acolyte|PHB',
  name: 'Acolyte',
  source: 'PHB',
  edition: 'classic',
  skillProficiencies: [{ insight: true, religion: true }],
  abilityOptions: [],
  storyTables: [],
  entries: [],
}

const race: PlayableRace = {
  featGrants: [],
  key: 'half-elf|PHB',
  name: 'Half-Elf',
  baseName: 'Half-Elf',
  source: 'PHB',
  abilityOptions: [],
  skillProficiencies: [{ choose: { from: ['stealth', 'arcana'], count: 2 } }],
}

describe('buildSkillSources', () => {
  it('collects background, first-class, multiclass, and race grants in order', () => {
    const character = createCharacter('Tester')
    character.classes = [
      { name: 'Barbarian', source: 'PHB', level: 3 },
      { name: 'Rogue', source: 'PHB', level: 2 },
    ]
    const classByKey = new Map<string, LoadedClass>([
      [
        'Barbarian|PHB',
        loadedClass('Barbarian', [
          { choose: { from: ['athletics', 'perception'], count: 1 } },
        ]),
      ],
      [
        'Rogue|PHB',
        loadedClass('Rogue', [], [{ choose: { from: ['stealth'], count: 1 } }]),
      ],
    ])
    const built = buildSkillSources(character, classByKey, bg, race)
    expect(built.map((s) => s.tag)).toEqual([
      'bg',
      classSourceTag('Barbarian', 'PHB'),
      classSourceTag('Rogue', 'PHB'),
      'race',
    ])
    expect(built[1].label).toBe('Class · Barbarian')
    expect(built[2].label).toBe('Multiclass · Rogue')
    expect(built.map((s) => s.kind)).toEqual([
      'background',
      'class',
      'multiclass',
      'race',
    ])
  })

  it('skips unknown classes and grantless sources', () => {
    const character = createCharacter('Tester')
    character.classes = [{ name: 'Ghost', source: 'HB', level: 1 }]
    const built = buildSkillSources(character, new Map())
    expect(built).toEqual([])
    // A background or race granting no skill is no source either.
    const bare = { ...bg, skillProficiencies: [{ anyStandard: 2 }] }
    expect(
      buildSkillSources(character, new Map(), bare, { ...race, skillProficiencies: [] }),
    ).toEqual([])
  })

  it('reads the skills a background grants from its data', () => {
    const character = createCharacter('Tester')
    // Fixed skills, as a 2014 background lists them.
    expect(buildSkillSources(character, new Map(), bg)).toEqual([
      {
        tag: 'bg',
        label: 'Background · Acolyte',
        kind: 'background',
        fixed: ['insight', 'religion'],
        choices: [],
      },
    ])
    // A choice of skills, its count 1 when the data leaves it out.
    const scholar: PlayableBackground = {
      ...bg,
      name: 'Cloistered Scholar',
      skillProficiencies: [
        { history: true, choose: { from: ['arcana', 'nature', 'religion'] } },
      ],
    }
    const [source] = buildSkillSources(character, new Map(), scholar)
    expect(source.fixed).toEqual(['history'])
    expect(source.choices).toEqual([{ count: 1, from: ['arcana', 'nature', 'religion'] }])
  })
})

describe('skillRows', () => {
  it('marks fixed, chosen, and manual proficiencies with modifiers', () => {
    const character = createCharacter('Tester')
    character.grantPicks = {
      skill: {
        athletics: classSourceTag('Barbarian', 'PHB'),
        arcana: 'manual',
      },
    }
    const rows = skillRows(character, sources)
    const insight = rows.find((r) => r.key === 'insight')!
    expect(insight.proficient).toBe(true)
    expect(insight.locked).toBe(true)
    const arcana = rows.find((r) => r.key === 'arcana')!
    expect(arcana.nonStandard).toBe(true)
    const acrobatics = rows.find((r) => r.key === 'acrobatics')!
    expect(acrobatics.proficient).toBe(false)
  })
})

describe('pickSkill', () => {
  it('charges a skill to the named source and takes it back on a second call', () => {
    const once = pickSkill({}, 'athletics', 'class:Barbarian|PHB')
    expect(once).toEqual({ athletics: 'class:Barbarian|PHB' })
    expect(pickSkill(once, 'athletics', 'class:Barbarian|PHB')).toEqual({})
  })
})

describe('grantedLine', () => {
  it('lists each fixed grant with its source and skips repeats', () => {
    const twice: SkillSource[] = [
      ...sources,
      {
        tag: 'race',
        label: 'Race · Elf',
        kind: 'race',
        fixed: ['insight', 'perception'],
        choices: [],
      },
    ]
    expect(grantedLine(twice)).toEqual([
      { label: 'Insight', source: 'Background' },
      { label: 'Religion', source: 'Background' },
      { label: 'Perception', source: 'Race' },
    ])
  })

  it('collapses a grant of every skill into one entry', () => {
    const all = SKILLS.map((s) => s.key)
    const boon: SkillSource = {
      tag: 'feat:x',
      label: 'Feat · Boon of Skill',
      kind: 'feat',
      fixed: all,
      choices: [],
    }
    expect(grantedLine([boon])).toEqual([
      { label: 'All skills', source: 'Boon of Skill' },
    ])
  })
})

describe('skillCards', () => {
  const character = createCharacter('Tester')

  it('lists the whole allowed set of a card with its picks left', () => {
    const rows = skillRows(character, sources)
    const [card] = skillCards(character, sources, rows)
    expect(card).toMatchObject({ count: 2, used: 0, left: 2, over: false, picks: [] })
    expect(card.chips.map((c) => c.value)).toEqual([
      'animal handling',
      'athletics',
      'intimidation',
      'perception',
    ])
    expect(card.chips.every((c) => c.state === 'available')).toBe(true)
  })

  it('marks picked, full and taken chips and counts what is left', () => {
    const c = createCharacter('Tester')
    c.grantPicks = {
      skill: {
        athletics: 'class:Barbarian|PHB',
        perception: 'class:Barbarian|PHB',
      },
    }
    const [card] = skillCards(c, sources, skillRows(c, sources))
    expect(card).toMatchObject({ used: 2, left: 0 })
    const states = Object.fromEntries(card.chips.map((x) => [x.value, x.state]))
    expect(states).toEqual({
      'animal handling': 'full',
      athletics: 'picked',
      intimidation: 'full',
      perception: 'picked',
    })
  })

  it('disables a skill granted elsewhere and names who covers it', () => {
    const c = createCharacter('Tester')
    c.grantPicks = { skill: { athletics: 'bg' } }
    const withBg: SkillSource[] = [
      {
        tag: 'bg',
        label: 'Background · Soldier',
        kind: 'background',
        fixed: [],
        choices: [{ count: 1, from: ['athletics'] }],
      },
      sources[1],
      {
        tag: 'race',
        label: 'Race · Elf',
        kind: 'race',
        fixed: ['perception'],
        choices: [],
      },
    ]
    const cards = skillCards(c, withBg, skillRows(c, withBg))
    const barb = cards.find((x) => x.kind === 'class')!
    const ath = barb.chips.find((x) => x.value === 'athletics')!
    expect(ath).toMatchObject({ state: 'taken', takenBy: 'Background' })
    const per = barb.chips.find((x) => x.value === 'perception')!
    expect(per).toMatchObject({ state: 'taken', takenBy: 'Race' })
  })

  it('shows the modifier with proficiency and flags an overspent card', () => {
    const c = createCharacter('Tester')
    c.abilities.str.base = 14
    c.grantPicks = {
      skill: {
        athletics: 'class:Barbarian|PHB',
        perception: 'class:Barbarian|PHB',
        intimidation: 'class:Barbarian|PHB',
      },
    }
    const [card] = skillCards(c, sources, skillRows(c, sources))
    expect(card).toMatchObject({ over: true, left: 0 })
    // +2 Strength and +2 proficiency at level 1 (athletics is proficient already).
    expect(card.chips.find((x) => x.value === 'athletics')?.hint).toBe('+4')
  })

  it('unions two choose blocks of one source and skips sources with no choice', () => {
    const two: SkillSource = {
      tag: 'bg',
      label: 'Background · Odd',
      kind: 'background',
      fixed: [],
      choices: [
        { count: 1, from: ['arcana'] },
        { count: 1, from: ['history'] },
      ],
    }
    const fixedOnly: SkillSource = { ...sources[0], tag: 'race', kind: 'race' }
    const cards = skillCards(character, [two, fixedOnly], skillRows(character, [two]))
    expect(cards).toHaveLength(1)
    expect(cards[0].count).toBe(2)
    expect(cards[0].chips.map((x) => x.value)).toEqual(['arcana', 'history'])
  })
})

describe('otherPicks', () => {
  it('returns manual and orphan picks, flagging the orphans', () => {
    const chosen = {
      stealth: 'manual',
      arcana: 'legacy',
      athletics: 'class:Barbarian|PHB',
    }
    expect(otherPicks(chosen, sources)).toEqual([
      { skill: 'stealth', tag: 'manual', orphan: false },
      { skill: 'arcana', tag: 'legacy', orphan: true },
    ])
  })
})

describe('a budget shared with another kind of pick', () => {
  const skilled: SkillSource = {
    tag: 'feat:slot',
    label: 'Feat · Skilled',
    kind: 'feat',
    fixed: [],
    choices: [{ count: 3, from: ['arcana', 'history', 'insight'] }],
    shares: ['tool'],
  }

  it('counts the tools picked against the skills left', () => {
    const c = createCharacter('Tester')
    c.grantPicks = {
      skill: { arcana: 'feat:slot' },
      tool: { lute: 'feat:slot', 'dice set': 'feat:slot' },
    }
    const [card] = skillCards(c, [skilled], skillRows(c, [skilled]))
    expect(card).toMatchObject({ count: 3, used: 3, left: 0, kinds: ['skill', 'tool'] })
    expect(card.note).toBe('Shared with your tool picks, in Proficiencies.')
    // The skill itself is still picked; the others are full.
    expect(Object.fromEntries(card.chips.map((x) => [x.value, x.state]))).toEqual({
      arcana: 'picked',
      history: 'full',
      insight: 'full',
    })
  })
})
