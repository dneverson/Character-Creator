import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Entries } from '../text/Entries'
import { EntryContext } from '../text/entryContext'
import { BookStatblock } from './BookStatblock'

vi.mock('../data/dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  const fluff: Record<string, unknown> = {
    'generated/gendata-tables.json': {
      table: [
        {
          type: 'table',
          name: 'Loot',
          source: 'XX',
          caption: 'Loot',
          colLabels: ['d2', 'Item'],
          rows: [['1', 'A coin']],
        },
      ],
    },
    'bestiary/fluff-index.json': { MM: 'fluff-bestiary-mm.json' },
    'bestiary/fluff-bestiary-mm.json': {
      monsterFluff: [
        { name: 'Goblin', source: 'MM', entries: ['Small and mean.'], images: [] },
      ],
    },
  }
  return {
    fetchData: async (path: string): Promise<unknown> => {
      if (path in fluff) return fluff[path]
      try {
        return JSON.parse(readFileSync(`public/data/${path}`, 'utf8'))
      } catch {
        throw new Error(`Failed to load data "${path}": HTTP 404`)
      }
    },
  }
})

/** An observer the test drives by hand. */
function installObserver() {
  const reports: ((visible: boolean) => void)[] = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        reports.push((isIntersecting) =>
          callback([{ isIntersecting } as IntersectionObserverEntry]),
        )
      }
      observe() {}
      disconnect() {}
    },
  )
  return reports
}

afterEach(() => vi.unstubAllGlobals())

const spell = {
  type: 'statblock' as const,
  tag: 'spell',
  name: 'Fireball',
  source: 'PHB',
}

describe('BookStatblock', () => {
  it('keeps its space and reads nothing until it is near', () => {
    installObserver()
    const { container } = render(<BookStatblock entry={spell} root={null} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading Fireball')
    expect(container.querySelector('.book-statblock')).toHaveStyle({ minHeight: '8rem' })
  })

  it('draws the entry with the lookup description of its kind once near', async () => {
    const reports = installObserver()
    const { container } = render(
      <BookStatblock entry={{ ...spell, style: 'narrow' }} root={null} />,
    )
    act(() => reports[0](true))
    expect(await screen.findByRole('heading', { name: 'Fireball' })).toBeInTheDocument()
    expect(container.querySelector('.entry-book')).toBeInTheDocument()
    expect(container.querySelector('.book-statblock')).toHaveClass('is-narrow')
    expect(container.querySelector('.book-statblock')).not.toHaveClass('is-loading')
  })

  it('reserves more space for a creature than for the rest', () => {
    installObserver()
    const { container } = render(
      <BookStatblock
        entry={{ type: 'statblock', tag: 'creature', name: 'Goblin', source: 'MM' }}
        root={null}
      />,
    )
    expect(container.querySelector('.book-statblock')).toHaveStyle({ minHeight: '20rem' })
  })

  it('prints the name the book gives it, and runs its parts in', async () => {
    const reports = installObserver()
    render(
      <EntryContext.Provider value={{ book: true, words: [] }}>
        <BookStatblock
          entry={{
            type: 'statblock',
            tag: 'creature',
            name: 'Goblin',
            source: 'MM',
            displayName: 'Goblin Boss',
            style: 'inset',
          }}
          root={null}
        />
      </EntryContext.Provider>,
    )
    act(() => reports[0](true))
    expect(
      await screen.findByRole('heading', { name: 'Goblin Boss' }),
    ).toBeInTheDocument()
    expect(document.querySelector('.book-run-in')).toBeInTheDocument()
    expect(document.querySelector('.book-statblock')).toHaveClass('is-inset')
  })

  it('says so, and still links to the lookup, when the content does not have it', async () => {
    const reports = installObserver()
    render(
      <BookStatblock entry={{ ...spell, name: 'No Such Spell Anywhere' }} root={null} />,
    )
    act(() => reports[0](true))
    expect(await screen.findByText(/not in the loaded content/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'No Such Spell Anywhere' }),
    ).toBeInTheDocument()
  })

  it('draws a description a book keeps, with its name', async () => {
    const reports = installObserver()
    render(
      <BookStatblock
        entry={{ type: 'statblock', prop: 'monsterFluff', name: 'Goblin', source: 'MM' }}
        root={null}
      />,
    )
    act(() => reports[0](true))
    expect(await screen.findByText('Small and mean.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Goblin' })).toBeInTheDocument()
  })

  it('draws a table of the books as it is, with no panel', async () => {
    const reports = installObserver()
    const { container } = render(
      <BookStatblock
        entry={{ type: 'statblock', tag: 'table', name: 'Loot', source: 'XX' }}
        root={null}
      />,
    )
    act(() => reports[0](true))
    expect(await screen.findByText('A coin')).toBeInTheDocument()
    expect(container.querySelector('.entry-book')).toBeNull()
  })

  it('says so for a name nothing describes, and for a failed read', async () => {
    const reports = installObserver()
    render(
      <BookStatblock
        entry={{ type: 'statblock', prop: 'monsterFluff', name: 'Nobody', source: 'MM' }}
        root={null}
      />,
    )
    act(() => reports[0](true))
    expect(await screen.findByText(/not in the loaded content/)).toBeInTheDocument()
  })

  it('stays shut until opened when the book collapses it, then reads it', async () => {
    const reports = installObserver()
    render(<BookStatblock entry={{ ...spell, collapsed: true }} root={null} />)
    act(() => reports[0](true))
    expect(screen.getByText('Fireball').tagName).toBe('SUMMARY')
    expect(screen.queryByRole('heading', { name: 'Fireball' })).toBeNull()
    await userEvent.click(screen.getByText('Fireball'))
    expect(await screen.findByRole('heading', { name: 'Fireball' })).toBeInTheDocument()
    await userEvent.click(screen.getByText('Fireball', { selector: 'summary' }))
    await waitFor(() =>
      expect(document.querySelector('details')).not.toHaveAttribute('open'),
    )
  })

  it('is drawn by the entries where the text has a stat block', async () => {
    const reports = installObserver()
    render(
      <EntryContext.Provider
        value={{
          book: true,
          words: [],
          renderStatblock: (entry) => <BookStatblock entry={entry} root={null} />,
        }}
      >
        <Entries entries={[spell]} />
      </EntryContext.Provider>,
    )
    act(() => reports[0](true))
    expect(await screen.findByRole('heading', { name: 'Fireball' })).toBeInTheDocument()
  })
})
