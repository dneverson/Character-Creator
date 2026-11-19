// What an attack of the sheet shows and rolls: how its attack bonus and its damage add up,
// and the roll a click on its row opens (the to-hit d20 and, apart, the damage).

import type { AttackRow } from '../../derived/attacks'
import { formatMod } from '../../dice/dice'
import { tablesOf } from '../derived/breakdownTables'
import type { BreakdownSpec } from '../derived/DerivedNumber'
import { damageExpression, damageText } from '../editor/attackText'
import { partsOf, testRoll, type RollSpec } from './rollSpec'

/** How the attack bonus of an attack adds up. */
export const hitSpec = (attack: AttackRow): BreakdownSpec => ({
  id: `attack:${attack.id}:hit`,
  label: `${attack.name} attack bonus`,
  amountHeader: 'Attack bonus',
  quantity: attack.toHit,
  format: formatMod,
})

/** How the damage of an attack adds up (and, with a second grip, the damage of two hands). */
export const damageSpec = (attack: AttackRow): BreakdownSpec => {
  const { dice, bonus } = attack.damage
  return {
    id: `attack:${attack.id}:damage`,
    label: `${attack.name} damage`,
    title: `${attack.name} damage ${damageText(dice, bonus.value)}`,
    amountHeader: dice === '' ? 'Damage' : 'Damage bonus',
    quantity: bonus,
    format: dice === '' ? String : formatMod,
    also: attack.twoHanded
      ? [
          {
            label: `${attack.name} damage, two hands`,
            amountHeader: 'Damage bonus',
            quantity: attack.twoHanded.bonus,
            format: formatMod,
          },
        ]
      : undefined,
  }
}

/** What a click on the row of an attack rolls: the to-hit d20 and the damage, rolled apart. */
export function attackRoll(attack: AttackRow): RollSpec {
  return testRoll(`${attack.name} attack`, hitSpec(attack), {
    damage: {
      name: attack.name,
      expression: damageExpression(attack.damage.dice, attack.damage.bonus.value),
      tables: tablesOf(damageSpec(attack)),
      parts: partsOf(attack.damage.bonus),
    },
  })
}
