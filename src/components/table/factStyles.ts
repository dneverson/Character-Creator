// Styling shared by the two views of an entry's facts: the detail pane (one
// entry) and the compare window (several), so both break their groups the same
// way.

import type { CSSProperties } from 'react'

/** The classes of a group's heading text. */
export const GROUP_HEAD_CLASS = 'text-uppercase text-body-secondary fw-bold'

// A strong rule above and below a group's heading so each block is an obvious
// break. Uses the Bootstrap border token so it tracks the active theme.
export const groupHeadStyle: CSSProperties = {
  borderTop: '2px solid var(--bs-border-color)',
  borderBottom: '2px solid var(--bs-border-color)',
}

/** A group heading cell that carries text: the rules, and small spaced capitals. */
export const groupHeadTextStyle: CSSProperties = {
  ...groupHeadStyle,
  fontSize: '0.72rem',
  letterSpacing: '0.04em',
}

/** The classes of a fact's label cell. */
export const FACT_LABEL_CLASS = 'text-body-secondary fw-semibold align-top'
