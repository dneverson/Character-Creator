// The attacks of the sheet: the editor's columns, with the attack bonus and the damage as
// numbers that open how they add up in the sheet's detail pane.

import Table from 'react-bootstrap/Table'
import type { AttackRow } from '../../derived/attacks'
import { formatMod } from '../../dice/dice'
import { DerivedNumber } from '../derived/DerivedNumber'
import { attackName, damageText } from '../editor/attackText'
import { AttackNotes } from '../editor/CombatSection'
import { NO_VALUE } from '../table/facts'
import { PinButton } from './PinButton'

/** The attack bonus of an attack, as a number that opens how it adds up. */
export function AttackToHit({ attack }: { attack: AttackRow }) {
  return (
    <DerivedNumber
      id={`attack:${attack.id}:hit`}
      label={`${attack.name} attack bonus`}
      amountHeader="Attack bonus"
      quantity={attack.toHit}
      format={formatMod}
    />
  )
}

/** The damage of an attack (and of the two hands), as numbers that open how they add up. */
export function AttackDamage({ attack }: { attack: AttackRow }) {
  const { dice, bonus } = attack.damage
  const damage = damageText(dice, bonus.value)
  return (
    <>
      <DerivedNumber
        id={`attack:${attack.id}:damage`}
        label={`${attack.name} damage`}
        title={`${attack.name} damage ${damage}`}
        amountHeader={dice === '' ? 'Damage' : 'Damage bonus'}
        quantity={bonus}
        format={dice === '' ? String : formatMod}
        also={
          attack.twoHanded
            ? [
                {
                  label: `${attack.name} damage, two hands`,
                  amountHeader: 'Damage bonus',
                  quantity: attack.twoHanded.bonus,
                  format: formatMod,
                },
              ]
            : undefined
        }
        kind="total"
      >
        {damage}
      </DerivedNumber>
      {attack.twoHanded && (
        <div className="small text-body-secondary">
          {damageText(attack.twoHanded.dice, attack.twoHanded.bonus.value)} with two hands
        </div>
      )}
    </>
  )
}

export function SheetAttacks({ attacks }: { attacks: AttackRow[] }) {
  return (
    <Table responsive size="sm" className="mb-0 align-middle" aria-label="Attacks">
      <thead>
        <tr>
          <th className="sheet-pin">Favorite</th>
          <th>Attack</th>
          <th className="text-end">To hit</th>
          <th className="text-end">Damage</th>
          <th>Damage type</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {attacks.map((attack) => {
          const flag = attack.toHit.lines.find((l) => l.status === 'flag')
          return (
            <tr key={attack.id}>
              <td className="sheet-pin">
                <PinButton kind="attack" id={attack.id} />
              </td>
              <td>{attackName(attack)}</td>
              <td className="text-end">
                <AttackToHit attack={attack} />
              </td>
              <td className="text-end">
                <AttackDamage attack={attack} />
              </td>
              <td>{attack.damage.types || NO_VALUE}</td>
              <td>
                <AttackNotes attack={attack} flag={flag} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
