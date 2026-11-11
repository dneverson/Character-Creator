import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppFooter } from './AppFooter'

describe('AppFooter', () => {
  it('credits one author, the Matrix Dice idea, and links the repository', () => {
    render(<AppFooter />)
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent(
      'Author: Derry Everson. Matrix Dice idea: Mikel Jensen.',
    )
    expect(footer).not.toHaveTextContent('Authors')
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/dneverson/Character-Creator',
    )
  })
})
