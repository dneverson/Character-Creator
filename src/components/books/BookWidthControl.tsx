// The width of the text column, for a wide screen: a slider in the reader's bar. It is a
// native range input, so the arrow keys, Home and End work. The width is remembered on this
// device; a phone's column is its screen, so the slider is hidden there (see books.css).

import Form from 'react-bootstrap/Form'
import { appConfig } from '../../config/app'

interface Props {
  width: number
  onChange: (width: number) => void
}

export function BookWidthControl({ width, onChange }: Props) {
  const { min, max, step } = appConfig.books.column
  return (
    <label className="book-width">
      Width
      <Form.Range
        min={min}
        max={max}
        step={step}
        value={width}
        aria-label="Width of the text column"
        aria-valuetext={`${width} pixels`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
