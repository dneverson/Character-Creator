import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import { collectSources } from './sources'
import { attackRows } from './attacks'
import { proficiencies } from './proficiencies'
import { characterAbilityTotals } from '../character/derive'
import type { Character } from '../character/model'
import {
  FIGHTER,
  WIZARD,
  build,
  deps,
  featOf,
  loadedClass,
  stack,
} from '../test/derivedFixtures'
import type { LoadedClass } from '../data/class'
import { sumLines } from './types'

const rows = (c: Character, classes: LoadedClass[] = [FIGHTER]) =>
  deriveSheet(c, deps(classes)).attacks

const style = (name: string, source: string) => ({
  feat: featOf(name, source),
  source: { kind: 'feat' as const, tag: `feat:${name}`, label: name },
})

/** Attack rows of a character holding the named feats. */
function withFeats(c: Character, feats: ReturnType<typeof style>[]) {
  const d = deps([FIGHTER])
  const sources = { ...collectSources(c, d), feats }
  const totals = characterAbilityTotals(c)
  return attackRows(sources, totals, 2, proficiencies(sources), [])
}

describe('attacks', () => {
  it('adds Strength and proficiency to a melee weapon', () => {
    const [sword] = rows(build('Fighter', 1, { str: 16 }, [stack('Longsword')]))
    expect(sword.name).toBe('Longsword')
    expect(sword.toHit.value).toBe(5)
    expect(sword.damage.bonus.value).toBe(3)
    expect(sword.damage.dice).toBe('1d8')
    expect(sword.twoHanded?.dice).toBe('1d10')
    expect(sumLines(sword.toHit.lines)).toBe(sword.toHit.value)
  })

  it('uses the better of Strength and Dexterity for a finesse weapon, saying why', () => {
    const [rapier] = rows(build('Fighter', 1, { str: 10, dex: 18 }, [stack('Rapier')]))
    expect(rapier.toHit.value).toBe(2 + 4)
    expect(rapier.toHit.lines[0].how).toMatch(/Finesse/)
  })

  it('uses Dexterity for a ranged weapon', () => {
    const [bow] = rows(build('Fighter', 1, { str: 10, dex: 14 }, [stack('Longbow')]))
    expect(bow.toHit.value).toBe(4)
    expect(bow.range).toBe('150/600 ft')
  })

  it('adds the Archery bonus to ranged attacks only', () => {
    const c = build('Fighter', 1, { dex: 14 }, [stack('Longbow'), stack('Longsword')])
    const [bow, sword] = withFeats(c, [style('Archery', 'XPHB')])
    expect(bow.toHit.value).toBe(2 + 2 + 2)
    expect(sword.toHit.value).toBe(2)
  })

  it('applies Dueling only with one weapon held', () => {
    const one = build('Fighter', 1, { str: 14 }, [stack('Longsword')])
    expect(withFeats(one, [style('Dueling', 'XPHB')])[0].damage.bonus.value).toBe(4)
    const two = build('Fighter', 1, { str: 14 }, [
      stack('Longsword'),
      stack('Shortsword'),
    ])
    const [sword] = withFeats(two, [style('Dueling', 'XPHB')])
    expect(sword.damage.bonus.value).toBe(2)
    expect(sword.damage.bonus.lines.some((l) => l.status === 'conditional')).toBe(true)
  })

  it('notes Great Weapon Fighting on a two-handed weapon', () => {
    const c = build('Fighter', 1, { str: 14 }, [stack('Greatsword')])
    const [sword] = withFeats(c, [style('Great Weapon Fighting', 'XPHB')])
    expect(sword.notes.join(' ')).toMatch(/Great Weapon Fighting/)
  })

  it('adds a magic weapon bonus to both rolls', () => {
    const [sword] = rows(build('Fighter', 1, { str: 14 }, [stack('+1 Longsword')]))
    expect(sword.toHit.value).toBe(2 + 2 + 1)
    expect(sword.damage.bonus.value).toBe(3)
  })

  it('removes the proficiency bonus and flags a weapon the class does not know', () => {
    const [sword] = rows(build('Wizard', 1, { str: 10 }, [stack('Longsword')]), [WIZARD])
    expect(sword.toHit.value).toBe(0)
    expect(sword.toHit.lines.some((l) => l.status === 'flag')).toBe(true)
  })

  it('has an unarmed strike of 1 plus Strength', () => {
    const attacks = rows(build('Fighter', 1, { str: 14 }, []))
    expect(attacks).toHaveLength(1)
    expect(attacks[0].name).toBe('Unarmed strike')
    expect(attacks[0].damage.dice).toBe('1')
    expect(attacks[0].damage.bonus.value).toBe(2)
    expect(attacks[0].toHit.value).toBe(4)
  })

  it('gives a Monk the Martial Arts die and the better of Strength and Dexterity', () => {
    const monk = loadedClass('Monk', [], ['simple'])
    monk.entry.classTableGroups = [
      {
        colLabels: ['Martial Arts'],
        rows: [[{ type: 'dice', toRoll: [{ number: 1, faces: 6 }] }]],
      },
    ]
    const [unarmed] = rows(build('Monk', 1, { str: 8, dex: 16 }, []), [monk])
    expect(unarmed.damage.dice).toBe('1d6')
    expect(unarmed.damage.bonus.value).toBe(3)
  })

  it('gives an Unarmed Fighting style a d8 with empty hands', () => {
    const c = build('Fighter', 1, { str: 10 }, [])
    const [unarmed] = withFeats(c, [style('Unarmed Fighting', 'XPHB')])
    expect(unarmed.damage.dice).toBe('1d8')
  })

  it('carries an armor proficiency flag onto the attack', () => {
    const c = build('Fighter', 1, {}, [stack('Longsword')])
    const d = deps([FIGHTER])
    const sources = collectSources(c, d)
    const flag = {
      id: 'ac|flag|armor-proficiency',
      label: 'x',
      source: { kind: 'base' as const, tag: 'base', label: '' },
      op: 'note' as const,
      status: 'flag' as const,
    }
    const [sword] = attackRows(
      sources,
      characterAbilityTotals(c),
      2,
      proficiencies(sources),
      [flag],
    )
    expect(sword.toHit.lines.some((l) => l.id.endsWith('armor-proficiency'))).toBe(true)
  })
})
