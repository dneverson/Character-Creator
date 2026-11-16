import { describe, expect, it } from 'vitest'
import { deriveSheet } from '.'
import type { PlayableRace } from '../data/race'
import type { Reward } from '../data/rewards'
import { build, deps, FIGHTER } from '../test/derivedFixtures'

const reward = (name: string, extra: Partial<Reward> = {}): Reward => ({
  key: `${name}|DMG`,
  name,
  source: 'DMG',
  type: 'Boon',
  edition: 'classic',
  entries: [`${name} text.`],
  ...extra,
})

const REWARDS = [
  reward('Boon of Fortitude'),
  reward('Boon of Speed'),
  reward('Boon of Truesight'),
  reward('Boon of Luck'),
  reward('Boon of Recovery'),
  reward('Arcane Study Charm', {
    source: 'XDMG',
    key: 'Arcane Study Charm|XDMG',
    type: 'Charm',
    additionalSpells: [{ innate: { _: { limited: { '1': ['identify|xphb'] } } } }],
  }),
]

const human: PlayableRace = {
  key: 'human|phb',
  name: 'Human',
  baseName: 'Human',
  source: 'PHB',
  baseSource: 'PHB',
  speed: 30,
  abilityOptions: [],
  featGrants: [],
}

/** A fighter 4 with the rewards named, and the rewards of the books loaded. */
function sheetWith(...names: string[]) {
  const c = build('Fighter', 4, {}, [])
  c.rewards = names.map((name) => {
    const found = REWARDS.find((r) => r.name === name)
    return { name, source: found?.source ?? 'DMG' }
  })
  const d = { ...deps([FIGHTER]), race: human, rewards: REWARDS }
  return {
    sheet: deriveSheet(c, d),
    without: deriveSheet({ ...c, rewards: undefined }, d),
  }
}

describe('rewards', () => {
  it('apply their rules through the rule tables', () => {
    const { sheet, without } = sheetWith(
      'Boon of Fortitude',
      'Boon of Speed',
      'Boon of Truesight',
    )
    expect(sheet.hp.value - without.hp.value).toBe(40)
    expect(sheet.speed.value - without.speed.value).toBe(30)
    expect(sheet.senses.find((s) => s.key === 'truesight')?.range.value).toBe(60)
  })

  it('show on the Features tab, with the counters of their uses on their rows', () => {
    const { sheet } = sheetWith('Boon of Luck', 'Arcane Study Charm')
    const rows = sheet.features.filter((f) => f.kind === 'Reward')
    expect(rows.map((r) => [r.name, r.from, r.anchor])).toEqual([
      ['Boon of Luck', 'Boon', 'reward:Boon of Luck|DMG'],
      ['Arcane Study Charm', 'Charm', 'reward:Arcane Study Charm|XDMG'],
    ])
    const luck = sheet.resources.find((r) => r.anchor === 'reward:Boon of Luck|DMG')
    expect(luck).toMatchObject({ max: 1, recharge: 'short' })
    // A charm's spell is cast once and then the charm is gone: no rest restores it.
    const charm = sheet.resources.find((r) => r.label === 'identify')
    expect(charm).toMatchObject({
      max: 1,
      recharge: 'none',
      from: 'Arcane Study Charm',
      anchor: 'reward:Arcane Study Charm|XDMG',
    })
  })

  it('count a use that a long rest restores', () => {
    const { sheet } = sheetWith('Boon of Recovery')
    expect(sheet.resources.find((r) => r.label === 'Boon of Recovery')).toMatchObject({
      max: 1,
      recharge: 'long',
    })
  })

  it('give nothing the loaded books do not have', () => {
    const c = build('Fighter', 1, {}, [])
    c.rewards = [{ name: 'Gone', source: 'DMG' }]
    expect(
      deriveSheet(c, deps([FIGHTER])).features.some((f) => f.kind === 'Reward'),
    ).toBe(false)
  })
})
