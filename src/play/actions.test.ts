import { describe, expect, it } from 'vitest'
import { defaultPlayState, type PlayState } from '../character/model'
import {
  damage,
  gainTemp,
  heal,
  restoreHitDie,
  restorePact,
  restoreSlot,
  restoreUse,
  setConcentration,
  setHitDiceSpent,
  setSlotsSpent,
  setTempHp,
  setUsesSpent,
  spendHitDie,
  spendPact,
  spendSlot,
  spendUse,
  stepExhaustion,
  toggleCondition,
  toggleDeathSave,
  toggleInspiration,
} from './actions'

const play = (patch: Partial<PlayState> = {}): PlayState => ({
  ...defaultPlayState(),
  ...patch,
})

describe('damage', () => {
  it('takes temporary hit points first, then real ones', () => {
    const next = damage(play({ tempHp: 5 }), 7, 20)
    expect(next.tempHp).toBe(0)
    expect(next.damage).toBe(2)
  })
  it('is absorbed whole by enough temporary hit points', () => {
    expect(damage(play({ tempHp: 9 }), 4, 20)).toEqual(play({ tempHp: 5 }))
  })
  it('stops at 0 hit points without a failed save when the drop is not past the maximum', () => {
    const next = damage(play({ damage: 15 }), 8, 20)
    expect(next.damage).toBe(20)
    expect(next.deathSaves.failures).toBe(0)
  })
  it('kills outright when what is left after the drop is the maximum or more', () => {
    expect(damage(play({ damage: 10 }), 30, 20).deathSaves.failures).toBe(3)
  })
  it('adds a failed save for each hit at 0 hit points, up to three', () => {
    let p = play({ damage: 20 })
    for (let i = 0; i < 4; i++) p = damage(p, 1, 20)
    expect(p.deathSaves.failures).toBe(3)
    expect(p.damage).toBe(20)
  })
  it('counts a stale stored damage as the maximum', () => {
    expect(damage(play({ damage: 50 }), 1, 20).deathSaves.failures).toBe(1)
  })
  it('does nothing for no damage, and ignores a negative amount', () => {
    const p = play({ damage: 3 })
    expect(damage(p, 0, 20)).toBe(p)
    expect(damage(p, -4, 20)).toBe(p)
  })
})

describe('heal', () => {
  it('restores real hit points and not past the maximum', () => {
    expect(heal(play({ damage: 10 }), 4, 20).damage).toBe(6)
    expect(heal(play({ damage: 10 }), 40, 20).damage).toBe(0)
  })
  it('leaves temporary hit points alone', () => {
    expect(heal(play({ damage: 5, tempHp: 3 }), 2, 20).tempHp).toBe(3)
  })
  it('ends the death saves when it brings the character up from 0', () => {
    const down = play({ damage: 20, deathSaves: { successes: 2, failures: 2 } })
    expect(heal(down, 1, 20).deathSaves).toEqual({ successes: 0, failures: 0 })
  })
  it('heals from the clamped damage when the maximum was lowered', () => {
    expect(heal(play({ damage: 30 }), 5, 20).damage).toBe(15)
  })
  it('does nothing for no healing', () => {
    const p = play({ damage: 3 })
    expect(heal(p, 0, 20)).toBe(p)
  })
})

describe('temporary hit points', () => {
  it('keeps the higher of the two when more are gained', () => {
    expect(gainTemp(play({ tempHp: 10 }), 6).tempHp).toBe(10)
    expect(gainTemp(play({ tempHp: 4 }), 12).tempHp).toBe(12)
    expect(gainTemp(play(), -3).tempHp).toBe(0)
  })
  it('can be set by hand', () => {
    expect(setTempHp(play({ tempHp: 10 }), 3).tempHp).toBe(3)
    expect(setTempHp(play(), -3).tempHp).toBe(0)
  })
})

describe('death saves', () => {
  it('marks up to the nth, and takes the last one marked back', () => {
    let p = toggleDeathSave(play(), 'successes', 2)
    expect(p.deathSaves.successes).toBe(2)
    p = toggleDeathSave(p, 'successes', 2)
    expect(p.deathSaves.successes).toBe(1)
    p = toggleDeathSave(p, 'failures', 9)
    expect(p.deathSaves.failures).toBe(3)
  })
})

describe('spell slots', () => {
  it('spends and restores one, between none and the total', () => {
    let p = spendSlot(play(), 2, 3)
    expect(p.slotsSpent).toEqual([0, 1])
    p = spendSlot(spendSlot(spendSlot(p, 2, 3), 2, 3), 2, 3)
    expect(p.slotsSpent[1]).toBe(3)
    expect(restoreSlot(p, 2, 3).slotsSpent[1]).toBe(2)
    expect(restoreSlot(play(), 1, 3).slotsSpent).toEqual([0])
  })
  it('counts a stored number above a lowered total as all spent', () => {
    const p = play({ slotsSpent: [5] })
    expect(restoreSlot(p, 1, 2).slotsSpent[0]).toBe(1)
    expect(spendSlot(p, 1, 2).slotsSpent[0]).toBe(2)
  })
  it('keeps the other levels as they are', () => {
    expect(setSlotsSpent(play({ slotsSpent: [1, 2, 3] }), 1, 0, 4).slotsSpent).toEqual([
      0, 2, 3,
    ])
  })
  it('spends and restores pact slots', () => {
    let p = spendPact(play(), 2)
    p = spendPact(spendPact(p, 2), 2)
    expect(p.pactSpent).toBe(2)
    expect(restorePact(p, 2).pactSpent).toBe(1)
    expect(restorePact(play(), 2).pactSpent).toBe(0)
  })
})

describe('hit dice', () => {
  it('spends and restores one die of a size', () => {
    let p = spendHitDie(play(), 'd8', 2)
    p = spendHitDie(spendHitDie(p, 'd8', 2), 'd8', 2)
    expect(p.hitDiceSpent).toEqual({ d8: 2 })
    expect(restoreHitDie(p, 'd8', 2).hitDiceSpent).toEqual({ d8: 1 })
    expect(restoreHitDie(play(), 'd6', 2).hitDiceSpent).toEqual({ d6: 0 })
  })
  it('sets the spent count within the total and keeps other sizes', () => {
    const p = play({ hitDiceSpent: { d6: 1 } })
    expect(setHitDiceSpent(p, 'd8', 9, 3).hitDiceSpent).toEqual({ d6: 1, d8: 3 })
  })
})

describe('limited uses', () => {
  it('spends and regains one use, between none and the maximum', () => {
    const once = spendUse(play(), 'rage', 2)
    expect(once.uses).toEqual({ rage: 1 })
    expect(spendUse(spendUse(once, 'rage', 2), 'rage', 2).uses.rage).toBe(2)
    expect(restoreUse(once, 'rage', 2).uses.rage).toBe(0)
    expect(restoreUse(play(), 'rage', 2).uses.rage).toBe(0)
  })

  it('counts a stored number above a lowered maximum as all spent', () => {
    const stale = play({ uses: { rage: 5 } })
    expect(restoreUse(stale, 'rage', 3).uses.rage).toBe(2)
    expect(spendUse(stale, 'rage', 3).uses.rage).toBe(3)
  })

  it('sets the spent count within the maximum and keeps the other counters', () => {
    const both = play({ uses: { rage: 1, ki: 4 } })
    expect(setUsesSpent(both, 'ki', 9, 5).uses).toEqual({ rage: 1, ki: 5 })
    expect(setUsesSpent(both, 'ki', -1, 5).uses).toEqual({ rage: 1, ki: 0 })
  })
})

describe('conditions, exhaustion, inspiration, concentration', () => {
  it('puts a condition on and takes it off', () => {
    const on = toggleCondition(play(), 'Prone')
    expect(on.conditions).toEqual(['Prone'])
    expect(toggleCondition(on, 'Prone').conditions).toEqual([])
  })
  it('steps exhaustion between 0 and 6', () => {
    expect(stepExhaustion(play(), -1).exhaustion).toBe(0)
    expect(stepExhaustion(play({ exhaustion: 6 }), 1).exhaustion).toBe(6)
    expect(stepExhaustion(play({ exhaustion: 2 }), 1).exhaustion).toBe(3)
  })
  it('flips inspiration', () => {
    expect(toggleInspiration(play()).inspiration).toBe(true)
    expect(toggleInspiration(play({ inspiration: true })).inspiration).toBe(false)
  })
  it('starts, replaces and ends concentration', () => {
    const a = setConcentration(play(), { name: 'Bless', source: 'PHB' })
    expect(
      setConcentration(a, { name: 'Haste', source: 'PHB' }).concentration?.name,
    ).toBe('Haste')
    expect(setConcentration(a, null).concentration).toBeNull()
  })
})
