import type { ChangeEvent, ComponentProps, KeyboardEvent } from 'react'
import Form from 'react-bootstrap/Form'
import { useDraft } from './useDraft'

type DraftInputProps = Omit<
  ComponentProps<typeof Form.Control>,
  'value' | 'onChange' | 'onBlur' | 'onKeyDown'
> & {
  value: string
  onCommit: (next: string) => void
}

/**
 * Typing reports an `inputType` of `insertText`, `deleteContentBackward`, `insertFromPaste`
 * and so on; the stepper arrows, ArrowUp/ArrowDown and the wheel report none of those
 * (none at all, or `insertReplacementText`), so those are the changes that commit at once.
 */
function isTyped(e: Event) {
  const kind = 'inputType' in e && typeof e.inputType === 'string' ? e.inputType : ''
  return /^(insert|delete|history)/.test(kind) && kind !== 'insertReplacementText'
}

/**
 * A text, number or textarea control that commits on blur (and on Enter unless it
 * is a textarea) instead of on every keystroke. See `useDraft`.
 */
export function DraftInput({ value, onCommit, ...rest }: DraftInputProps) {
  const { text, change, commit } = useDraft(value, onCommit)
  const multiline = rest.as === 'textarea'
  return (
    <Form.Control
      {...rest}
      value={text}
      onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        change(e.target.value, rest.type === 'number' && !isTyped(e.nativeEvent))
      }
      onBlur={commit}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!multiline && e.key === 'Enter') commit()
      }}
    />
  )
}
