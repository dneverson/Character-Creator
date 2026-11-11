// Placing a generated pool of scores on the six abilities by tapping. Click an
// ability and it takes the highest score left, so assigning from most to least
// important is six clicks. To place a particular score click it first, then the
// ability. Click a placed ability to pick its score up: another ability swaps with
// it, the same one sends it back to the pool. Escape drops the selection.

import { useState, type KeyboardEvent } from 'react'
import type { AbilityKey } from '../../dice/dice'
import type { Abilities } from '../../character/model'
import { nextScore, placeScore, returnScore, swapScores } from '../../character/stats'

/** What is "in hand": a score chip from the pool, or the score on an ability. */
type Armed = { chip: number } | { slot: AbilityKey } | null

export function useScoreAssigner(
  abilities: Abilities,
  pool: number[],
  onChange: (abilities: Abilities) => void,
) {
  const [armed, setArmed] = useState<Armed>(null)

  function clickChip(value: number) {
    setArmed(armed && 'chip' in armed && armed.chip === value ? null : { chip: value })
  }

  function clickSlot(key: AbilityKey) {
    const held = abilities[key].base
    if (armed && 'chip' in armed) {
      onChange(placeScore(abilities, pool, key, armed.chip))
      setArmed(null)
    } else if (armed) {
      if (armed.slot === key) onChange(returnScore(abilities, key))
      else onChange(swapScores(abilities, armed.slot, key))
      setArmed(null)
    } else if (held === null) {
      const next = nextScore(pool, abilities)
      if (next !== null) onChange(placeScore(abilities, pool, key, next))
    } else {
      setArmed({ slot: key })
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') setArmed(null)
  }

  return { armed, clickChip, clickSlot, onKeyDown }
}

export type ScoreAssigner = ReturnType<typeof useScoreAssigner>
