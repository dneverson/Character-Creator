// The limited uses on the Actions tab: every counter the character has (of features, of
// spells cast per rest, of items with charges) with its pips, what restores it and where
// it comes from. The info button opens what gives it in the sheet's detail pane.

import Table from 'react-bootstrap/Table'
import type { DerivedSheet } from '../../derived'
import type { DerivedResource } from '../../derived/resources'
import { Entries } from '../../text/Entries'
import { IconButton } from './PlayStrip'
import { PaneFrame, useSheetDetail } from './SheetDetail'
import { UseCounter } from './UseCounter'
import { rechargeShort, usesText } from './usesText'
import { usePlay } from './usePlay'

export function SheetUses({ sheet }: { sheet: DerivedSheet }) {
  const detail = useSheetDetail()
  const current = usePlay(sheet)
  if (!current || sheet.resources.length === 0) return null
  const poolOf = (r: DerivedResource) => current.derived.uses.find((p) => p.id === r.id)
  const open = (r: DerivedResource) =>
    detail.toggle({
      id: `uses:${r.id}`,
      title: r.label,
      tables: [],
      content: (
        <PaneFrame title={r.label}>
          <p>{usesText(r)}</p>
          <Entries entries={r.entries} />
        </PaneFrame>
      ),
    })
  return (
    <Table
      responsive
      size="sm"
      className="mb-0 mt-3 align-middle"
      aria-label="Limited uses"
    >
      <thead>
        <tr>
          <th>Limited use</th>
          <th>Uses</th>
          <th>Restores</th>
          <th>From</th>
        </tr>
      </thead>
      <tbody>
        {sheet.resources.map((r) => (
          <tr key={r.id}>
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
