import { useEffect, useState, type RefObject } from 'react'

/** The attribute that marks a part of a section as a stop on the sticky header's trail. */
export const TRAIL_ATTRIBUTE = 'data-section-trail'

/** The height of the fixed navbar, which the sticky section headers hang beneath. */
export function navbarHeight(): number {
  const value = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--app-navbar-height'),
  )
  return Number.isFinite(value) ? value : 0
}

/**
 * The labels of the marked parts that cross the line under the section's stuck
 * header, outermost first ("Class Features", "Druid 5"). Empty when the line is
 * outside the section, or when no marked part is under it.
 */
export function trailAt(card: HTMLElement, headerBottom: number): string[] {
  const cardBox = card.getBoundingClientRect()
  if (cardBox.top > headerBottom || cardBox.bottom < headerBottom) return []
  const labels: string[] = []
  for (const part of card.querySelectorAll<HTMLElement>(`[${TRAIL_ATTRIBUTE}]`)) {
    const box = part.getBoundingClientRect()
    if (box.top <= headerBottom && box.bottom > headerBottom) {
      labels.push(part.getAttribute(TRAIL_ATTRIBUTE) ?? '')
    }
  }
  return labels
}

/**
 * Follows the page scroll and returns the trail ("Class Features: Druid 5") of the
 * marked part that is under the section's sticky header right now, or null.
 */
export function useSectionTrail(
  cardRef: RefObject<HTMLElement | null>,
  headerRef: RefObject<HTMLElement | null>,
  active: boolean,
): string | null {
  const [trail, setTrail] = useState<string | null>(null)
  useEffect(() => {
    const card = cardRef.current
    const header = headerRef.current
    if (!active || !card || !header) return
    let frame = 0
    const update = () => {
      frame = 0
      const pinnedAt = navbarHeight()
      const labels = trailAt(card, pinnedAt + header.getBoundingClientRect().height)
      // Only while this section's header is actually pinned: its card has scrolled past the navbar.
      const pinned = card.getBoundingClientRect().top < pinnedAt - 0.5
      setTrail(pinned && labels.length > 0 ? labels.join(': ') : null)
    }
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [cardRef, headerRef, active])
  return active ? trail : null
}
