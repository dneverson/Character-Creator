// The pips of the sheet: spell slots and Pact Magic slots, and the death saves. Each pip is
// a button that says what it is and whether it is used, so none depends on how it looks.

import type { ReactNode } from 'react'
import { ordinal } from '../../data/spellText'
import type { DerivedSheet } from '../../derived'
import {
  restorePact,
  restoreSlot,
  spendPact,
  spendSlot,
  toggleDeathSave,
  DEATH_SAVE_LIMIT,
  type DeathSave,
} from '../../play/actions'
import type { Pool } from '../../play/derivePlay'
import { useApplyPlay, usePlay } from './usePlay'

/** One pip: a button that names what it is and whether it is used. */
export function Pip({
  filled,
  pressed,
  label,
  onClick,
}: {
  /** Drawn solid: a slot still there, a death save marked. */
  filled: boolean
  /** What `aria-pressed` says: used, or marked. */
  pressed: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`sheet-pip${filled ? ' sheet-pip--filled' : ''}`}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
    />
  )
}

/** One row of slot pips: the ones left first, then the ones used. */
function SlotRow({
  name,
  pool,
  spend,
  restore,
}: {
  /** "Level 1", "Pact" - what each pip's name starts with. */
  name: string
  pool: Pool
  spend: () => void
  restore: () => void
}) {
  return (
    <span className="sheet-pips">
      {Array.from({ length: pool.total }, (_, i) => {
        const used = i >= pool.left
        return (
          <Pip
            key={i}
            filled={!used}
            pressed={used}
            label={`${name} slot ${i + 1} of ${pool.total}, ${used ? 'used' : 'available'}`}
            onClick={used ? restore : spend}
          />
        )
      })}
    </span>
  )
}

/** The spell slots of each level and the Pact Magic slots, as pips. */
export function SlotPips({
  sheet,
  label = 'Spell slots',
}: {
  sheet: DerivedSheet
  /** The group's name; each place that shows the pips gives its own. */
  label?: string
}) {
  const applyPlay = useApplyPlay()
  const current = usePlay(sheet)
  if (!current) return null
  const { slots, pact } = current.derived
  if (slots.length === 0 && !pact) return null
  return (
    <div className="sheet-slots" role="group" aria-label={label}>
      {slots.map((pool) => (
        <span key={pool.level} className="sheet-slots__level">
          <span className="sheet-slots__name">{ordinal(pool.level)}</span>
          <SlotRow
            name={`Level ${pool.level}`}
            pool={pool}
            spend={() => applyPlay((p) => spendSlot(p, pool.level, pool.total))}
            restore={() => applyPlay((p) => restoreSlot(p, pool.level, pool.total))}
          />
        </span>
      ))}
      {pact && (
        <span className="sheet-slots__level">
          <span className="sheet-slots__name">Pact ({ordinal(pact.level)})</span>
          <SlotRow
            name="Pact"
            pool={pact}
            spend={() => applyPlay((p) => spendPact(p, pact.total))}
            restore={() => applyPlay((p) => restorePact(p, pact.total))}
          />
        </span>
      )}
    </div>
  )
}

const SAVE_NAMES: Record<DeathSave, string> = {
  successes: 'Successes',
  failures: 'Failures',
}

function DeathSaveRow({ kind, marked }: { kind: DeathSave; marked: number }): ReactNode {
  const applyPlay = useApplyPlay()
  return (
    <span className="sheet-slots__level">
      <span className="sheet-slots__name">{SAVE_NAMES[kind]}</span>
      <span className="sheet-pips">
        {Array.from({ length: DEATH_SAVE_LIMIT }, (_, i) => (
          <Pip
            key={i}
            filled={i < marked}
            pressed={i < marked}
            label={`Death save ${kind === 'successes' ? 'success' : 'failure'} ${i + 1} of ${DEATH_SAVE_LIMIT}, ${i < marked ? 'marked' : 'not marked'}`}
            onClick={() => applyPlay((p) => toggleDeathSave(p, kind, i + 1))}
          />
        ))}
      </span>
    </span>
  )
}

const STATE_TEXT = { dying: 'Dying', stable: 'Stable', dead: 'Dead', conscious: '' }

/** The death saves, shown while the character is at 0 hit points or has any marked. */
export function DeathSaves({ sheet }: { sheet: DerivedSheet }) {
  const current = usePlay(sheet)
  if (!current) return null
  const { play, derived } = current
  const { successes, failures } = play.deathSaves
  if (derived.deathState === 'conscious' && successes === 0 && failures === 0) return null
  return (
    <div className="sheet-slots" role="group" aria-label="Death saves">
      <span className="sheet-slots__name">Death saves</span>
      <DeathSaveRow kind="successes" marked={successes} />
      <DeathSaveRow kind="failures" marked={failures} />
      {STATE_TEXT[derived.deathState] && (
        <strong className="sheet-hp__state">{STATE_TEXT[derived.deathState]}</strong>
      )}
    </div>
  )
}
