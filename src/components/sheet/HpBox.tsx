// The hit points box: the hit points now and the maximum (each opens how it adds up), the
// temporary hit points, and one field with Heal, Damage and Temp beside it, so a hit or a
// healing is a number and one click. The death saves appear at 0 hit points.

import { useState } from 'react'
import Button from 'react-bootstrap/Button'
import type { DerivedSheet } from '../../derived'
import { damage, gainTemp, heal, setTempHp } from '../../play/actions'
import { DerivedNumber } from '../derived/DerivedNumber'
import { DraftInput } from '../editor/DraftInput'
import { DeathSaves } from './SheetPips'
import { useApplyPlay, usePlay } from './usePlay'

const whole = (text: string) => {
  const n = Number.parseInt(text, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function HpBox({ sheet }: { sheet: DerivedSheet }) {
  const applyPlay = useApplyPlay()
  const [amount, setAmount] = useState('')
  const current = usePlay(sheet)
  if (!current) return null
  const { play, derived } = current
  const n = whole(amount)
  /** Applies the amount typed, then clears the field so a hit is never applied twice. */
  const use = (change: (n: number) => void) => () => {
    if (n === 0) return
    change(n)
    setAmount('')
  }

  return (
    <section className="sheet-stat sheet-hp" role="group" aria-label="Hit points">
      <div className="sheet-hp__head">
        <span className="sheet-stat__label">Hit points</span>
        <label className="sheet-hp__temp">
          <span className="sheet-stat__label">Temp</span>
          <DraftInput
            type="number"
            min={0}
            size="sm"
            aria-label="Temporary hit points"
            value={String(play.tempHp)}
            onCommit={(text) => applyPlay((p) => setTempHp(p, whole(text)))}
          />
        </label>
      </div>
      <div className="sheet-hp__numbers">
        <DerivedNumber
          id="hp:current"
          label="Current hit points"
          amountHeader="Hit points"
          totalLabel="Hit points now"
          quantity={derived.currentHp}
        />
        <span className="sheet-hp__of" aria-hidden="true">
          /
        </span>
        <DerivedNumber
          id="hp"
          label="Hit points"
          amountHeader="Hit points"
          totalLabel="Maximum hit points"
          quantity={sheet.hp}
        />
      </div>
      <div className="sheet-hp__controls">
        <DraftInput
          type="number"
          min={0}
          size="sm"
          aria-label="Hit points amount"
          placeholder="Amount"
          value={amount}
          onCommit={setAmount}
        />
        <Button
          size="sm"
          variant="success"
          onClick={use((hp) => applyPlay((p) => heal(p, hp, derived.maxHp)))}
        >
          Heal
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={use((hp) => applyPlay((p) => damage(p, hp, derived.maxHp)))}
        >
          Damage
        </Button>
        <Button
          size="sm"
          variant="secondary"
          title="Gain temporary hit points; they do not add up, the higher is kept"
          onClick={use((hp) => applyPlay((p) => gainTemp(p, hp)))}
        >
          Temp
        </Button>
      </div>
      <DeathSaves sheet={sheet} />
    </section>
  )
}
