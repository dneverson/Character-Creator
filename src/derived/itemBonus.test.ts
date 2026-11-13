import { describe, expect, it } from 'vitest'
import { BONUS_LABELS } from '../data/labels'
import { dataDir, records } from '../test/dataAudit'
import { makeItem } from '../test/itemFixtures'
import { itemBonus } from './itemBonus'

describe('itemBonus', () => {
  it('sums the bonuses the item states for a field', () => {
    const item = makeItem({
      name: 'Test',
      bonuses: [
        { what: 'AC', value: '+1' },
        { what: 'AC', value: '+2' },
        { what: 'spell attack', value: '+1' },
      ],
    })
    expect(itemBonus(item, 'bonusAc')).toBe(3)
    expect(itemBonus(item, 'bonusSpellAttack')).toBe(1)
    expect(itemBonus(item, 'bonusWeapon')).toBe(0)
  })
})

describe.skipIf(!dataDir)('item bonus fields against the data', () => {
  it('reads every bonus field an item of the books states', () => {
    const keys = new Set<string>()
    for (const { collection, record } of records(dataDir ?? '')) {
      if (!['item', 'baseitem', 'magicvariant'].includes(collection)) continue
      for (const key of Object.keys(record)) if (/^bonus[A-Z]/.test(key)) keys.add(key)
      const inherits = record.inherits
      if (inherits && typeof inherits === 'object') {
        for (const key of Object.keys(inherits))
          if (/^bonus[A-Z]/.test(key)) keys.add(key)
      }
    }
    expect([...keys].filter((k) => !(k in BONUS_LABELS))).toEqual([])
  })

  it('reads every bonus to ability checks as a number, so the checks count it', () => {
    const unread = records(dataDir ?? '')
      .filter(({ collection }) => ['item', 'magicvariant'].includes(collection))
      .map(({ record }) => record.bonusAbilityCheck)
      .filter((value) => value !== undefined && !Number.isFinite(Number(value)))
    expect(unread).toEqual([])
  })
})
