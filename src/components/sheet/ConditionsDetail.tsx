// What the sheet's detail pane shows for conditions and exhaustion: the conditions of the
// character's rules with their full text, each one switched on or off, and the exhaustion
// rule with what the current level does. Both read the play state themselves, so they stay
// right while they are open.

import { useState } from 'react'
import Form from 'react-bootstrap/Form'
import { useActiveCharacter } from '../../character/store'
import { EXHAUSTION, loadConditions, type Condition } from '../../data/conditions'
import type { Edition } from '../../data/edition'
import { useAsyncData } from '../../hooks/useAsyncData'
import { toggleCondition } from '../../play/actions'
import { exhaustionEffects, PLAY_RULES } from '../../rules/playRules'
import { Entries } from '../../text/Entries'
import { PaneFrame } from './SheetDetail'
import { applyPlay } from './usePlay'

/** The conditions of one edition's printing, from the data. */
function useConditions(edition: Edition) {
  const { data, loading, error } = useAsyncData(loadConditions)
  const source = PLAY_RULES[edition].conditionSource
  const all = (data ?? []).filter((c) => c.source === source)
  return {
    loading,
    error,
    exhaustion: all.find((c) => c.name === EXHAUSTION),
    conditions: all.filter((c) => c.name !== EXHAUSTION),
  }
}

function Loading({ loading, error }: { loading: boolean; error: Error | null }) {
  if (error)
    return <div className="text-danger">Could not load the rules: {error.message}</div>
  return loading ? <div className="text-body-secondary">Loading...</div> : null
}

function ConditionRow({
  condition,
  active,
  open,
  onOpen,
}: {
  condition: Condition
  active: boolean
  open: boolean
  onOpen: () => void
}) {
  return (
    <li className="sheet-condition">
      <div className="d-flex align-items-center gap-2">
        <Form.Check
          type="switch"
          id={`condition-${condition.name}`}
          aria-label={`${condition.name} applies`}
          checked={active}
          onChange={() => applyPlay((p) => toggleCondition(p, condition.name))}
        />
        <button
          type="button"
          className="btn btn-link p-0 text-start"
          aria-expanded={open}
          onClick={onOpen}
        >
          {condition.name}
        </button>
      </div>
      {open && (
        <div className="small ps-4 pt-1">
          <Entries entries={condition.entries} />
        </div>
      )}
    </li>
  )
}

/** The picker: every condition with a switch, and its text one click away. */
export function ConditionsDetail({
  edition,
  initial,
}: {
  edition: Edition
  /** The condition whose text is open to begin with. */
  initial?: string
}) {
  const character = useActiveCharacter()
  const { conditions, loading, error } = useConditions(edition)
  const [open, setOpen] = useState<string | null>(initial ?? null)
  const has = new Set(character?.play.conditions)
  return (
    <PaneFrame title="Conditions">
      <Loading loading={loading} error={error} />
      <ul className="list-unstyled mb-0 d-flex flex-column gap-1" aria-label="Conditions">
        {conditions.map((c) => (
          <ConditionRow
            key={c.name}
            condition={c}
            active={has.has(c.name)}
            open={open === c.name}
            onOpen={() => setOpen(open === c.name ? null : c.name)}
          />
        ))}
      </ul>
    </PaneFrame>
  )
}

/** The exhaustion rule of the edition, with what the character's level does now. */
export function ExhaustionDetail({ edition }: { edition: Edition }) {
  const character = useActiveCharacter()
  const { exhaustion, loading, error } = useConditions(edition)
  const level = character?.play.exhaustion ?? 0
  const effects = exhaustionEffects(edition, level)
  return (
    <PaneFrame title={`Exhaustion ${level}`}>
      <div className="mb-2">
        {effects.length === 0 ? (
          'Not exhausted.'
        ) : (
          <>
            At level {level}:
            <ul className="mb-0" aria-label="Effects now">
              {effects.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      <Loading loading={loading} error={error} />
      {exhaustion && <Entries entries={exhaustion.entries} />}
    </PaneFrame>
  )
}
