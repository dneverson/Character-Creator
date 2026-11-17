// Where a heading stands when the reader goes to it, and which heading counts as the one
// being read. Both come from the height of the sticky bar, and the second from the first, so
// a heading the reader has just gone to is always the one the contents list shows. (When
// they were two numbers, a click on an item scrolled it to just past the line and the list
// showed the item above.)

/** The space between the bar and a heading the pane has scrolled to, in pixels. */
export const GAP = 12

/** How far past the line a heading may be and still count as the one being read. */
export const TOLERANCE = 8

/** Where a heading's top stands, from the top of the pane, when the reader goes to it. */
export const landingOffset = (barHeight: number): number => barHeight + GAP

/** Where the reading line is: a heading whose top is at or above it is the one being read. */
export const readingLine = (barHeight: number): number =>
  landingOffset(barHeight) + TOLERANCE
