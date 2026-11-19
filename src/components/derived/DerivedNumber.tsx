// A derived number as the sheet shows it: the number, and beside it an info button. Either
// one puts the lines the number adds up from in the sheet's detail pane; the same click
// again closes it. A stat box uses `DerivedBox`, where the whole box is the button.

import type { ReactNode } from 'react'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import type { Quantity } from '../../derived/types'
import { Icon } from '../Icon'
import { useRoller } from '../sheet/rollerContext'
import { useSheetDetail, type Breakdown } from '../sheet/SheetDetail'
import { tablesOf } from './breakdownTables'

/** A further table under the number's own in the pane (the two-handed damage). */
export interface BreakdownExtra {
  label: string
  quantity: Quantity
  format?: (value: number) => string
  amountHeader?: ReactNode
}

export interface BreakdownSpec {
  /** Which number it is, unique on the sheet: "ac", "save:str", "skill:stealth". */
  id: string
  /** What the number is: "Armor class", "Stealth". It names the buttons and the table. */
  label: string
  quantity: Quantity
  /** How the number reads; a bonus reads with its sign. Defaults to the plain number. */
  format?: (value: number) => string
  /** The heading of the amount column; the label when absent. */
  amountHeader?: ReactNode
  /** The words of the total row; the label when absent. */
  totalLabel?: ReactNode
  /** The pane's heading, when it is not the label and the number. */
  title?: string
  also?: BreakdownExtra[]
}

/** The text a number reads as. */
const textOf = (spec: BreakdownSpec) => (spec.format ?? String)(spec.quantity.value)

function breakdownOf(spec: BreakdownSpec): Breakdown {
  return {
    id: spec.id,
    title: spec.title ?? `${spec.label} ${textOf(spec)}`,
    tables: tablesOf(spec),
  }
}

/** Opens the breakdown of a number in the pane; says whether it is the one open. */
function useBreakdown(spec: BreakdownSpec) {
  const detail = useSheetDetail()
  return {
    selected: detail.current?.id === spec.id,
    toggle: () => detail.toggle(breakdownOf(spec)),
  }
}

const howText = (label: string) => `How ${label} adds up`

type Kind = 'mod' | 'score' | 'total'

/** A number in a row or a table cell, with the info button in its own narrow column. */
export function DerivedNumber({
  kind = 'total',
  children,
  rolls = false,
  ...spec
}: BreakdownSpec & {
  /** The width of the column: a modifier, a score, a total (a DC, a save). */
  kind?: Kind
  /** What the button reads, when it is not the number ("1d8 + 3"). */
  children?: ReactNode
  /**
   * The row around the number opens its roll (see `RollCover`), so the number is plain
   * text and only the info button beside it opens how the number adds up.
   */
  rolls?: boolean
}) {
  const { selected, toggle } = useBreakdown(spec)
  const roller = useRoller()
  const text = children ?? textOf(spec)
  const readAs = typeof text === 'string' ? text : textOf(spec)
  return (
    <span className={`derived-number derived-number--${kind}`}>
      {rolls && roller ? (
        <span className="derived-number__value">{text}</span>
      ) : (
        <button
          type="button"
          className="derived-number__value"
          aria-pressed={selected}
          aria-label={`${spec.label}: ${readAs}`}
          onClick={toggle}
        >
          {text}
        </button>
      )}
      <OverlayTrigger placement="top" overlay={<Tooltip>{howText(spec.label)}</Tooltip>}>
        <button
          type="button"
          className="derived-number__info"
          aria-pressed={selected}
          aria-label={howText(spec.label)}
          onClick={toggle}
        >
          <Icon name="info" />
        </button>
      </OverlayTrigger>
    </span>
  )
}

/**
 * The button over a stat box: the whole box opens the breakdown, the info icon in its
 * corner. With `corner` the box opens its roll instead (see `RollCover`) and this is only
 * the info icon in the corner.
 */
export function DerivedBox({
  corner = false,
  ...spec
}: BreakdownSpec & { corner?: boolean }) {
  const { selected, toggle } = useBreakdown(spec)
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{howText(spec.label)}</Tooltip>}>
      <button
        type="button"
        className={`derived-box${corner ? ' derived-box--corner' : ''}`}
        aria-pressed={selected}
        aria-label={howText(spec.label)}
        onClick={toggle}
      >
        <Icon name="info" className="derived-box__icon" />
      </button>
    </OverlayTrigger>
  )
}
