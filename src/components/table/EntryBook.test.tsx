import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _clearBookSources, registerBookSources } from '../../data/glossary'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { bookLayout } from './bookLayout'
import { EntryDetail } from './EntryDetail'
import type { Describe, Fact } from './facts'

interface Weapon {
  name: string
  kind: string
  cost: string
  weight: string
  damage: string
  free: boolean
  page?: number
  text: string
  note: string
}

const sword: Weapon = {
  name: 'Longsword',
  kind: 'Martial melee weapon',
  cost: '15 gp',
  weight: '3 lb.',
  damage: '1d8 slashing',
  free: true,
  page: 215,
  text: 'Sap. If you hit a creature with this weapon, that creature has Disadvantage.',
  note: 'A very long note that is certainly longer than the limit for a pair on one line of the entry.',
}

const fact = (
  key: string,
  label: string,
  text: (w: Weapon) => string,
  role?: Fact<Weapon>['role'],
): Fact<Weapon> => ({ key, label, text, role })

const describeWeapons: Describe<Weapon> = () => [
  {
    key: 'overview',
    title: 'Weapon',
    facts: [
      fact('kind', 'Type', (w) => w.kind, 'summary'),
      fact('cost', 'Cost', (w) => w.cost, 'summary'),
      fact('weight', 'Weight', (w) => w.weight, 'summary'),
      fact('source', 'Source', () => 'XPHB', 'source'),
      fact('edition', 'Edition', () => '2024', 'edition'),
      fact('free', 'In the free rules', (w) => (w.free ? 'Yes' : ''), 'free'),
      fact('page', 'Page', (w) => (w.page ? `p. ${w.page}` : ''), 'page'),
      fact('damage', 'Damage', (w) => w.damage),
    ],
  },
  {
    key: 'text',
    title: 'Text',
    facts: [
      fact('description', 'Description', (w) => w.text, 'body'),
      fact('note', 'Remember', (w) => w.note),
    ],
  },
  { key: 'none', title: 'Mastery', facts: [], empty: 'No mastery.' },
]

beforeEach(() => {
  localStorage.clear()
  registerBookSources([{ source: 'XPHB', name: "Player's Handbook (2024)" }])
})
afterEach(() => {
  _clearBookSources()
  localStorage.clear()
})

function Longsword({ withAction = true }: { withAction?: boolean }) {
  return (
    <EntryDetail
      entry={sword}
      describe={describeWeapons}
      name="Longsword"
      tags={['2024']}
      action={withAction ? <button>Add to items</button> : undefined}
    >
      <p>Extra group</p>
    </EntryDetail>
  )
}

const inStyle = (detailStyle: string, node = <Longsword />) => {
  localStorage.setItem('cc-detail-style', detailStyle)
  return render(<ThemeProvider>{node}</ThemeProvider>)
}

describe('the plain detail pane', () => {
  it('stays a table of facts with the button above, whatever the roles', () => {
    inStyle('standard')
    expect(screen.getByRole('rowheader', { name: 'Damage' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Source' })).toBeInTheDocument()
    const heading = screen.getByRole('heading', { name: 'Longsword' })
    const button = screen.getByRole('button', { name: 'Add to items' })
    expect(
      button.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(document.querySelector('.entry-book')).toBeNull()
  })

  it('renders with no provider at all', () => {
    render(<Longsword withAction={false} />)
    expect(screen.getByRole('heading', { name: 'Longsword' })).toBeInTheDocument()
  })
})

describe.each(['book', 'parchment'])('the %s detail pane', (style) => {
  it('lays the entry out like a book entry, with the source and page in the corner', () => {
    inStyle(style)
    const entry = document.querySelector('.entry-book') as HTMLElement
    expect(within(entry).getByRole('heading', { name: 'Longsword' })).toHaveClass(
      'entry-book__title',
    )
    const printed = entry.querySelector('.entry-book__printed') as HTMLElement
    expect(printed).toHaveTextContent('2024')
    expect(printed).toHaveTextContent('XPHB')
    expect(printed).toHaveTextContent('p. 215')
    expect(entry.querySelector('.entry-book__summary')).toHaveTextContent(
      'Martial melee weapon, 15 gp, 3 lb.',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('keeps every fact: pairs, the body, long facts with a run-in label and empty groups', () => {
    inStyle(style)
    const pairs = document.querySelector('.entry-book__pairs') as HTMLElement
    expect(pairs).toHaveTextContent('Damage 1d8 slashing')
    expect(screen.getByText(/If you hit a creature/)).toBeInTheDocument()
    expect(screen.getByText('Remember.')).toBeInTheDocument()
    expect(screen.getByText(/A very long note/)).toBeInTheDocument()
    expect(screen.getByText('Mastery: No mastery.')).toBeInTheDocument()
    expect(screen.getByText('Extra group')).toBeInTheDocument()
  })

  it('puts the button under the text and a footer naming the book, page and free rules', () => {
    inStyle(style)
    const button = screen.getByRole('button', { name: 'Add to items' })
    const body = screen.getByText(/If you hit a creature/)
    expect(body.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(document.querySelector('.entry-book__footer')).toHaveTextContent(
      "Source: Player's Handbook (2024), page 215. In the free rules.",
    )
  })

  it('has no button row without an action', () => {
    inStyle(style, <Longsword withAction={false} />)
    expect(document.querySelector('.entry-book__action')).toBeNull()
  })
})

describe('bookLayout', () => {
  const groups = describeWeapons([sword])

  it('sorts facts by role and keeps an edition that no tag shows', () => {
    const shown = bookLayout(groups, sword, ['2024'])
    expect(shown.pairs.map((p) => p.key)).toEqual(['overview-damage'])
    const hidden = bookLayout(groups, sword, [])
    expect(hidden.pairs.map((p) => p.key)).toContain('overview-edition')
  })

  it('names no page or free rules when the entry has none, and no footer without a source', () => {
    const bare = bookLayout(groups, { ...sword, free: false, page: undefined }, [])
    expect(bare.free).toBe(false)
    expect(bare.pageNumber).toBe('')
    const noSource = bookLayout(
      [{ key: 'g', facts: [fact('d', 'Damage', () => '1')] }],
      sword,
      [],
    )
    expect(noSource.sourceCode).toBe('')
    expect(noSource.pairs).toHaveLength(1)
  })

  it('says what an untitled empty group says, without a heading', () => {
    const untitled = bookLayout(
      [{ key: 'g', facts: [], empty: 'Nothing here.' }],
      sword,
      [],
    )
    expect(untitled.empty).toEqual(['Nothing here.'])
  })
})

describe('the footer without a known book or page', () => {
  it('falls back to the code and leaves the page out', () => {
    _clearBookSources()
    localStorage.setItem('cc-detail-style', 'book')
    render(
      <ThemeProvider>
        <EntryDetail
          entry={{ ...sword, page: undefined, free: false }}
          describe={describeWeapons}
          name="Longsword"
        />
      </ThemeProvider>,
    )
    expect(document.querySelector('.entry-book__footer')).toHaveTextContent(
      /^Source: XPHB\.$/,
    )
  })
})
