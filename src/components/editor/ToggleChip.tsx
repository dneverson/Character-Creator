// One pick as a toggle button: a click places it, a click on a placed one takes it
// back. Shared by every "choose from a short list" control (ability increases,
// skills) so they look and behave the same.

import type { ReactNode } from 'react'
import Button from 'react-bootstrap/Button'

interface Props {
  pressed: boolean
  disabled?: boolean
  /** Hover text; for a disabled chip it says why. */
  title?: string
  onClick: () => void
  children: ReactNode
}

export function ToggleChip({ pressed, disabled, title, onClick, children }: Props) {
  return (
    <Button
      size="sm"
      variant={pressed ? 'primary' : 'secondary'}
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
