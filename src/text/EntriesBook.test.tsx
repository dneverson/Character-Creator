import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { scan } from '../books/outline'
import { fixtureSections } from '../test/bookFixture'
import { Entries, type Entry } from './Entries'
import { EntryContext, type ImageEntry } from './entryContext'

/** Draw entries as the reader does: the book look, with anchors and no marked words. */
function book(entries: Entry[], words: string[] = [], pictures = false) {
  const { anchors } = scan(entries)
  return render(
    <EntryContext.Provider
      value={{
        book: true,
        anchors,
        words,
        renderImage: pictures
          ? (image: ImageEntry) => <figure data-testid="picture">{image.title}</figure>
          : undefined,
      }}
    >
      <Entries entries={entries} />
    </EntryContext.Provider>,
  )
}

describe('the book look of the entries', () => {
  it('gives every named part a heading level by depth, with its address and page', () => {
    book(fixtureSections)
    const chapter = screen.getByRole('heading', { name: /Chapter 1: Wanderers/ })
    expect(chapter.tagName).toBe('H2')
    expect(chapter).toHaveAttribute('id', 'book-chapter-1-wanderers')
    expect(chapter).toHaveAttribute('data-anchor', 'chapter-1-wanderers')
    expect(within(chapter).getByText('p. 3')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: /Packing/ })[0].tagName).toBe('H3')
  })

  it('draws a sidebar as an aside with its own title', () => {
    const { container } = book(fixtureSections)
    const aside = container.querySelector<HTMLElement>('aside.book-readaloud')
    if (!aside) throw new Error('no sidebar')
    expect(within(aside).getByRole('heading', { name: 'Read aloud' })).toHaveClass(
      'book-box-title',
    )
    expect(within(aside).getByText('The dragon wakes slowly.')).toBeInTheDocument()
  })

  it.each([
    ['inset', 'book-inset'],
    ['flowBlock', 'book-flowblock'],
    ['variantInner', 'book-inset'],
  ])('draws a %s as a box', (type, className) => {
    book([{ type, name: 'Box', entries: ['Inside'] }])
    expect(screen.getByRole('complementary')).toHaveClass(className)
  })

  it('draws a table with its caption, labels, alignment and footnotes', () => {
    book([
      {
        type: 'table',
        caption: 'Costs',
        colLabels: ['Item', 'Price'],
        colStyles: ['col-6', 'col-6 text-center no-wrap'],
        rows: [['Rope', '1 gp']],
        footnotes: ['A note.'],
      },
    ])
    expect(screen.getByText('Costs').tagName).toBe('CAPTION')
    expect(screen.getByRole('columnheader', { name: 'Price' })).toHaveClass(
      'text-center',
      'text-nowrap',
    )
    expect(screen.getByRole('cell', { name: '1 gp' })).toHaveClass('text-center')
    expect(screen.getByText('A note.')).toBeInTheDocument()
  })

  it('draws rows given as entries, header cells, and cells that hold more than a line', () => {
    book([
      {
        type: 'table',
        rows: [
          {
            type: 'row',
            row: [
              { type: 'cellHeader', entry: 'Head' },
              { type: 'cell', entries: ['One', 'Two'] },
              { type: 'cell', entry: { type: 'list', items: ['Deep'] } },
              { type: 'cell', roll: { min: 1, max: 4 } },
              { type: 'cell', roll: { exact: 6 } },
            ],
          },
        ],
      },
    ])
    expect(screen.getByText('Head').tagName).toBe('TH')
    expect(screen.getByText('Two')).toBeInTheDocument()
    expect(screen.getByText('Deep')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /1.4/ })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '6' })).toBeInTheDocument()
  })

  it('draws a group of tables under its name', () => {
    book([
      {
        type: 'tableGroup',
        name: 'Both',
        tables: [
          { type: 'table', caption: 'First', rows: [['a']] },
          { type: 'table', caption: 'Second', rows: [['b']] },
        ],
      },
    ])
    expect(screen.getByText('Both')).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(2)
  })

  it('draws lists by style, in columns, and titled', () => {
    book([
      {
        type: 'list',
        name: 'Steps',
        style: 'list-decimal',
        columns: 2,
        items: ['a', 'b'],
      },
    ])
    expect(screen.getByText('Steps')).toBeInTheDocument()
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('OL')
    expect(list).toHaveStyle({ columnCount: '2' })
  })

  it('runs an item name into its text, with a stop when it has none', () => {
    book([
      {
        type: 'list',
        items: [
          { type: 'item', name: 'Rope', entry: 'is light.' },
          { type: 'item', name: 'Ends:', entry: 'done', entries: ['More'] },
          { type: 'item', name: 'Quiet', nameDot: false, entry: 'x' },
        ],
      },
    ])
    expect(screen.getByText('Rope.')).toBeInTheDocument()
    expect(screen.getByText('Ends:')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
    expect(screen.getByText('Quiet')).toBeInTheDocument()
  })

  it('draws a quote with who said it and where', () => {
    book([{ type: 'quote', entries: ['Be bold.'], by: 'A bard', from: 'Songs' }])
    expect(screen.getByText('Be bold.')).toBeInTheDocument()
    expect(screen.getByText('Songs').tagName).toBe('CITE')
    expect(screen.getByText(/A bard/)).toBeInTheDocument()
  })

  it('draws a picture through the reader, or says there is one', () => {
    const image: Entry = {
      type: 'image',
      href: { type: 'internal', path: 'a.webp' },
      title: 'Map',
    }
    book([image], [], true)
    expect(screen.getByTestId('picture')).toHaveTextContent('Map')
  })

  it('draws a gallery by its pictures', () => {
    book(
      [
        {
          type: 'gallery',
          name: 'Art',
          images: [
            { type: 'image', title: 'One' },
            { type: 'image', title: 'Two' },
          ],
        },
      ],
      [],
      true,
    )
    expect(screen.getByText('Art')).toBeInTheDocument()
    expect(screen.getAllByTestId('picture')).toHaveLength(2)
  })

  it('names a stat block and points to the lookup for it', () => {
    book([{ type: 'statblock', tag: 'creature', name: 'Goblin', source: 'MM' }])
    expect(screen.getByRole('button', { name: 'Goblin' })).toBeInTheDocument()
    expect(screen.getByText(/drawn in the lookup/)).toBeInTheDocument()
  })

  it('names a stat block that has no entry to point to', () => {
    book([{ type: 'statblock', name: 'Odd' }])
    expect(screen.getByText(/Stat block:/)).toBeInTheDocument()
    expect(screen.getByText(/Odd/)).toBeInTheDocument()
  })

  it('draws flowcharts, wrappers, inline blocks and rules by what they hold', () => {
    book([
      {
        type: 'flowchart',
        blocks: [{ type: 'flowBlock', name: 'Start', entries: ['Go'] }],
      },
      { type: 'wrapper', wrappeds: ['Wrapped text'] },
      { type: 'inlineBlock', entries: ['Inline text'] },
      { type: 'hr' },
    ])
    expect(screen.getByText('Go')).toBeInTheDocument()
    expect(screen.getByText('Wrapped text')).toBeInTheDocument()
    expect(screen.getByText('Inline text')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('draws the ability lines of a class', () => {
    book([
      { type: 'abilityGeneric', name: 'Spell DC', entry: '8 + prof' },
      { type: 'abilityDc', name: 'Wizard', attributes: ['int'] },
      { type: 'abilityAttackMod', name: 'Cleric', attributes: ['wis', 'cha', 'str'] },
    ])
    expect(screen.getByText(/Spell DC = /)).toBeInTheDocument()
    expect(
      screen.getByText(
        'Wizard save DC = 8 + your proficiency bonus + your Intelligence modifier',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Cleric attack modifier .* Wisdom, Charisma or Strength modifier/),
    ).toBeInTheDocument()
  })

  it('draws the spells of a stat block', () => {
    book([
      {
        type: 'spellcasting',
        name: 'Spellcasting',
        headerEntries: ['It casts.'],
        spells: {
          '0': { spells: ['{@spell light}'] },
          '1': { slots: 4, spells: ['bless'] },
        },
        will: ['detect magic'],
        daily: { '1e': ['fly'], '3': ['haste'] },
        footerEntries: ['Done.'],
      },
    ])
    expect(screen.getByText('Cantrips (at will):')).toBeInTheDocument()
    expect(screen.getByText('1st level (4 slots):')).toBeInTheDocument()
    expect(screen.getByText('At will:')).toBeInTheDocument()
    expect(screen.getByText('1/day each:')).toBeInTheDocument()
    expect(screen.getByText('3/day:')).toBeInTheDocument()
    expect(screen.getByText('Done.')).toBeInTheDocument()
  })

  it('says so, and still draws what is inside, for a kind it does not know', () => {
    book([{ type: 'newThing', entries: ['Still here'] }])
    expect(screen.getByText(/type "newThing"\) is not drawn yet/)).toBeInTheDocument()
    expect(screen.getByText('Still here')).toBeInTheDocument()
  })

  it('marks the words searched for, in text, links and tables', () => {
    const { container } = book(
      [
        'The dragon of {@spell fireball} fame',
        { type: 'table', rows: [['Dragon hoard']] },
      ],
      ['dragon', 'fire'],
    )
    expect(
      [...container.querySelectorAll('mark.book-hit')].map((m) => m.textContent),
    ).toEqual(['dragon', 'fireball', 'Dragon'])
  })
})

describe('the entries outside the book look', () => {
  it('draw no heading, mark nothing and name the type of nothing', () => {
    const { container } = render(
      <Entries
        entries={[
          { type: 'section', name: 'Plain', entries: ['Text'] },
          { type: 'newThing', entries: ['Nested'] },
          { type: 'newThing' },
        ]}
      />,
    )
    expect(screen.queryByRole('heading')).toBeNull()
    expect(container.textContent).toContain('Nested')
    expect(container.textContent).not.toContain('not drawn')
  })

  it('draw a picture as a note', () => {
    render(<Entries entries={[{ type: 'image', title: 'The map' }, { type: 'image' }]} />)
    expect(screen.getByText('Image: The map')).toBeInTheDocument()
  })
})
