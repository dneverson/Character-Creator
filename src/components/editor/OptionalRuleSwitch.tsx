// A switch for a rule the book makes optional (an extra proficiency of a feature, Tasha's
// Customizing Your Origin): what it does in the label, and that it depends on the DM.

import type { ReactNode } from 'react'
import Badge from 'react-bootstrap/Badge'
import Form from 'react-bootstrap/Form'

export function OptionalRuleSwitch({
  id,
  on,
  onToggle,
  children,
}: {
  id: string
  on: boolean
  onToggle: (on: boolean) => void
  /** The label: the rule's name and what it does. */
  children: ReactNode
}) {
  return (
    <div className="border rounded p-3 d-flex flex-wrap align-items-center gap-2">
      <Form.Check
        type="switch"
        id={id}
        checked={on}
        onChange={(e) => onToggle(e.target.checked)}
        label={children}
      />
      <Badge bg="warning" text="dark">
        Optional - depends on your DM
      </Badge>
    </div>
  )
}
