/**
 * Scroll `body` by the least that brings `el` inside it: nothing when it is in view. Done on
 * the list's own box, so the page and the reading pane never move with it.
 */
export function keepInView(body: HTMLElement, el: Element): void {
  const box = body.getBoundingClientRect()
  const row = el.getBoundingClientRect()
  if (box.height === 0) return
  if (row.top < box.top) body.scrollTop += row.top - box.top
  else if (row.bottom > box.bottom) body.scrollTop += row.bottom - box.top - box.height
}
