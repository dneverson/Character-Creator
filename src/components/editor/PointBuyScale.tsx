// One ability's point-buy score as a scale from the lowest to the highest score
// (wrapping on a narrow screen): click the score wanted. A score that costs more than the points left is disabled
// and says what it costs; lower scores are always open.

import ToggleButton from 'react-bootstrap/ToggleButton'
import {
  ABILITY_NAMES,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  pointBuyCost,
  type AbilityKey,
} from '../../dice/dice'

const SCALE = Array.from(
  { length: POINT_BUY_MAX - POINT_BUY_MIN + 1 },
  (_, i) => POINT_BUY_MIN + i,
)

interface Props {
  abilityKey: AbilityKey
  /** The score now (the floor while unset). */
  value: number
  /** Points still to spend (negative when overspent). */
  pointsLeft: number
  onChange: (score: number) => void
}

/** What choosing `score` does to the points, as a hover hint. */
function hint(score: number, value: number, pointsLeft: number): string {
  const delta = pointBuyCost(score) - pointBuyCost(value)
  if (delta === 0) return 'Current score'
  if (delta < 0) return `Gives back ${-delta} ${-delta === 1 ? 'point' : 'points'}`
  const cost = `Costs ${delta} more ${delta === 1 ? 'point' : 'points'}`
  return delta > pointsLeft ? `${cost}, ${Math.max(0, pointsLeft)} left` : cost
}

export function PointBuyScale({ abilityKey, value, pointsLeft, onChange }: Props) {
  const name = ABILITY_NAMES[abilityKey]
  return (
    <div
      className="d-flex flex-wrap justify-content-center gap-1"
      role="radiogroup"
      aria-label={`${name} score`}
    >
      {SCALE.map((score) => {
        const delta = pointBuyCost(score) - pointBuyCost(value)
        return (
          <ToggleButton
            key={score}
            id={`pointbuy-${abilityKey}-${score}`}
            type="radio"
            size="sm"
            name={`pointbuy-${abilityKey}`}
            variant={score === value ? 'primary' : 'secondary'}
            value={score}
            checked={score === value}
            disabled={delta > pointsLeft}
            title={hint(score, value, pointsLeft)}
            onChange={() => onChange(score)}
          >
            {score}
          </ToggleButton>
        )
      })}
    </div>
  )
}
