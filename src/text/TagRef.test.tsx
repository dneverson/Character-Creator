// A reference in a text: drawn as a button, a tooltip with the entry's summary on hover,
// a click that opens the entry in Quick lookup.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLookupStore } from '../lookup/state'
import { Entries } from './Entries'
import { TaggedText } from './TaggedText'

vi.mock('../data/dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  return {
    fetchData: async (path: string): Promise<unknown> => {
      try {
        return JSON.parse(readFileSync(`public/data/${path}`, 'utf8'))
      } catch {
        throw new Error(`Failed to load data "${path}": HTTP 404`)
      }
    },
  }
})

beforeEach(() => useLookupStore.getState().closeLookup())
afterEach(() => useLookupStore.getState().closeLookup())

describe('references in a text', () => {
  it('draws a reference as a button and the rest as text', () => {
    render(<TaggedText text="Cast {@spell fireball|phb|a fire ball} or {@b bold} now." />)
    expect(screen.getByRole('button', { name: 'a fire ball' })).toBeInTheDocument()
    expect(screen.getByText(/Cast/).textContent).toBe('Cast a fire ball or bold now.')
  })

  it('leaves a roll, a number and unbalanced braces as plain text', () => {
    render(<TaggedText text="Deal {@damage 2d6} at {@dc 15} {@spell broken" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/Deal/).textContent).toContain('2d6 at DC 15')
  })

  it('shows the kind, name and start of the text on hover', async () => {
    render(<Entries entries={['See {@condition prone}.']} />)
    await userEvent.hover(screen.getByRole('button', { name: 'prone' }))
    const tip = await screen.findByRole('tooltip')
    await waitFor(() => expect(tip).toHaveTextContent('Condition - Prone'))
    expect(tip.textContent).toMatch(/crawl|ground|Prone/)
    expect(tip).toHaveTextContent('Click to open it in Lookup.')
  })

  it('says so when the loaded content has no such entry', async () => {
    render(<TaggedText text="{@spell zzz no such spell}" />)
    await userEvent.hover(screen.getByRole('button'))
    expect(await screen.findByText(/not in the loaded content/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button'))
    expect(useLookupStore.getState().open).toBe(false)
  })

  it('opens the entry in Quick lookup on a click', async () => {
    render(<TaggedText text="{@spell fireball}" />)
    await userEvent.click(screen.getByRole('button', { name: 'fireball' }))
    await waitFor(() => expect(useLookupStore.getState().open).toBe(true))
    expect(useLookupStore.getState().entryId).toBe('spell:fireball|phb')
  })
})
