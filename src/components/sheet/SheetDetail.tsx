// The sheet's one detail pane: every number's breakdown opens here, beside the table on a
// wide screen (in the same resizable split the browse tables use) and over the sheet on a
// tablet or phone. One open breakdown at a time; the same click closes it and hands focus
// back to the control that opened it.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Button from 'react-bootstrap/Button'
import Offcanvas from 'react-bootstrap/Offcanvas'
import type { Quantity } from '../../derived/types'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useDetailStyle } from '../../theme/theme-context'
import { DerivedTable } from '../editor/DerivedTable'
import { Icon } from '../Icon'
import { DetailPane } from '../table/DetailPane'
import { EntryHeading } from '../table/EntryDetail'

/** From this width the pane sits beside the table (Bootstrap's xl breakpoint). */
export const WIDE = '(min-width: 1200px)'

/** One table of a breakdown: a number, and the lines it adds up from. */
export interface BreakdownTable {
  quantity: Quantity
  ariaLabel: string
  amountHeader: ReactNode
  totalLabel: ReactNode
  format?: (value: number) => string
}

/** What the pane shows: a heading ("Armor class 15") and the tables under it. */
export interface Breakdown {
  /** Which number it is, unique on the sheet ("ac", "save:str"); the same id closes it. */
  id: string
  title: string
  tables: BreakdownTable[]
}

interface SheetDetailValue {
  current: Breakdown | null
  /** Opens the breakdown, or closes it when it is the one already open. */
  toggle: (breakdown: Breakdown) => void
  hide: () => void
}

const CLOSED: SheetDetailValue = {
  current: null,
  toggle: () => undefined,
  hide: () => undefined,
}

const SheetDetailContext = createContext<SheetDetailValue>(CLOSED)
const WideContext = createContext(false)

/** The open breakdown and the means to open or close it; inert outside a provider. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSheetDetail(): SheetDetailValue {
  return useContext(SheetDetailContext)
}

/** Whether the pane sits beside the table rather than over the sheet. */
// eslint-disable-next-line react-refresh/only-export-components
export function useWideSheet(): boolean {
  return useContext(WideContext)
}

/** The heading and the tables of a breakdown, in whichever detail pane style is set. */
function BreakdownDetail({ breakdown }: { breakdown: Breakdown }) {
  const style = useDetailStyle()
  const tables = (
    <div className="d-flex flex-column gap-3">
      {breakdown.tables.map((table) => (
        <DerivedTable key={table.ariaLabel} {...table} aligned />
      ))}
    </div>
  )
  if (style === 'standard') {
    return (
      <div className="p-3">
        <EntryHeading name={breakdown.title} tags={[]} className="mb-3" />
        {tables}
      </div>
    )
  }
  return (
    <div className="entry-book p-3">
      <div className="entry-book__head">
        <h5 className="entry-book__title">{breakdown.title}</h5>
      </div>
      <hr className="entry-book__rule" />
      {tables}
    </div>
  )
}

/** The pane beside the table (a wide screen); nothing while no breakdown is open. */
export function SheetDetailPane() {
  const { current, hide } = useSheetDetail()
  if (!current) return null
  return (
    <DetailPane
      focusedRow={current}
      render={(breakdown) => <BreakdownDetail breakdown={breakdown} />}
      onClose={hide}
    />
  )
}

/** Keeps the open breakdown, the control that opened it, and the pane over a narrow sheet. */
export function SheetDetailProvider({ children }: { children: ReactNode }) {
  const wide = useMediaQuery(WIDE)
  const [current, setCurrent] = useState<Breakdown | null>(null)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  const hide = useCallback(() => {
    setCurrent(null)
    const control = opener.current
    opener.current = null
    if (control?.isConnected) control.focus()
  }, [])

  const toggle = useCallback(
    (breakdown: Breakdown) => {
      if (current?.id === breakdown.id) return hide()
      if (!current) {
        opener.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
      }
      setCurrent(breakdown)
    },
    [current, hide],
  )

  // Escape closes the pane wherever focus is (the opener keeps it when the pane opens).
  useEffect(() => {
    if (!current) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('.modal.show')) return
      hide()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [current, hide])

  const value = useMemo(() => ({ current, toggle, hide }), [current, toggle, hide])

  return (
    <SheetDetailContext.Provider value={value}>
      <WideContext.Provider value={wide}>
        <div ref={setHost}>
          {children}
          {/* In the sheet's own element, so the look of the template reaches it. */}
          <Offcanvas
            show={current !== null && !wide}
            onHide={hide}
            placement="end"
            container={host}
            className="sheet-detail-overlay"
            aria-label={current?.title ?? 'Details'}
          >
            <Offcanvas.Header className="py-2">
              <Button variant="secondary" size="sm" onClick={hide}>
                <Icon name="back" className="me-1" />
                Back
              </Button>
            </Offcanvas.Header>
            <Offcanvas.Body className="p-0">
              {current && (
                <DetailPane
                  focusedRow={current}
                  render={(breakdown) => <BreakdownDetail breakdown={breakdown} />}
                />
              )}
            </Offcanvas.Body>
          </Offcanvas>
        </div>
      </WideContext.Provider>
    </SheetDetailContext.Provider>
  )
}
