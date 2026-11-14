// Opening what gives a limited use (its text and what restores it) in the sheet's pane.

import type { DerivedResource } from '../../derived/resources'
import { Entries } from '../../text/Entries'
import { PaneFrame, useSheetDetail } from './SheetDetail'
import { usesText } from './usesText'

/** Opens what gives a limited use (its text and what restores it) in the sheet's pane. */
export function useOpenUse() {
  const detail = useSheetDetail()
  return (r: DerivedResource) =>
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
}
