import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NonStandardBadge } from './NonStandardBadge'

describe('NonStandardBadge', () => {
  it('renders a warning note with the deviation label', () => {
    render(<NonStandardBadge reason="Not on the class list" />)
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('Non-standard')
  })
})
