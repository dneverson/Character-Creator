import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import type { ResolvedFeatSlot } from '../character/feats'
import { abilityQuantities } from './abilities'
import { collectSources } from './sources'
import { grantBlocks } from './grantBlocks'
import { type LoadedClass } from '../data/class'
import { build, deps, FIGHTER, ITEMS, loadedClass, stack } from '../test/derivedFixtures'
import { makeItem } from '../test/itemFixtures'
import { sumLines } from './types'

const feature = (name: string, className: string, level: number, source = 'PHB') => ({
  name,
  source,
  className,
  classSource: source,
  level,
  entries: [],
})

const withSaves = (base: LoadedClass, saves: string[]): LoadedClass => ({
  ...base,
  entry: { ...base.entry, proficiency: saves },
})

const fighter = withSaves(FIGHTER, ['str', 'con'])

const cloak = makeItem({
  name: 'Cloak of Protection',
  magic: true,
  bonuses: [{ what: 'saving throws', value: '+1' }],
  attunement: { required: true, optional: false, classes: [] },
})

describe('ability quantities', () => {
  it('add up to the total, line by line', () => {
    const c = build('Fighter', 1, { str: 15, dex: 12 }, [])
    c.race = {
      name: 'Human',
      baseName: 'Human',
      source: 'PHB',
      abilityFixed: { str: 1 },
      abilityChoices: {},
    }
    c.abilities = { ...c.abilities, str: { base: 15, other: 2 } }
    const sheet = deriveSheet(c, deps([fighter]))
    const str = sheet.abilities.str
    expect(str.value).toBe(sheet.totals.str)
    expect(str.value).toBe(18)
    expect(str.lines.map((l) => [l.label, l.amount])).toEqual([
      ['Base score', 15],
      ['Species', 1],
      ['Other Strength bonus', 2],
    ])
    expect(sumLines(sheet.abilities.dex.lines)).toBe(12)
  })

  it('flag a species increase the species does not allow, and still count it', () => {
    const c = build('Fighter', 1, { str: 15 }, [])
    c.race = {
      name: 'Human',
      baseName: 'Human',
      source: 'PHB',
      abilityFixed: { str: 2 },
      abilityChoices: {},
    }
    const human = {
      key: 'human|phb',
      name: 'Human',
      baseName: 'Human',
      source: 'PHB',
      speed: 30,
      abilityOptions: [
        {
          fixed: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
          amounts: [],
          from: [],
        },
      ],
      featGrants: [],
    }
    const sheet = deriveSheet(c, { ...deps([fighter]), race: human })
    expect(sheet.abilities.str.value).toBe(17)
    expect(sheet.abilities.str.lines.at(-1)).toMatchObject({
      label: 'Species',
      status: 'flag',
      op: 'note',
      why: 'Human allows +1 to every ability score; you entered +2 Strength - allowed with DM approval.',
    })
  })
})

describe('saving throws', () => {
  it('add the proficiency bonus for the first class only', () => {
    const c = build('Fighter', 5, { str: 16, wis: 14 }, [])
    c.classes = [...c.classes, { name: 'Wizard', source: 'PHB', level: 1 }]
    const wizard = withSaves(loadedClass('Wizard', [], []), ['int', 'wis'])
    const { saves } = deriveSheet(c, deps([fighter, wizard]))
    expect(saves.str).toMatchObject({ proficient: true })
    expect(saves.str.total.value).toBe(3 + 3)
    expect(saves.wis.proficient).toBe(false)
    expect(saves.wis.total.value).toBe(2)
    expect(saves.str.total.lines.map((l) => l.label)).toEqual([
      'Strength',
      'Proficiency bonus',
    ])
  })

  it('count an attuned Cloak of Protection and show an unattuned one as inactive', () => {
    const items = [...ITEMS, cloak]
    const worn = build('Fighter', 1, { con: 14 }, [
      stack('Cloak of Protection', { attuned: true }),
    ])
    const on = deriveSheet(worn, deps([fighter], items))
    expect(on.saves.dex.total.value).toBe(1)
    const off = build('Fighter', 1, { con: 14 }, [stack('Cloak of Protection')])
    const without = deriveSheet(off, deps([fighter], items))
    expect(without.saves.dex.total.value).toBe(0)
    expect(without.saves.dex.total.lines.at(-1)).toMatchObject({ status: 'inactive' })
  })

  it('give every proficiency with Diamond Soul and add the Charisma modifier in an aura', () => {
    const monk = loadedClass('Monk', [], [], {
      classFeature: [feature('Diamond Soul', 'Monk', 14)],
    })
    const c = build('Monk', 14, { cha: 14 }, [])
    const sheet = deriveSheet(c, deps([withSaves(monk, ['str', 'dex'])]))
    expect(Object.values(sheet.saves).every((s) => s.proficient)).toBe(true)

    const paladin = loadedClass('Paladin', [], [], {
      classFeature: [feature('Aura of Protection', 'Paladin', 6)],
    })
    const p = deriveSheet(build('Paladin', 6, { cha: 8 }, []), deps([paladin]))
    // Charisma 8 is -1, and the aura adds at least +1.
    expect(p.saves.str.total.value).toBe(1)
    const strong = deriveSheet(build('Paladin', 6, { cha: 16 }, []), deps([paladin]))
    expect(strong.saves.dex.total.value).toBe(3)
  })
})

describe('item bonuses to ability checks', () => {
  const stone = makeItem({
    name: 'Stone of Good Luck',
    source: 'DMG',
    magic: true,
    bonuses: [
      { what: 'ability checks', value: '+1' },
      { what: 'saving throws', value: '+1' },
    ],
    attunement: { required: true, optional: false, classes: [] },
  })
  const sheetWith = (attuned: boolean) => {
    const c = build('Fighter', 1, { dex: 14, wis: 12 }, [
      stack('Stone of Good Luck', { source: 'DMG', attuned }),
    ])
    c.grantPicks = { skill: { perception: 'manual' } }
    return deriveSheet(c, deps([fighter], [...ITEMS, stone]))
  }

  it('count in initiative, every skill and every passive, one line each', () => {
    const sheet = sheetWith(true)
    const line = { label: 'Stone of Good Luck', amount: 1, status: 'applied' }
    expect(sheet.combat.initiative.value).toBe(3)
    expect(sheet.combat.initiative.lines).toContainEqual(expect.objectContaining(line))
    const stealth = sheet.skills.find((s) => s.key === 'stealth')
    expect(stealth?.total.value).toBe(3)
    expect(stealth?.total.lines.at(-1)).toMatchObject({
      ...line,
      how: '+1 to ability checks',
    })
    const passive = sheet.combat.passives.find((p) => p.key === 'perception')
    expect(passive?.score.lines).toContainEqual(expect.objectContaining(line))
  })

  it('keep each passive at 10 plus its skill total', () => {
    for (const attuned of [true, false]) {
      const sheet = sheetWith(attuned)
      for (const passive of sheet.combat.passives) {
        const skill = sheet.skills.find((s) => s.key === passive.key)
        expect(passive.score.value).toBe(10 + (skill?.total.value ?? 0))
      }
    }
  })

  it('need the attunement the item asks for', () => {
    const sheet = sheetWith(false)
    expect(sheet.combat.initiative.value).toBe(2)
    expect(sheet.combat.initiative.lines).toContainEqual(
      expect.objectContaining({
        label: 'Stone of Good Luck',
        status: 'inactive',
        why: 'Needs attunement, and you are not attuned.',
      }),
    )
  })
})

describe('Iron Mind and Elegant Courtier', () => {
  const ironMind = (source: 'XGE' | 'XPHB') =>
    withSaves(
      loadedClass('Ranger', [], [], {
        subclassFeature: [
          {
            name: 'Iron Mind',
            source,
            className: 'Ranger',
            classSource: 'PHB',
            subclassShortName: 'Gloom Stalker',
            subclassSource: source,
            level: 7,
            entries: [],
          },
        ],
      }),
      ['str', 'dex'],
    )
  const cleric = withSaves(loadedClass('Cleric', [], []), ['wis', 'cha'])
  const gloomStalker = (level: number, source: 'XGE' | 'XPHB' = 'XGE') => ({
    name: 'Ranger',
    source: 'PHB',
    level,
    subclass: { name: 'Gloom Stalker', shortName: 'Gloom Stalker', source },
  })
  const tag = 'class:Ranger|PHB|Iron Mind'

  it('give proficiency in Wisdom saves to a character without it', () => {
    const c = build('Ranger', 7, {}, [])
    c.classes = [gloomStalker(7)]
    const sheet = deriveSheet(c, deps([ironMind('XGE')]))
    expect(sheet.saves.wis.proficient).toBe(true)
    expect(
      sheet.proficiencies.listing.save.find((l) => l.value === 'Wisdom'),
    ).toMatchObject({ sources: [{ label: 'Ranger, Gloom Stalker' }] })
    expect(sheet.picks.find((p) => p.tag === tag)).toBeUndefined()
  })

  it('waits for level 7', () => {
    const c = build('Ranger', 6, {}, [])
    c.classes = [gloomStalker(6)]
    expect(deriveSheet(c, deps([ironMind('XGE')])).saves.wis.proficient).toBe(false)
  })

  it('offer Intelligence or Charisma when Wisdom is already had, and give the pick', () => {
    const c = build('Cleric', 1, {}, [])
    c.classes = [{ name: 'Cleric', source: 'PHB', level: 1 }, gloomStalker(7, 'XPHB')]
    const open = deriveSheet(c, deps([cleric, ironMind('XPHB')]))
    const card = open.picks.find((p) => p.tag === tag)
    expect(card).toMatchObject({ noun: 'saving throws', count: 1, left: 1 })
    expect(card?.chips.map((chip) => [chip.value, chip.state])).toEqual([
      ['cha', 'taken'],
      ['int', 'available'],
    ])
    expect(open.saves.int.proficient).toBe(false)
    expect(open.choicesOpen).toBe(1)
    expect(open.checklist.items.find((i) => i.id === 'saves')).toMatchObject({
      section: 'proficiencies',
      label: '1 saving throw choice to make',
    })

    c.grantPicks = { save: { int: tag } }
    const picked = deriveSheet(c, deps([cleric, ironMind('XPHB')]))
    expect(picked.saves.int.proficient).toBe(true)
    expect(picked.picks.find((p) => p.tag === tag)?.left).toBe(0)
    expect(picked.checklist.items.find((i) => i.id === 'saves')).toBeUndefined()
  })

  it('drop a pick once the choice is no longer offered', () => {
    const c = build('Ranger', 7, {}, [])
    c.classes = [gloomStalker(7)]
    c.grantPicks = { save: { int: tag } }
    const sheet = deriveSheet(c, deps([ironMind('XGE')]))
    expect(sheet.saves.wis.proficient).toBe(true)
    expect(sheet.saves.int.proficient).toBe(false)
  })

  it('count Resilient (Wisdom) as already had', () => {
    const c = build('Ranger', 7, {}, [])
    c.classes = [gloomStalker(7)]
    const sources = collectSources(c, deps([ironMind('XGE')]))
    const withResilient = {
      ...sources,
      feats: [
        {
          feat: {
            ...sources.feats[0]?.feat,
            key: 'resilient|phb',
            name: 'Resilient',
            label: 'Resilient',
            baseName: 'Resilient',
            source: 'PHB',
            edition: 'classic' as const,
            prerequisites: [],
            abilityOptions: [],
            repeatable: false,
            skills: { fixed: [], choices: [] },
            hp: { perLevel: 0, flat: 0 },
            entries: [],
            savingThrowProficiencies: [
              { choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } },
            ],
          },
          source: {
            kind: 'feat' as const,
            tag: 'feat:Resilient|PHB',
            label: 'Resilient',
          },
          increases: { wis: 1 },
        },
      ],
    }
    const blocks = grantBlocks(withResilient)
    const iron = blocks.find((b) => b.feature === 'Iron Mind')
    expect(iron?.read.alternatives[0].picks[0]?.from.map((v) => v.key)).toEqual([
      'int',
      'cha',
    ])
  })
})

describe('skill totals', () => {
  it('add the proficiency bonus with its source and the ability modifier', () => {
    const c = build('Fighter', 5, { str: 16 }, [])
    c.grantPicks = { skill: { athletics: 'manual' } }
    const skill = deriveSheet(c, deps([fighter])).skills.find(
      (s) => s.key === 'athletics',
    )
    expect(skill?.total.value).toBe(skill?.modifier)
    expect(skill?.total.lines.map((l) => l.label)).toEqual([
      'Ability modifier',
      'Proficiency bonus',
    ])
    expect(skill?.total.lines[1].source.kind).toBe('manual')
  })

  it('add half the proficiency bonus with Jack of All Trades, to other skills only', () => {
    const bard = loadedClass('Bard', [], [], {
      classFeature: [feature('Jack of All Trades', 'Bard', 2)],
    })
    const c = build('Bard', 5, { dex: 10 }, [])
    c.grantPicks = { skill: { stealth: 'manual' } }
    const skills = deriveSheet(c, deps([bard])).skills
    const stealth = skills.find((s) => s.key === 'stealth')
    const arcana = skills.find((s) => s.key === 'arcana')
    expect(stealth?.total.value).toBe(3)
    expect(arcana?.total.value).toBe(1)
    expect(arcana?.total.lines.at(-1)).toMatchObject({
      label: 'Jack of All Trades',
      status: 'applied',
    })
    expect(stealth?.total.lines.at(-1)).toMatchObject({ status: 'inactive' })
  })

  it('add Remarkable Athlete to physical abilities only', () => {
    const champion: LoadedClass = loadedClass('Fighter', [], [], {
      subclassFeature: [
        {
          ...feature('Remarkable Athlete', 'Fighter', 7),
          subclassShortName: 'Champion',
          subclassSource: 'PHB',
        },
      ],
    })
    const c = build('Fighter', 7, {}, [])
    c.classes = [
      {
        ...c.classes[0],
        subclass: { name: 'Champion', shortName: 'Champion', source: 'PHB' },
      },
    ]
    const skills = deriveSheet(c, deps([champion])).skills
    expect(skills.find((s) => s.key === 'athletics')?.total.value).toBe(2)
    expect(skills.find((s) => s.key === 'arcana')?.total.value).toBe(0)
  })
})

describe('ability quantities from feats', () => {
  it('give each feat or improvement its own line, tied to the total', () => {
    const c = build('Fighter', 4, { str: 15 }, [])
    const d = deps([fighter])
    const base = collectSources(c, d)
    const slot = (id: string, label: string, str: number): ResolvedFeatSlot =>
      ({
        slot: { id, label },
        feat: { label },
        increases: { str },
      }) as ResolvedFeatSlot
    const sources = {
      ...base,
      summary: {
        ...base.summary,
        slots: [slot('asi-4', 'Level 4', 1), slot('asi-8', 'Level 8', 1)],
        abilityBonus: { str: 2 },
      },
    }
    const abilities = abilityQuantities(c, sources)
    expect(abilities.str.value).toBe(17)
    expect(abilities.str.lines.map((l) => l.label)).toEqual([
      'Base score',
      'Level 4',
      'Level 8',
    ])
    expect(abilities.str.lines[1].source).toMatchObject({
      kind: 'feat',
      tag: 'feat:asi-4',
    })
  })
})
