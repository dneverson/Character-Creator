// Entries side by side. Each compared entry is a column; every fact of their
// shared description (see facts.ts) is a row, so the same fact always sits on the
// same line and an entry with nothing there is simply blank. A row whose columns
// all say the same is marked, so the eye goes to where the entries differ.
//
// The whole comparison is ONE table with ONE scroll: a column header that stays
// in view, a label column that stays in view, and heading rows between groups.

import { useCallback, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import Badge from 'react-bootstrap/Badge'
import Modal from 'react-bootstrap/Modal'
import Table from 'react-bootstrap/Table'
import { deviceSettings } from '../../storage/deviceSettings'
import { allSame, factValue, type Describe, type FactGroup } from './facts'
import {
  FACT_LABEL_CLASS,
  GROUP_HEAD_CLASS,
  groupHeadStyle,
  groupHeadTextStyle,
} from './factStyles'

interface Props<T> {
  /** The window's title ("Compare classes"). */
  title: string
  entries: T[]
  idOf: (entry: T) => string
  /** The name heading an entry's column. */
  nameOf: (entry: T) => ReactNode
  /**
   * Short tags under the name (the edition year), kept in the header so a column
   * stays identifiable after scrolling past the row that says the same.
   */
  tagsOf?: (entry: T) => string[]
  describe: Describe<T>
  show: boolean
  onHide: () => void
}

// Where the user's dragged window size is stored between visits. The window opens
// at its CSS default size and only overrides it once the user has resized it.
const COMPARE_SIZE_KEY = 'compare-modal-size'

// The table scrolls inside its own bounded box (both axes), so its column header
// must stick to the top of that box - otherwise the names scroll out of view the
// moment you read past the first rows. An opaque body-coloured background keeps
// the text from showing through the pinned header. z-index 2 keeps it above the
// frozen label column where they cross while scrolling down.
const stickyHeadStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: 'var(--bs-body-bg)',
}

// The leftmost column (fact labels and group headings) is frozen horizontally so
// those labels stay visible while the entry columns scroll sideways. An opaque
// background stops the scrolling cells showing through it.
const stickyLabelStyle: CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  background: 'var(--bs-body-bg)',
}

// The top-left corner is frozen on BOTH axes at once, so it must sit above both
// the sticky header row and the sticky label column.
const stickyCornerStyle: CSSProperties = {
  ...stickyHeadStyle,
  left: 0,
  zIndex: 3,
}

// Column sizing for the fixed-layout table. The label column is pinned just wide
// enough for its longest label; the entry columns carry no width, so they split
// ALL the remaining space and the labels never soak up the slack. The table's
// min-width guarantees each entry column at least ENTRY_COL_MIN, so with many
// columns the wrapper scrolls instead of the columns collapsing to a few pixels.
const LABEL_COL_WIDTH = 176
const ENTRY_COL_MIN = 240

// A small, subtle marker that a row's columns are identical. Content stays fully
// readable; this only flags where there is nothing to choose between them.
function SameBadge() {
  return (
    <Badge bg="success" className="fw-normal">
      Same
    </Badge>
  )
}

interface GroupRowsProps<T> {
  group: FactGroup<T>
  entries: T[]
  idOf: (entry: T) => string
}

// One group as table rows: a ruled heading row, then one row per fact with every
// entry's value side by side. A group heads its label column with its title, or
// each entry's column with that entry's own title.
function GroupRows<T>({ group, entries, idOf }: GroupRowsProps<T>) {
  if (group.facts.length === 0) return null
  return (
    <>
      <tr>
        <td
          className={GROUP_HEAD_CLASS}
          style={{ ...groupHeadTextStyle, ...stickyLabelStyle }}
        >
          {group.entryTitle ? null : group.title}
        </td>
        {entries.map((entry) => (
          <td
            className={GROUP_HEAD_CLASS}
            style={group.entryTitle ? groupHeadTextStyle : groupHeadStyle}
            key={idOf(entry)}
          >
            {group.entryTitle?.(entry)}
          </td>
        ))}
      </tr>
      {group.facts.map((fact) => (
        <tr key={fact.key}>
          <th scope="row" className={FACT_LABEL_CLASS} style={stickyLabelStyle}>
            <div>{fact.label}</div>
            {allSame(entries.map(fact.text)) && (
              <div className="mt-1">
                <SameBadge />
              </div>
            )}
          </th>
          {entries.map((entry) => (
            <td className="align-top" key={idOf(entry)}>
              {factValue(fact, entry)}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

type ComparisonProps<T> = Pick<
  Props<T>,
  'entries' | 'idOf' | 'nameOf' | 'tagsOf' | 'describe'
>

// The comparison itself. Its own component so the entries are only described
// while the window is open.
function Comparison<T>({ entries, idOf, nameOf, tagsOf, describe }: ComparisonProps<T>) {
  // A fact no compared entry has a value for says nothing, so it is left out, and
  // a group left with no facts goes with it.
  const groups = useMemo(
    () =>
      describe(entries).map((group) => ({
        ...group,
        facts: group.facts.filter((fact) => entries.some((entry) => fact.text(entry))),
      })),
    [describe, entries],
  )

  // Whole-comparison sameness: every row matches across all columns.
  const identical = useMemo(() => {
    const facts = groups.flatMap((group) => group.facts)
    return facts.length > 0 && facts.every((fact) => allSame(entries.map(fact.text)))
  }, [groups, entries])

  return (
    <>
      {identical && (
        <div className="alert alert-secondary py-2 mb-3 flex-shrink-0" role="status">
          These entries are identical. Every row below matches across all columns.
        </div>
      )}
      <div className="table-responsive flex-grow-1" style={{ minHeight: 0 }}>
        <Table
          className="mb-0 small"
          style={{
            tableLayout: 'fixed',
            minWidth: LABEL_COL_WIDTH + entries.length * ENTRY_COL_MIN,
          }}
        >
          <colgroup>
            <col style={{ width: LABEL_COL_WIDTH }} />
            {entries.map((entry) => (
              <col key={idOf(entry)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={stickyCornerStyle} />
              {entries.map((entry) => (
                <th scope="col" key={idOf(entry)} style={stickyHeadStyle}>
                  <div>{nameOf(entry)}</div>
                  {tagsOf?.(entry).map((tag) => (
                    <Badge bg="secondary" className="fw-normal mt-1 me-1" key={tag}>
                      {tag}
                    </Badge>
                  ))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows group={group} entries={entries} idOf={idOf} key={group.key} />
            ))}
          </tbody>
        </Table>
      </div>
    </>
  )
}

export function CompareModal<T>({ title, entries, show, onHide, ...rest }: Props<T>) {
  // The window is user-resizable (CSS `resize: both`, see index.css). We remember
  // the size the user drags to: on open, apply the saved size to the content box,
  // then watch it for changes and store the new size. The size is a device
  // setting; a browser that refuses to keep it just opens at the default.
  const resizeObs = useRef<ResizeObserver | null>(null)

  const rememberSize = useCallback(() => {
    const content = document.querySelector<HTMLElement>('.compare-modal-content')
    if (!content) return
    try {
      const raw = deviceSettings.getItem(COMPARE_SIZE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { w?: number; h?: number }
        if (typeof saved.w === 'number') content.style.width = `${saved.w}px`
        if (typeof saved.h === 'number') content.style.height = `${saved.h}px`
      }
    } catch {
      // Ignore a stored size that cannot be read; the CSS default size still applies.
    }
    // ResizeObserver is absent in non-browser test environments (jsdom); without it
    // the size simply is not kept, which is the correct graceful fallback.
    if (typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(() => {
      deviceSettings.setItem(
        COMPARE_SIZE_KEY,
        JSON.stringify({ w: content.offsetWidth, h: content.offsetHeight }),
      )
    })
    obs.observe(content)
    resizeObs.current = obs
  }, [])

  const forgetObserver = useCallback(() => {
    resizeObs.current?.disconnect()
    resizeObs.current = null
  }, [])

  const enough = entries.length >= 2

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      dialogClassName="compare-modal-dialog"
      contentClassName="compare-modal-content"
      onEntered={rememberSize}
      onExited={forgetObserver}
    >
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body
        // A bounded-height flex column so the single comparison table is one scroll
        // region (both axes). Without the height bound the table grows to the full
        // height of every entry, pushing its horizontal scrollbar thousands of
        // pixels below the fold where it can never be reached.
        style={
          enough
            ? {
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
              }
            : undefined
        }
      >
        {enough ? (
          <Comparison entries={entries} {...rest} />
        ) : (
          <p className="text-body-secondary mb-0">Select at least two rows to compare.</p>
        )}
      </Modal.Body>
    </Modal>
  )
}
