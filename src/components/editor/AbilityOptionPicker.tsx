// Taking the ability score increases a race, background or feat grants: which way
// to take them when there are several, and where the ones left to the player go.
// Every increase is one click on the ability it goes to; a click on a placed one
// takes it back off.

import Badge from 'react-bootstrap/Badge'
import Form from 'react-bootstrap/Form'
import { ABILITIES, ABILITY_NAMES, formatMod } from '../../dice/dice'
import {
  amountGroups,
  describeAbilityOption,
  toggleIncrease,
  validChoices,
  type AbilityIncreases,
  type AbilityOption,
} from '../../data/abilityOptions'
import { ToggleChip } from './ToggleChip'

interface Props {
  /** Prefix for the control ids, unique on the page. */
  id: string
  /** The ways to take the increases. */
  options: AbilityOption[]
  /** The way in use (an index into `options`). */
  optionIndex: number
  /** The increases the player has placed. */
  choices: AbilityIncreases
  onOption: (index: number) => void
  onChoices: (choices: AbilityIncreases) => void
}

export function AbilityOptionPicker({
  id,
  options,
  optionIndex,
  choices,
  onOption,
  onChoices,
}: Props) {
  if (options.length === 0) return null
  const index = optionIndex < options.length ? optionIndex : 0
  const option = options[index]
  const placed = validChoices(option, choices)
  const fixed = ABILITIES.filter((k) => option.fixed[k] !== undefined)

  return (
    <div>
      {options.length > 1 && (
        <div className="mb-2" role="radiogroup" aria-label="How to take the increases">
          {options.map((o, i) => (
            <Form.Check
              key={i}
              type="radio"
              name={`${id}-option`}
              id={`${id}-option-${i}`}
              label={describeAbilityOption(o)}
              checked={i === index}
              onChange={() => onOption(i)}
            />
          ))}
        </div>
      )}

      {fixed.length > 0 && (
        <div className="d-flex flex-wrap gap-1 mb-2">
          {fixed.map((k) => (
            <Badge bg="secondary" key={k}>
              {ABILITY_NAMES[k]} {formatMod(option.fixed[k] ?? 0)}
            </Badge>
          ))}
        </div>
      )}

      {amountGroups(option).map(({ amount, count }) => {
        const holders = option.from.filter((k) => placed[k] === amount)
        const full = holders.length >= count
        const labelId = `${id}-amount-${amount}`
        return (
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2" key={amount}>
            <span className="fw-semibold" id={labelId}>
              Add {formatMod(amount)} to
            </span>
            <div
              className="d-flex flex-wrap gap-1"
              role="group"
              aria-labelledby={labelId}
            >
              {option.from.map((k) => {
                const on = placed[k] === amount
                return (
                  <ToggleChip
                    key={k}
                    pressed={on}
                    // With several of an amount all placed, one comes off first; a
                    // single one simply moves to the ability clicked.
                    disabled={!on && full && count > 1}
                    onClick={() => onChoices(toggleIncrease(option, placed, amount, k))}
                  >
                    {ABILITY_NAMES[k]}
                  </ToggleChip>
                )
              })}
            </div>
            <span className="small text-body-secondary">
              {holders.length} of {count} chosen
            </span>
          </div>
        )
      })}

      {option.note && <div className="small text-body-secondary">{option.note}</div>}
    </div>
  )
}
