import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import { collectSources } from './sources'
import { armorClass } from './armorClass'
import { proficiencies } from './proficiencies'
import { characterAbilityTotals } from '../character/derive'
import type { Character } from '../character/model'
import {
  BARBARIAN,
  FIGHTER,
  WIZARD,
  build,
  deps,
  featOf,
  loadedClass,
  stack,
} from '../test/derivedFixtures'
import { sumLines } from './types'

const ac = (c: Character, classes = [FIGHTER]) => deriveSheet(c, deps(classes)).ac
const flags = (q: ReturnType<typeof ac>) =>
  q.lines.filter((l) => l.status === 'flag').map((l) => l.id)

describe('armor class', () => {
  it('is 10 plus Dexterity with nothing worn', () => {
    expect(ac(build('Fighter', 1, { dex: 14 }, [])).value).toBe(12)
  })

  it('adds the whole Dexterity to light armor', () => {
    const q = ac(build('Fighter', 1, { dex: 16 }, [stack('Leather Armor')]))
    expect(q.value).toBe(14)
  })

  it('caps Dexterity at 2 in medium armor and drops it in heavy armor', () => {
    expect(ac(build('Fighter', 1, { dex: 18 }, [stack('Chain Shirt')])).value).toBe(15)
    expect(
      ac(build('Fighter', 1, { dex: 18, str: 15 }, [stack('Plate Armor')])).value,
    ).toBe(18)
  })

  it('adds a shield and the two lines sum to the value', () => {
    const q = ac(build('Fighter', 1, { str: 15 }, [stack('Chain Mail'), stack('Shield')]))
    expect(q.value).toBe(18)
    expect(sumLines(q.lines)).toBe(18)
  })

  it('flags a Strength shortfall and keeps the armor class', () => {
    const q = ac(build('Fighter', 1, { str: 10 }, [stack('Chain Mail')]))
    expect(q.value).toBe(16)
    expect(flags(q)).toContain('ac|flag|strength')
  })

  it('flags armor without proficiency but still counts it', () => {
    const q = ac(build('Wizard', 1, { str: 15 }, [stack('Plate Armor')]), [WIZARD])
    expect(q.value).toBe(18)
    expect(flags(q)).toContain('ac|flag|armor-proficiency')
  })

  it('lets a Barbarian use Unarmored Defense with a shield', () => {
    const c = build('Barbarian', 1, { dex: 14, con: 16 }, [stack('Shield')])
    expect(ac(c, [BARBARIAN]).value).toBe(10 + 2 + 3 + 2)
  })

  it('keeps armor and shield counting only when equipped', () => {
    const c = build('Fighter', 1, { str: 15 }, [stack('Chain Mail', { equipped: false })])
    expect(ac(c).value).toBe(10)
  })

  it('shows an unattuned shield bonus as inactive', () => {
    const c = build('Fighter', 1, {}, [stack('+1 Shield')])
    const q = ac(c)
    expect(q.value).toBe(12)
    const bonus = q.lines.find((l) => l.status === 'inactive' && l.amount === 1)
    expect(bonus?.why).toMatch(/attun/i)
    const attuned = ac(build('Fighter', 1, {}, [stack('+1 Shield', { attuned: true })]))
    expect(attuned.value).toBe(13)
  })

  it('flags two suits of armor', () => {
    const q = ac(
      build('Fighter', 1, { str: 15 }, [stack('Chain Mail'), stack('Leather Armor')]),
    )
    expect(flags(q)).toContain('ac|flag|two-armors')
  })

  it('adds the Defense feat only while wearing armor', () => {
    const c = build('Fighter', 1, { str: 15 }, [stack('Chain Mail')])
    const sources = {
      ...collectSources(c, deps([FIGHTER])),
      feats: [
        {
          feat: featOf('Defense', 'XPHB'),
          source: { kind: 'feat' as const, tag: 'feat:x', label: 'Defense' },
        },
      ],
    }
    const totals = characterAbilityTotals(c)
    const q = armorClass(sources, totals, proficiencies(sources))
    expect(q.value).toBe(17)
    const bare = {
      ...sources,
      character: { ...c, equipment: { ...c.equipment, items: [] } },
    }
    const unarmored = armorClass({ ...bare, items: [] }, totals, proficiencies(bare))
    expect(unarmored.value).toBe(10)
  })

  it('takes the Medium Armor Master Dexterity cap of 3 at Dexterity 16', () => {
    const c = build('Fighter', 1, { dex: 16 }, [stack('Chain Shirt')])
    const sources = {
      ...collectSources(c, deps([FIGHTER])),
      feats: [
        {
          feat: featOf('Medium Armor Master', 'XPHB'),
          source: { kind: 'feat' as const, tag: 'feat:x', label: 'Medium Armor Master' },
        },
      ],
    }
    const q = armorClass(sources, characterAbilityTotals(c), proficiencies(sources))
    expect(q.value).toBe(13 + 3)
  })

  it('gives a Tortle 17 flat and picks the highest formula, greying the others', () => {
    const c = build('Fighter', 1, { dex: 10 }, [stack('Leather Armor')])
    c.race = {
      name: 'Tortle',
      baseName: 'Tortle',
      source: 'MPMM',
      abilityFixed: {},
      abilityChoices: {},
    }
    const q = ac(c)
    expect(q.value).toBe(17)
    expect(q.lines.some((l) => l.op === 'alt' || l.status === 'inactive')).toBe(true)
  })

  it('uses the highest of two unarmored formulas', () => {
    const c = build('Barbarian', 1, { dex: 14, con: 10 }, [])
    expect(ac(c, [BARBARIAN]).value).toBe(12)
    expect(ac(build('Barbarian', 1, { dex: 10, con: 18 }, []), [BARBARIAN]).value).toBe(
      14,
    )
  })

  it('does not apply a feature the class does not have yet', () => {
    const noFeature = loadedClass('Barbarian', [], [])
    expect(ac(build('Barbarian', 1, { dex: 10, con: 18 }, []), [noFeature]).value).toBe(
      10,
    )
  })
})
