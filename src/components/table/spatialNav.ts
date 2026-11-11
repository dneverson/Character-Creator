// 2D spatial keyboard navigation over a container's focusable elements. Arrow
// keys move focus to the nearest focusable in the pressed physical direction
// (by on-screen geometry), not in linear DOM/tab order - so a layout like
//
//     A
//   B C D
//     E
//
// lets Down/Right/Left/Up walk between neighbours the way the eye would. Used by
// the detail pane's keyboard navigation; kept generic (no dataset knowledge) so
// any pane's content gets the same behaviour.

/** The physical direction an arrow key moves the focus. */
export type Dir = 'up' | 'down' | 'left' | 'right'

// The standard focusable set, minus anything explicitly removed from the tab
// order (`tabindex="-1"`). Disabled controls are excluded so they can't be
// landed on. Elements are further filtered to those actually visible below.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * The visible focusable elements inside `container`, in document order. Hidden
 * elements (a collapsed chapter's contents, `display: none`) report a null
 * `offsetParent` and are dropped, so navigation only ever lands on something the
 * user can see. Content portalled outside the container (e.g. an open lightbox
 * modal) is not a descendant and is naturally excluded.
 */
export function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

function center(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/**
 * The nearest focusable to `current` strictly in direction `dir`, or null when
 * there is none (the boundary - the caller decides what a boundary means, e.g.
 * Left past the first element walks back to the grid). Candidates must lie on
 * the correct side of the current element's centre; among them the score favours
 * a short step along the travel axis and penalises drift on the cross axis
 * (weight 2), so same-row Left/Right and same-column Up/Down win over diagonals.
 */
export function nextInDirection(
  items: HTMLElement[],
  current: HTMLElement,
  dir: Dir,
): HTMLElement | null {
  const cur = center(current.getBoundingClientRect())
  let best: HTMLElement | null = null
  let bestScore = Infinity
  for (const el of items) {
    if (el === current) continue
    const c = center(el.getBoundingClientRect())
    const dx = c.x - cur.x
    const dy = c.y - cur.y
    let primary: number
    let cross: number
    // A 1px epsilon keeps sub-pixel rounding from rejecting a true neighbour.
    if (dir === 'right') {
      if (dx <= 1) continue
      primary = dx
      cross = Math.abs(dy)
    } else if (dir === 'left') {
      if (dx >= -1) continue
      primary = -dx
      cross = Math.abs(dy)
    } else if (dir === 'down') {
      if (dy <= 1) continue
      primary = dy
      cross = Math.abs(dx)
    } else {
      if (dy >= -1) continue
      primary = -dy
      cross = Math.abs(dx)
    }
    const score = primary + cross * 2
    if (score < bestScore) {
      bestScore = score
      best = el
    }
  }
  return best
}

/**
 * The topmost-then-leftmost focusable - the entry point when focus first moves
 * into the container (Right past the grid body). Elements within ~8px of the top
 * of the current best count as the same visual row, so the leftmost of a top row
 * wins over one slightly higher but far to the right.
 */
export function firstInReadingOrder(items: HTMLElement[]): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestRect: DOMRect | null = null
  for (const el of items) {
    const rect = el.getBoundingClientRect()
    if (!bestRect) {
      best = el
      bestRect = rect
      continue
    }
    const sameRow = Math.abs(rect.top - bestRect.top) < 8
    if (rect.top < bestRect.top - 8 || (sameRow && rect.left < bestRect.left)) {
      best = el
      bestRect = rect
    }
  }
  return best
}
