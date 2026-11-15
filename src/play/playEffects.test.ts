import { describe, expect, it } from 'vitest'
import { deriveSheet, type DerivedSheet } from '../derived'
import { BASE_SOURCE, quantity, type Line, type Quantity } from '../derived/types'
import type { Edition } from '../data/edition'
import { build, deps, FIGHTER, stack } from '../test/derivedFixtures'
import { moveRow } from '../derived/speed'
import { applyPlayEffects } from './playEffects'

const base = (id: string, amount: number): Line => ({
  id,
  label: 'Base',
  source: BASE_SOURCE,
  op: 'base',
  status: 'applied',
  amount,
})

const built = deriveSheet(
  build('Fighter', 5, { str: 16, dex: 14, wis: 12 }, [stack('+1 Longsword')]),
  deps([FIGHTER]),
)

/** The fighter's sheet under one edition, walking 30 ft., with 45 hit points and a spell attack. */
const sheetOf = (edition: Edition, speed = 30): DerivedSheet => ({
  ...built,
  edition,
  speed: quantity([base('speed|walk', speed)]),
  hp: quantity([base('hp|max', 45)]),
  spellStats: [
    {
      id: 'Wizard',
      from: 'Wizard',
      ability: 'int',
      dc: quantity([base('dc', 13)]),
      attack: quantity([base('attack', 5)]),
    },
  ],
})

const play = (exhaustion: number, conditions: string[] = []) => ({
  exhaustion,
  conditions,
})

/** The lines the effects added to a number: those that name exhaustion or a condition. */
const added = (q: Quantity) =>
  q.lines
    .filter((l) => l.source.tag.startsWith('play:'))
    .map((l) => [l.label, l.amount, l.how])

describe('exhaustion in the 2024 rules', () => {
  it('takes 2 per level off every d20 Test, and leaves passives and the DC alone', () => {
    const before = sheetOf('one')
    const after = applyPlayEffects(before, play(3))
    const cut = ['Exhaustion 3', -6, '2 less per level, on every d20 Test']
    expect(added(after.saves.str.total)).toEqual([cut])
    expect(after.saves.str.total.value).toBe(before.saves.str.total.value - 6)
    for (const [i, skill] of after.skills.entries()) {
      expect(skill.total.value).toBe(before.skills[i].total.value - 6)
    }
    expect(added(after.combat.initiative)).toEqual([cut])
    expect(after.attacks.length).toBeGreaterThan(0)
    for (const [i, attack] of after.attacks.entries()) {
      expect(attack.toHit.value).toBe(before.attacks[i].toHit.value - 6)
    }
    expect(after.spellStats[0].attack.value).toBe(-1)
    expect(after.spellStats[0].dc.value).toBe(13)
    expect(after.combat.passives).toEqual(before.combat.passives)
    expect(after.hp.value).toBe(45)
  })

  it('takes 5 ft. per level off the speed, never below 0', () => {
    expect(added(applyPlayEffects(sheetOf('one'), play(2)).speed)).toEqual([
      ['Exhaustion 2', -10, '5 ft. less per level'],
    ])
    expect(applyPlayEffects(sheetOf('one'), play(2)).speed.value).toBe(20)
    expect(applyPlayEffects(sheetOf('one', 15), play(5)).speed.value).toBe(0)
  })

  it('adds nothing at level 0 or at level 6, which is death', () => {
    for (const level of [0, 6]) {
      const after = applyPlayEffects(sheetOf('one'), play(level))
      expect(added(after.speed)).toEqual([])
      expect(added(after.saves.dex.total)).toEqual([])
    }
  })
})

describe('exhaustion in the 2014 rules', () => {
  it('halves the speed from level 2, rounding down', () => {
    expect(applyPlayEffects(sheetOf('classic', 25), play(1)).speed.value).toBe(25)
    const after = applyPlayEffects(sheetOf('classic', 25), play(2))
    expect(added(after.speed)).toEqual([['Exhaustion 2', -13, 'Speed halved']])
    expect(after.speed.value).toBe(12)
  })

  it('halves the hit point maximum from level 4', () => {
    expect(applyPlayEffects(sheetOf('classic'), play(3)).hp.value).toBe(45)
    const after = applyPlayEffects(sheetOf('classic'), play(4))
    expect(added(after.hp)).toEqual([['Exhaustion 4', -23, 'Hit point maximum halved']])
    expect(after.hp.value).toBe(22)
  })

  it('makes the speed 0 at level 5, and takes nothing off a d20 roll', () => {
    const after = applyPlayEffects(sheetOf('classic'), play(5))
    expect(added(after.speed)).toEqual([
      ['Exhaustion 5', -15, 'Speed halved'],
      ['Exhaustion 5', -15, 'Speed 0'],
    ])
    expect(after.speed.value).toBe(0)
    expect(added(after.saves.str.total)).toEqual([])
    expect(added(after.combat.initiative)).toEqual([])
  })
})

describe('conditions that make the speed 0', () => {
  it('names each condition, as each printing words it', () => {
    const grappled = applyPlayEffects(sheetOf('classic'), play(0, ['Grappled']))
    expect(added(grappled.speed)).toEqual([['Grappled', -30, 'Speed becomes 0']])
    expect(grappled.speed.value).toBe(0)
    const stunned = applyPlayEffects(sheetOf('classic'), play(0, ['Stunned']))
    expect(added(stunned.speed)).toEqual([['Stunned', -30, "Can't move, so speed 0"]])
    const restrained = applyPlayEffects(sheetOf('one'), play(0, ['Restrained']))
    expect(added(restrained.speed)).toEqual([['Restrained', -30, 'Speed is 0']])
  })

  it('follows the edition: Stunned stops a 2014 character only', () => {
    expect(applyPlayEffects(sheetOf('one'), play(0, ['Stunned'])).speed.value).toBe(30)
    expect(applyPlayEffects(sheetOf('classic'), play(0, ['Prone'])).speed.value).toBe(30)
  })

  it('shows every cause, the first taking the speed to 0', () => {
    const after = applyPlayEffects(sheetOf('one'), play(1, ['Grappled', 'Unconscious']))
    expect(added(after.speed)).toEqual([
      ['Exhaustion 1', -5, '5 ft. less per level'],
      ['Grappled', -25, 'Speed is 0'],
      ['Unconscious', 0, 'Speed is 0'],
    ])
    expect(after.speed.value).toBe(0)
  })

  it('leaves the sheet as it was with no exhaustion and no such condition', () => {
    const before = sheetOf('one')
    const after = applyPlayEffects(before, play(0, ['Prone']))
    expect(after.speed).toBe(before.speed)
    expect(after.hp).toBe(before.hp)
    expect(after.combat.initiative).toBe(before.combat.initiative)
  })
})

describe('play effects on the other speeds', () => {
  const sheetWith = (edition: Edition): DerivedSheet => {
    const sheet = sheetOf(edition)
    const fly = moveRow('fly', [base('speed|fly|own', 60)], {}, [], sheet.speed.value)
    const climb = moveRow(
      'climb',
      [base('speed|climb|walk', 0)],
      { 'speed|climb|walk': 1 },
      [],
      sheet.speed.value,
    )
    return { ...sheet, speeds: [fly, climb] }
  }

  it('halves a speed of its own and has one equal to walking follow the walking speed', () => {
    const after = applyPlayEffects(sheetWith('classic'), play(2))
    const [fly, climb] = after.speeds
    expect(after.speed.value).toBe(15)
    expect(added(fly.speed)).toEqual([['Exhaustion 2', -30, 'Speed halved']])
    expect(fly.speed.value).toBe(30)
    expect(added(climb.speed)).toEqual([])
    expect(climb.speed.value).toBe(15)
  })

  it('makes every speed 0 while grappled', () => {
    const after = applyPlayEffects(sheetWith('one'), play(0, ['Grappled']))
    expect(after.speeds.map((row) => row.speed.value)).toEqual([0, 0])
  })
})

describe('disadvantage on the checks of a passive score', () => {
  const passive = (sheet: DerivedSheet, key: string) =>
    sheet.combat.passives.find((r) => r.key === key)?.score

  it('takes 5 off every passive score while poisoned, as each printing words it', () => {
    for (const edition of ['classic', 'one'] as const) {
      const before = sheetOf(edition)
      const after = applyPlayEffects(before, play(0, ['Poisoned']))
      for (const key of ['perception', 'investigation', 'insight']) {
        expect(passive(after, key)?.value).toBe((passive(before, key)?.value ?? 0) - 5)
      }
      expect(passive(after, 'perception')?.lines.at(-1)).toMatchObject({
        label: 'Poisoned',
        amount: -5,
        status: 'applied',
      })
    }
  })

  it('shows fear as disadvantage only while its source is in sight', () => {
    const before = sheetOf('classic')
    const after = applyPlayEffects(before, play(0, ['Frightened']))
    expect(passive(after, 'insight')?.value).toBe(passive(before, 'insight')?.value)
    expect(passive(after, 'insight')?.lines.at(-1)).toMatchObject({
      status: 'conditional',
      when: 'Only while the source of your fear is within line of sight.',
    })
  })

  it('takes 5 off from 2014 exhaustion level 1, and counts it once with poison', () => {
    const before = sheetOf('classic')
    const one = applyPlayEffects(before, play(1))
    expect(passive(one, 'perception')?.value).toBe(
      (passive(before, 'perception')?.value ?? 0) - 5,
    )
    const both = applyPlayEffects(before, play(1, ['Poisoned']))
    expect(passive(both, 'perception')?.value).toBe(
      (passive(before, 'perception')?.value ?? 0) - 5,
    )
    expect(passive(both, 'perception')?.lines.at(-1)).toMatchObject({
      label: 'Poisoned',
      status: 'inactive',
      why: 'Advantage or disadvantage counts once, however many give it.',
    })
  })
})
