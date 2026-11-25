// The boxes the 6-digit sign-in code is typed into, one digit each. Typing moves on to the
// next box, Backspace on an empty box goes back, a pasted code (or one the phone's keyboard
// offers from the email) fills every box, and the code is handed over as soon as the last
// box is filled.

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import Form from 'react-bootstrap/Form'

interface Props {
  length: number
  /** Called with the whole code when the last digit is entered. */
  onComplete: (code: string) => void
  disabled?: boolean
  invalid?: boolean
  /** The id of the text that labels the group. */
  labelledBy: string
  /** The id of the text that describes the group (an error, for instance). */
  describedBy?: string
}

export function CodeInput({
  length,
  onComplete,
  disabled,
  invalid,
  labelledBy,
  describedBy,
}: Props) {
  const [digits, setDigits] = useState<string[]>(() => Array<string>(length).fill(''))
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  const focusBox = (index: number) => {
    boxes.current[Math.min(Math.max(index, 0), length - 1)]?.focus()
  }

  /** Put the digits of `text` into the boxes from `start` on. */
  const fill = (start: number, text: string) => {
    const entered = text.replace(/\D/g, '').slice(0, length - start)
    if (entered === '') return
    const next = [...digits]
    for (let at = 0; at < entered.length; at += 1) next[start + at] = entered[at]
    setDigits(next)
    if (next.every((digit) => digit !== '')) onComplete(next.join(''))
    else focusBox(start + entered.length)
  }

  const clear = (index: number) =>
    setDigits((current) => current.map((digit, at) => (at === index ? '' : digit)))

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Backspace' && digits[index] === '' && index > 0) {
      event.preventDefault()
      clear(index - 1)
      focusBox(index - 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusBox(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusBox(index + 1)
    }
  }

  const onPaste = (index: number, event: ClipboardEvent<HTMLElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text')
    // A whole code replaces what is there; a piece goes in from the box it was pasted in.
    fill(text.replace(/\D/g, '').length >= length ? 0 : index, text)
  }

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="d-flex justify-content-center gap-2"
    >
      {digits.map((digit, index) => (
        <Form.Control
          // The boxes are a fixed row: a position is the identity of its box.
          key={index}
          ref={(element: HTMLInputElement | null) => {
            boxes.current[index] = element
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          isInvalid={invalid}
          autoFocus={index === 0}
          disabled={disabled}
          value={digit}
          className="code-digit text-center fs-4 px-0 flex-fill"
          style={{ minWidth: 0, maxWidth: '3rem', height: '3.25rem' }}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            const value = event.target.value
            if (value === '') clear(index)
            else fill(index, value)
          }}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={(event) => onPaste(index, event)}
        />
      ))}
    </div>
  )
}
