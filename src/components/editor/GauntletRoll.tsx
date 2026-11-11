import Button from 'react-bootstrap/Button'
import {
  abilityMod,
  formatMod,
  gauntletImproveChance,
  gauntletMaxNext,
} from '../../dice/dice'
import type { GauntletSlot } from '../../character/model'
import { scoreCellClass, scoreColorClass } from '../../ui/scoreColor'
import { Icon } from '../Icon'

/**
 * Show a probability as a whole percent, but never round a real chance down to
 * "0%": anything above zero but below half a percent reads "<1%", so the odds
 * shown can never contradict a reroll button that is still enabled.
 */
function formatChance(p: number): string {
  const pct = p * 100
  if (pct <= 0) return '0%'
  return pct < 1 ? '<1%' : `${Math.round(pct)}%`
}

/**
 * The Gauntlet method's interactive area (homebrew): six independent 3d6 slots.
 * Each slot's total is live from the moment it is rolled, so all six totals are
 * already the assignable pool (handled by the parent). A slot can be rerolled -
 * every reroll costs a growing penalty (3d6 minus the number of rerolls, clamped
 * to 3..18) so pushing for a better score risks a worse one. Each slot shows its
 * exact chance of beating its current total, and reroll is disabled once that
 * chance is zero (the penalty makes an improvement impossible). This component
 * only renders and reports intent; the parent owns the rolling and history.
 */
export function GauntletRoll({
  slots,
  onReroll,
}: {
  slots: GauntletSlot[]
  onReroll: (index: number) => void
}) {
  return (
    <div className="gauntlet-roll">
      <div className="d-flex flex-wrap gap-3 pb-2" aria-label="Gauntlet slots">
        {slots.map((slot, i) => {
          const improve = gauntletImproveChance(slot.total, slot.rerolls)
          const canImprove = improve > 0
          const maxNext = gauntletMaxNext(slot.rerolls)
          return (
            <div key={i} className="gauntlet-slot d-flex flex-column align-items-center">
              {/* The tile is pinned light like the other rolled tiles so the score
                  tint reads the same in either app theme. */}
              <div data-bs-theme="light">
                <div className={`roll-die ${scoreCellClass(slot.total)}`}>
                  <span className={scoreColorClass(slot.total)}>{slot.total}</span>
                  <span className="roll-die-mod">
                    {formatMod(abilityMod(slot.total))}
                  </span>
                </div>
              </div>
              <div className="small text-body-secondary mt-2 text-center" aria-hidden>
                {slot.rerolls > 0
                  ? `rerolled ${slot.rerolls}× (penalty ${formatMod(-slot.rerolls)})`
                  : 'first roll'}
              </div>
              <div className="small text-center mt-1">
                {canImprove ? (
                  <span className="text-body-secondary">
                    {formatChance(improve)} to beat {slot.total} · best {maxNext}
                  </span>
                ) : (
                  <span className="text-body-secondary">
                    can't beat {slot.total} · best {maxNext}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-1"
                onClick={() => onReroll(i)}
                disabled={!canImprove}
                title={
                  canImprove
                    ? `Reroll (next roll takes a ${formatMod(
                        -(slot.rerolls + 1),
                      )} penalty; best it can roll is ${maxNext}; ${formatChance(
                        improve,
                      )} chance to beat ${slot.total})`
                    : `A reroll can no longer beat ${slot.total} (best it can roll is ${maxNext})`
                }
                aria-label={`Reroll slot ${i + 1}`}
              >
                <Icon name="historyNext" className="me-1" />
                Reroll
              </Button>
            </div>
          )
        })}
      </div>
      <div className="small text-body-secondary mt-2">
        Each slot is a 3d6 roll, and all six totals are already your pool to assign in the
        table below. Reroll any slot to chase a higher score, but every reroll subtracts
        one more from the result - each slot shows its exact chance of beating its current
        total and the best a reroll could still roll (a perfect 18 minus the next
        penalty), and reroll stops once beating the current total is impossible.
      </div>
    </div>
  )
}
