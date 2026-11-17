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
    'tables.json': {
      table: [
        {
          type: 'table',
          name: 'Plane Loot',
          source: 'XY',
          caption: 'Plane Loot',
          colLabels: ['d2', 'Item'],
          rows: [['1', 'A shard']],
        },
      ],
    },
    'bestiary/fluff-index.json': { MM: 'fluff-bestiary-mm.json' },
    'bestiary/fluff-bestiary-mm.json': {
      monsterFluff: [
        { name: 'Goblin', source: 'MM', entries: ['Small and mean.'], images: [] },
        {
          name: 'Ogre',
          source: 'MM',
          entries: [{ type: 'section', name: 'Ogre', entries: ['Big.'] }],
        },
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
    expect(container.querySelector('.printed-spell')).toBeInTheDocument()
    expect(container.querySelector('.book-statblock')).toHaveClass('is-narrow')
    expect(container.querySelector('.book-statblock')).not.toHaveClass('is-loading')
  })

  it('says where it is printed when the text only shows it', () => {
    installObserver()
    render(<BookStatblock entry={{ ...spell, printedOn: 334 }} root={null} />)
    expect(screen.getByText('Printed on page 334')).toBeInTheDocument()
  })

  it('says nothing about a page when it is printed where it stands', () => {
    installObserver()
    render(<BookStatblock entry={spell} root={null} />)
    expect(screen.queryByText(/Printed on page/)).toBeNull()
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

  it('prints a description plain, without the name its heading already has', async () => {
    const reports = installObserver()
    const { container } = render(
      <EntryContext.Provider value={{ book: true, words: [] }}>
        <BookStatblock
          entry={{
            type: 'statblock',
            prop: 'monsterFluff',
            name: 'Ogre',
            source: 'MM',
            data: { renderCompact: { isSkipRootName: true } },
          }}
          root={null}
          headed
        />
      </EntryContext.Provider>,
    )
    act(() => reports[0](true))
    expect(await screen.findByText('Big.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ogre' })).toBeNull()
    expect(container.querySelector('.entry-book')).toBeNull()
  })

  it('finds a description when the text spells the book in lower case', async () => {
    const reports = installObserver()
    render(
      <BookStatblock
        entry={{ type: 'statblock', prop: 'monsterFluff', name: 'Goblin', source: 'mm' }}
        root={null}
      />,
    )
    act(() => reports[0](true))
    expect(await screen.findByText('Small and mean.')).toBeInTheDocument()
  })

  it('draws a table a book keeps on its own', async () => {
    const reports = installObserver()
    render(
      <BookStatblock
        entry={{ type: 'statblock', tag: 'table', name: 'Plane Loot', source: 'XY' }}
        root={null}
      />,
    )
    act(() => reports[0](true))
    expect(await screen.findByText('A shard')).toBeInTheDocument()
  })

  it('names what is missing and the book it is from', async () => {
    const reports = installObserver()
    render(
      <BookStatblock
        entry={{ type: 'statblock', tag: 'variantrule', name: 'Nope', source: 'XScreen' }}
        root={null}
      />,
    )
    act(() => reports[0](true))
    expect(await screen.findByText('(XScreen)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nope' })).toBeInTheDocument()
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
