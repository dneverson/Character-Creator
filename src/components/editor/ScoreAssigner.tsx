// The pool of scores and the ability slots they are tapped onto (the behaviour is
// in useScoreAssigner).

import Button from 'react-bootstrap/Button'
import { ABILITY_NAMES, type AbilityKey } from '../../dice/dice'
import type { Abilities } from '../../character/model'
import { nextScore, poolChips } from '../../character/stats'
import type { ScoreAssigner } from './useScoreAssigner'

/** The pool as chips (placed ones muted) and a line saying what the next click does. */
export function ScorePool({
  assigner,
  abilities,
  pool,
}: {
  assigner: ScoreAssigner
  abilities: Abilities
  pool: number[]
}) {
  const { armed } = assigner
  const chips = poolChips(pool, abilities)
  const next = nextScore(pool, abilities)

  if (chips.length === 0) return null

  let status: string
  if (armed && 'chip' in armed)
    status = `${armed.chip} selected. Choose an ability for it.`
  else if (armed) {
    const held = abilities[armed.slot].base
    status = `${ABILITY_NAMES[armed.slot]} ${held} selected. Choose another ability to swap, or ${ABILITY_NAMES[armed.slot]} again to return it to the pool.`
  } else if (next === null)
    status = 'All scores assigned. Click an ability to move its score.'
  else
    status = `Click an ability to give it ${next}, the highest score left, or choose a score first.`

  return (
    <div className="mb-3">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="fw-semibold" id="scores-to-assign">
          Scores to assign
        </span>
        <div
          className="d-flex flex-wrap gap-1"
          role="group"
          aria-labelledby="scores-to-assign"
        >
          {chips.map((chip, i) => {
            const on =
              armed !== null &&
              'chip' in armed &&
              armed.chip === chip.value &&
              !chip.placed
            return (
              <Button
                key={i}
                size="sm"
                variant={on ? 'primary' : 'secondary'}
                aria-pressed={on}
                disabled={chip.placed}
                className={chip.placed ? 'opacity-50' : undefined}
                onClick={() => assigner.clickChip(chip.value)}
              >
                {chip.value}
              </Button>
            )
          })}
        </div>
      </div>
      <div className="small text-body-secondary mt-1" role="status">
        {status}
      </div>
    </div>
  )
}

/** One ability's score: shows it, or "Assign" while empty. */
export function ScoreSlot({
  assigner,
  abilityKey,
  value,
}: {
  assigner: ScoreAssigner
  abilityKey: AbilityKey
  value: number | null
}) {
  const { armed } = assigner
  const on = armed !== null && 'slot' in armed && armed.slot === abilityKey
  return (
    <Button
      size="sm"
      variant={on ? 'primary' : 'secondary'}
      aria-pressed={on}
      aria-label={`${ABILITY_NAMES[abilityKey]} base score`}
      className="fw-bold"
      style={{ minWidth: 84 }}
      onClick={() => assigner.clickSlot(abilityKey)}
    >
      {value ?? 'Assign'}
    </Button>
  )
}
