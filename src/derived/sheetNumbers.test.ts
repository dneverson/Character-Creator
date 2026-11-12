import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import type { ResolvedFeatSlot } from '../character/feats'
import { abilityQuantities } from './abilities'
import { collectSources } from './sources'
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
