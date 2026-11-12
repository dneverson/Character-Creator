import type { CSSProperties } from 'react'

/**
 * The app's icon vocabulary - the single seam between the UI and the icon library
 * (currently Bootstrap Icons). Call sites name an icon by intent (`remove`,
 * `back`, `roll`, …) and never a library class, so switching icon libraries later
 * means editing only this map and the `<i>` render below, not every call site.
 *
 * Only genuine functional affordances belong here - never decoration, and never
 * typography (em-dashes, multiplication signs, etc., which stay literal text).
 */
const ICONS = {
  expand: 'bi-chevron-right',
  themeLight: 'bi-sun-fill',
  themeDark: 'bi-moon-stars-fill',
  themeSystem: 'bi-display',
  warning: 'bi-exclamation-triangle-fill',
  check: 'bi-check-circle-fill',
  info: 'bi-info-circle',
  remove: 'bi-x-lg',
  add: 'bi-plus-lg',
  minus: 'bi-dash-lg',
  moveUp: 'bi-arrow-up',
  moveDown: 'bi-arrow-down',
  back: 'bi-arrow-left',
  roll: 'bi-dice-6-fill',
  historyPrev: 'bi-arrow-counterclockwise',
  historyNext: 'bi-arrow-clockwise',
  history: 'bi-clock-history',
  content: 'bi-book-fill',
} as const

export type IconName = keyof typeof ICONS

type IconProps = {
  name: IconName
  className?: string
  style?: CSSProperties
  /**
   * Accessible label. Omitted (the default) marks the icon decorative
   * (`aria-hidden`) - correct when adjacent text or an `aria-label` already names
   * the control. Supply it only for an icon that stands alone as the label.
   */
  label?: string
}

/** A single icon rendered from the app's semantic vocabulary (see ICONS). */
export function Icon({ name, className, style, label }: IconProps) {
  return (
    <i
      className={`bi ${ICONS[name]}${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}

/** A die showing 1–6 pips (1..6). Values outside that range clamp to a d6 face. */
export type DieFace = 1 | 2 | 3 | 4 | 5 | 6

/**
 * A die face for the roll affordance, whose pip count can change to animate a
 * "rolling" die. The Bootstrap Icons class (`bi-dice-N-fill`) stays inside this
 * seam, so call sites ask for a face by number, never a library class.
 */
export function DieFaceIcon({
  face,
  className,
  style,
  label,
}: {
  face: DieFace
  className?: string
  style?: CSSProperties
  label?: string
}) {
  return (
    <i
      className={`bi bi-dice-${face}-fill${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
