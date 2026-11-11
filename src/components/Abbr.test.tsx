import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { Abbr, AbbrText } from './Abbr'
import { _clearBookSources, registerBookSources } from '../data/glossary'

beforeEach(() => {
  _clearBookSources()
})

describe('Abbr', () => {
  it('renders a known code as an abbr with the hover affordance', () => {
    render(<Abbr code="STR" kind="ability" />)
    const el = screen.getByText('STR')
    expect(el.tagName).toBe('ABBR')
    expect(el).toHaveClass('abbr')
  })

  it('shows the category and full name on hover', async () => {
    const user = userEvent.setup()
    render(<Abbr code="STR" kind="ability" />)
    await user.hover(screen.getByText('STR'))
    const tip = await screen.findByRole('tooltip')
    // The matched letters are re-cased to the acronym (STR -> STRength).
    expect(tip).toHaveTextContent('Ability Score · STRength')
  })

  it('expands a registered book source', async () => {
    registerBookSources([{ source: 'PHB', name: "Player's Handbook (2014)" }])
    const user = userEvent.setup()
    render(<Abbr code="PHB" kind="source" />)
    await user.hover(screen.getByText('PHB'))
    const tip = await screen.findByRole('tooltip')
    // PHB -> Player's HandBook, matched letters re-cased to the acronym.
    expect(tip).toHaveTextContent("Sourcebook · Player's HandBook (2014)")
  })

  it('renders an unknown code as plain text with no tooltip affordance', () => {
    render(<Abbr code="ZZZ" kind="ability" />)
    const el = screen.getByText('ZZZ')
    expect(el.tagName).not.toBe('ABBR')
  })

  it('renders an ambiguous unscoped code as plain text', () => {
    // "M" is Medium / Material / Melee Weapon - no kind, so no expansion.
    render(<Abbr code="M" />)
    expect(screen.getByText('M').tagName).not.toBe('ABBR')
  })
})

describe('AbbrText', () => {
  it('wraps an acronym embedded in a string, leaving the rest as text', async () => {
    const user = userEvent.setup()
    const { container } = render(<AbbrText text="Wizards RPG Team" />)
    const el = screen.getByText('RPG')
    expect(el.tagName).toBe('ABBR')
    expect(container).toHaveTextContent('Wizards RPG Team')
    await user.hover(el)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Term · Role Playing Game',
    )
  })

  it('wraps an acronym inside a decoded group label (DM screen)', () => {
    render(<AbbrText text="DM screen" />)
    expect(screen.getByText('DM').tagName).toBe('ABBR')
  })

  it('leaves a string with no known acronym untouched', () => {
    const { container } = render(<AbbrText text="Some Person" />)
    expect(container.querySelector('abbr')).toBeNull()
    expect(container).toHaveTextContent('Some Person')
  })
})
