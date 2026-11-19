import { describe, expect, it } from 'vitest'
import { makeSpell } from '../test/spellFixtures'
import { resolveCast, spellRollPlan, variantsAt } from './spellRoll'

const part = (roll: string, type: string) => ({ roll, type })

describe('spellRollPlan', () => {
  it('gives nothing to roll for a spell with no dice', () => {
    expect(spellRollPlan(makeSpell({ name: 'Heal', healing: '' }))).toBeUndefined()
  })

  it('reads a save spell and adds a die per level above', () => {
    const spell = makeSpell({
      name: 'Fireball',
      level: 3,
      save: ['Dexterity'],
      damageParts: [part('8d6', 'fire')],
      entriesHigherLevel: [
        {
          type: 'entries',
          name: 'At Higher Levels',
          entries: [
            'it increases by {@scaledamage 8d6|3-9|1d6} for each slot level above 3rd.',
          ],
        },
      ],
    })
    const plan = spellRollPlan(spell)
    expect(plan?.action).toBe('save')
    const at4 = resolveCast(plan!, { characterLevel: 9, slotLevel: 4 })
    expect(at4.pieces[0].dice).toEqual([{ count: 9, sides: 6 }])
    expect(at4.lines[0]).toBe('Cast at level 4: +1d6')
    expect(resolveCast(plan!, { characterLevel: 9, slotLevel: 3 }).lines).toEqual([])
  })

  it('scales a cantrip by character level and offers each variant', () => {
    const plan = spellRollPlan(
      makeSpell({
        name: 'Fire Bolt',
        level: 0,
        attack: 'Ranged',
        damageParts: [part('1d10', 'fire')],
        cantripDice: [
          {
            label: 'damage',
            tiers: [
              { level: 1, dice: '1d10' },
              { level: 5, dice: '2d10' },
              { level: 11, dice: '3d10' },
            ],
          },
        ],
      }),
    )
    expect(plan).toBeDefined()
    expect(variantsAt(plan!, 1)).toHaveLength(1)
    const at11 = resolveCast(plan!, { characterLevel: 11, slotLevel: 0 })
    expect(at11.pieces[0].dice).toEqual([{ count: 3, sides: 10 }])
    expect(at11.lines[0]).toBe('Character level 11: 3d10')
  })
})
