// Customizing Your Origin, its languages and proficiencies (TCE p.8): every language and
// proficiency the race gives outright, what the Proficiency Swaps table lets it become,
// and a switch to swap it. The replacement is picked like any other pick, in Skills or in
// Proficiencies.

import Table from 'react-bootstrap/Table'
import type { RaceRef } from '../../character/model'
import { loadItems } from '../../data/items'
import type { PlayableRace } from '../../data/race'
import { useAsyncData } from '../../hooks/useAsyncData'
import {
  originValues,
  originValueText,
  PROFICIENCY_SWAPS,
  swapId,
  swapRowOf,
} from '../../rules/customOrigin'
import { ToggleChip } from './ToggleChip'

export function OriginSwaps({
  race,
  raceRef,
  onSwaps,
}: {
  /** The race as the character has it, before any swap. */
  race: PlayableRace
  raceRef: RaceRef
  onSwaps: (swaps: string[]) => void
}) {
  const { data: items } = useAsyncData(loadItems)
  const values = originValues(race)
  if (values.length === 0) return null
  const categories = new Map(
    (items ?? []).flatMap((i) =>
      i.weapon?.category ? [[i.name.toLowerCase(), i.weapon.category] as const] : [],
    ),
  )
  const ids = raceRef.swaps ?? []
  const toggle = (id: string) =>
    onSwaps(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  return (
    <div className="mt-3">
      <h4 className="h6 mb-1">Languages and proficiencies</h4>
      <div className="small text-body-secondary mb-2">
        Swap any of them for another, as the Proficiency Swaps table allows (TCE, an
        optional rule). Choose each replacement in Skills or Proficiencies.
      </div>
      <Table size="sm" className="mb-0 align-middle" aria-label="Proficiency swaps">
        <thead>
          <tr>
            <th>From your race</th>
            <th>Kind</th>
            <th>Can become</th>
            <th>Swap</th>
          </tr>
        </thead>
        <tbody>
          {values.map((value) => {
            const id = swapId(value)
            const row = PROFICIENCY_SWAPS[swapRowOf(value, (n) => categories.get(n))]
            const on = ids.includes(id)
            const name = originValueText(value)
            return (
              <tr key={id}>
                <td>{name}</td>
                <td>{row.proficiency}</td>
                <td>
                  {row.replacement}
                  {value.kind === 'language' && (
                    <div className="small text-body-secondary">
                      {row.pick.from
                        .map((v) => originValueText({ ...v, kind: 'language' }))
                        .join(', ')}
                    </div>
                  )}
                </td>
                <td>
                  <ToggleChip
                    pressed={on}
                    title={`Swap ${name}`}
                    onClick={() => toggle(id)}
                  >
                    {on ? 'Swapped' : 'Swap'}
                  </ToggleChip>
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}
