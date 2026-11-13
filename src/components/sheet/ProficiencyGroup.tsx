// One group of the sheet's proficiencies and languages the way a printed sheet lists them:
// a small label and the names as one comma-separated line. The group is a button: it opens
// the full table with where each one comes from in the sheet's detail pane.

import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import type { Listing } from '../../derived/types'
import { Icon } from '../Icon'
import { ListingTable } from '../editor/ProficienciesSection'
import { PaneFrame, useSheetDetail } from './SheetDetail'

/** What a group with nothing in it reads as. */
export const NO_PROFICIENCIES = 'None'

export function ProficiencyGroup({
  id,
  title,
  rows,
}: {
  /** Which group it is, unique on the sheet; it keys the pane ("profs:armor"). */
  id: string
  title: string
  rows: Listing[]
}) {
  const { current, toggle } = useSheetDetail()
  const names = rows.map((row) => row.value).join(', ')
  if (rows.length === 0) {
    return (
      <div className="sheet-prof">
        <div className="sheet-prof__label">{title}</div>
        <div className="sheet-prof__names sheet-prof__names--none">
          {NO_PROFICIENCIES}
        </div>
      </div>
    )
  }
  const label = `${title}: where each one comes from`
  const open = () =>
    toggle({
      id,
      title,
      tables: [],
      content: (
        <PaneFrame title={`${title} proficiencies`}>
          <ListingTable title={title} rows={rows} />
        </PaneFrame>
      ),
    })
  return (
    <div className="sheet-prof">
      <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
        <button
          type="button"
          className="sheet-prof__button"
          aria-pressed={current?.id === id}
          aria-label={`${label} (${names})`}
          onClick={open}
        >
          <span className="sheet-prof__label">{title}</span>
          <span className="sheet-prof__names">{names}</span>
          <Icon name="info" className="sheet-prof__icon" />
        </button>
      </OverlayTrigger>
    </div>
  )
}
