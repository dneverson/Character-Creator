import type { ReactNode } from 'react'
import { DerivedBox, type BreakdownSpec } from '../derived/DerivedNumber'
import { RollCover } from './RollCover'
import { useRoller } from './rollerContext'
import type { RollSpec } from './rollSpec'

/** A titled box of the sheet's fixed part, the one place a heading and its body sit. */
export function FixedPanel({
  title,
  area,
  children,
}: {
  title: string
  /** The grid area the box takes in the sheet's side column. */
  area?: string
  children: ReactNode
}) {
  return (
    <section className="sheet-panel" style={area ? { gridArea: area } : undefined}>
      <h2 className="sheet-panel__title">{title}</h2>
      {children}
    </section>
  )
}

/**
 * A number in a box: its label, the value and, small under it, what goes with it. With a
 * `breakdown` the whole box opens how the number adds up.
 */
export function StatBox({
  label,
  value,
  sub,
  breakdown,
  roll,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  breakdown?: BreakdownSpec
  /**
   * What a click on the box rolls. The box then opens the roll window, and the info icon
   * in its corner opens how the number adds up.
   */
  roll?: RollSpec
}) {
  const rolls = useRoller() !== null && roll !== undefined
  return (
    <div
      className={`sheet-stat${breakdown ? ' sheet-stat--breakdown' : ''}${rolls ? ' roll-host' : ''}`}
      role="group"
      aria-label={label}
    >
      <div className="sheet-stat__label">{label}</div>
      <div className="sheet-stat__value">{value}</div>
      {sub !== undefined && <div className="sheet-stat__sub">{sub}</div>}
      {rolls && <RollCover spec={roll} />}
      {breakdown && <DerivedBox {...breakdown} corner={rolls} />}
    </div>
  )
}
