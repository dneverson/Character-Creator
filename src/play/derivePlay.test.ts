import { describe, expect, it } from 'vitest'
import { createCharacter, defaultPlayState, type PlayState } from '../character/model'
import { edited } from '../character/history'
import type { DerivedResource } from '../derived/resources'
import { quantity } from '../derived/types'
import { derivePlay } from './derivePlay'

const line = (amount: number) =>
  quantity([
    {
      id: 'x',
      label: 'x',
      source: { kind: 'base', tag: 'base', label: '' },
      op: 'base',
      status: 'applied',
      amount,
    },
  ])

const sheet = (max = 20, slots = [4, 3, 0, 0, 0, 0, 0, 0, 0]) => ({
  hp: line(max),
  hitDice: [
    { faces: 8, count: line(3) },
    { faces: 6, count: line(2) },
  ],
  slots: {
    standard: slots,
    pact: { slots: 2, level: 1 },
    maxSpellLevel: 2,
    casters: [],
    casterLevel: quantity([]),
  },
  resources: [resource('use:rage', 3), resource('use:unlimited', undefined)],
})

function resource(id: string, max: number | undefined): DerivedResource {
  return {
    id,
    label: id,
    from: 'Barbarian',
    kind: 'feature',
    max,
    recharge: 'long',
    shortRegain: 0,
    basis: '',
    restores: '',
    entries: [],
  }
}

const play = (patch: Partial<PlayState> = {}) => ({ ...defaultPlayState(), ...patch })

describe('derivePlay', () => {
  it('reads the uses spent against each counter, and keeps no count when unlimited', () => {
    const d = derivePlay(sheet(), play({ uses: { 'use:rage': 5, 'use:unlimited': 2 } }))
    expect(d.uses).toEqual([{ id: 'use:rage', total: 3, spent: 3, left: 0 }])
    expect(derivePlay(sheet(), play()).uses[0].left).toBe(3)
  })

  it('works out the current hit points as lines', () => {
    const d = derivePlay(sheet(), play({ damage: 7, tempHp: 4 }))
    expect(d.currentHp.value).toBe(13)
    expect(d.currentHp.lines.map((l) => l.label)).toEqual([
      'Maximum',
      'Damage taken',
      'Temporary hit points',
    ])
    expect(derivePlay(sheet(), play()).currentHp.lines).toHaveLength(2)
  })

  it('reads a lower maximum as lower current hit points without changing the damage', () => {
    const p = play({ damage: 15 })
    expect(derivePlay(sheet(10), p).currentHp.value).toBe(0)
    expect(derivePlay(sheet(30), p).currentHp.value).toBe(15)
    expect(p.damage).toBe(15)
  })

  it('works out the hit dice per size and clamps what was spent', () => {
    const d = derivePlay(sheet(), play({ hitDiceSpent: { d8: 5, d6: 1 } }))
    expect(d.hitDice).toEqual([
      { faces: 8, die: 'd8', total: 3, spent: 3, left: 0 },
      { faces: 6, die: 'd6', total: 2, spent: 1, left: 1 },
    ])
  })

  it('lists only the levels with slots, and the pact slots apart', () => {
    const d = derivePlay(sheet(), play({ slotsSpent: [1, 9], pactSpent: 1 }))
    expect(d.slots).toEqual([
      { level: 1, total: 4, spent: 1, left: 3 },
      { level: 2, total: 3, spent: 3, left: 0 },
    ])
    expect(d.pact).toEqual({ level: 1, total: 2, spent: 1, left: 1 })
  })

  it('shows more slots again when a level is gained, with the spent count kept', () => {
    const p = play({ slotsSpent: [2, 0, 2] })
    expect(derivePlay(sheet(20, [4, 2, 0, 0, 0, 0, 0, 0, 0]), p).slots).toHaveLength(2)
    const grown = derivePlay(sheet(20, [4, 3, 2, 0, 0, 0, 0, 0, 0]), p)
    expect(grown.slots[2]).toEqual({ level: 3, total: 2, spent: 2, left: 0 })
  })

  it('has no pact slots without Pact Magic', () => {
    const base = sheet()
    const d = derivePlay({ ...base, slots: { ...base.slots, pact: undefined } }, play())
    expect(d.pact).toBeUndefined()
  })

  it('tells conscious, dying, stable and dead apart', () => {
    expect(derivePlay(sheet(), play()).deathState).toBe('conscious')
    expect(derivePlay(sheet(), play({ damage: 20 })).deathState).toBe('dying')
    const saved = { successes: 3, failures: 1 }
    expect(derivePlay(sheet(), play({ damage: 20, deathSaves: saved })).deathState).toBe(
      'stable',
    )
    const failed = { successes: 0, failures: 3 }
    expect(derivePlay(sheet(), play({ deathSaves: failed })).deathState).toBe('dead')
  })

  it('is not touched by a change of the build', () => {
    const made = createCharacter('A')
    const withPlay = edited(made, { play: play({ slotsSpent: [2], damage: 4 }) })
    const levelled = edited(withPlay, {
      classes: [{ name: 'Wizard', source: 'PHB', level: 6 }],
    })
    expect(levelled.play).toEqual(withPlay.play)
  })
})
