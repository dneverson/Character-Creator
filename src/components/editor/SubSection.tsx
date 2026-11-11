import type { ReactNode } from 'react'
import { TRAIL_ATTRIBUTE } from './sectionTrail'

interface Props {
  title: string
  subtitle?: ReactNode
  /** Right-aligned controls beside the sub-heading. */
  actions?: ReactNode
  children: ReactNode
}

/**
 * A titled part inside an EditorSection, for sections that combine closely
 * related steps (e.g. the ability score method and the score assignment). It is
 * always shown - the parent card is the collapse unit - and consecutive parts are
 * divided by a rule (`.editor-subsection` in index.css).
 */
export function SubSection({ title, subtitle, actions, children }: Props) {
  return (
    <section className="editor-subsection" {...{ [TRAIL_ATTRIBUTE]: title }}>
      <div className="d-flex align-items-center gap-2 mb-2">
        <div className="flex-grow-1">
          <h3 className="h6 mb-0">{title}</h3>
          {subtitle && <div className="small text-body-secondary">{subtitle}</div>}
        </div>
        {actions && <div>{actions}</div>}
      </div>
      {children}
    </section>
  )
}
