// The limited uses on the Actions tab: every counter the character has (of features, of
// spells cast per rest, of items with charges) with its pips, what restores it and where
// it comes from. The info button opens what gives it in the sheet's detail pane.

import Table from 'react-bootstrap/Table'
import type { DerivedSheet } from '../../derived'
import type { DerivedResource } from '../../derived/resources'
import { PinButton } from './PinButton'
import { IconButton } from './PlayStrip'
import { UseCounter } from './UseCounter'
import { useOpenUse } from './useOpenUse'
import { rechargeShort } from './usesText'
import { usePlay } from './usePlay'

export function SheetUses({ sheet }: { sheet: DerivedSheet }) {
  const open = useOpenUse()
  const current = usePlay(sheet)
  if (!current || sheet.resources.length === 0) return null
  const poolOf = (r: DerivedResource) => current.derived.uses.find((p) => p.id === r.id)
  return (
    <Table
      responsive
      size="sm"
      className="mb-0 mt-3 align-middle"
      aria-label="Limited uses"
    >
      <thead>
        <tr>
          <th className="sheet-pin">Favorite</th>
          <th>Limited use</th>
          <th>Uses</th>
          <th>Restores</th>
          <th>From</th>
        </tr>
      </thead>
      <tbody>
        {sheet.resources.map((r) => (
          <tr key={r.id}>
            <td className="sheet-pin">
              <PinButton kind="use" id={r.id} />
            </td>
            <td>
              <span className="sheet-uses__name">
                {r.label}
                <IconButton
                  label={`About ${r.label}`}
                  icon="info"
                  onClick={() => open(r)}
                />
              </span>
            </td>
            <td>
              <UseCounter resource={r} pool={poolOf(r)} />
            </td>
            <td title={`Maximum: ${r.basis}`}>{rechargeShort(r)}</td>
            <td>{r.from}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
