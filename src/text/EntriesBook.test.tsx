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

  it('runs the first text of a named item in after its name, and sets the rest apart', () => {
    const { container } = book([
      {
        type: 'list',
        style: 'list-hang-notitle',
        items: [{ type: 'item', name: 'Row 1:', entries: ['Ch 46, sc.', 'Turn.'] }],
      },
    ])
    const item = container.querySelector('.book-item')
    expect(item?.querySelector('strong')?.nextSibling?.textContent).toBe(' ')
    expect(item?.firstElementChild).toHaveTextContent('Row 1:')
    expect(item?.textContent).toContain('Row 1: Ch 46, sc.')
    expect(item?.querySelectorAll('p')).toHaveLength(1)
    expect(item?.querySelector('p')).toHaveTextContent('Turn.')
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

describe('the lowest headings run in', () => {
  const nested: Entry[] = [
    {
      type: 'entries',
      name: 'Amphibious',
      entries: ['It breathes air and water.', 'A second paragraph.'],
    },
    {
      type: 'entries',
      name: 'Keen Senses:',
      entries: [{ type: 'list', items: ['One'] }],
    },
  ]

  function runIn(from: number | undefined) {
    const { anchors } = scan(nested)
    return render(
      <EntryContext.Provider value={{ book: true, anchors, words: [], runInFrom: from }}>
        <Entries entries={nested} />
      </EntryContext.Provider>,
    )
  }

  it('sets the name in bold italic at the start of the first paragraph', () => {
    runIn(0)
    const name = screen.getByText('Amphibious.')
    expect(name).toHaveClass('book-run-in')
    expect(name).toHaveAttribute('data-anchor', 'amphibious')
    expect(name.parentElement).toHaveTextContent('Amphibious. It breathes air and water.')
    expect(screen.getByText('A second paragraph.')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('keeps a name that ends a sentence as it is, and a first part that is not text', () => {
    runIn(0)
    expect(screen.getByText('Keen Senses:')).toHaveClass('book-run-in')
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('leaves them as headings above that depth, or where the reader sets no depth', () => {
    runIn(1)
    expect(screen.getAllByRole('heading')).toHaveLength(2)
  })
})

describe('areas and maps in the book look', () => {
  const entries: Entry[] = [
    {
      type: 'section',
      name: 'Part',
      entries: [
        {
          type: 'entries',
          name: 'The Keep',
          id: 'k1',
          entries: ['Go to {@area the hall|k1|x}.'],
        },
        { type: 'image', id: 'm1', title: 'Map 1', mapRegions: [{ area: 'k1' }] },
      ],
    },
  ]

  it('links an area key to its heading, and the heading to its maps', () => {
    const { ids, maps, anchors } = scan(entries)
    render(
      <EntryContext.Provider
        value={{
          book: true,
          anchors,
          words: [],
          ids,
          maps,
          doc: { kind: 'adventure', id: 'TST' },
        }}
      >
        <Entries entries={entries} />
      </EntryContext.Provider>,
    )
    expect(screen.getByRole('link', { name: 'the hall' })).toHaveAttribute(
      'href',
      '#/adventure/TST/0/the-keep',
    )
    expect(screen.getByRole('link', { name: 'Map: Map 1' })).toHaveAttribute(
      'href',
      '#/adventure/TST/0/image-m1',
    )
  })
})

describe('tables and lists as the printed book sets them', () => {
  const table: Entry = {
    type: 'table',
    caption: 'Portals',
    colStyles: ['col-2 text-center', 'col-2', 'col-8'],
    colLabelRows: [
      ['', { type: 'cellHeader', style: 'th-skewer', width: 2, entry: 'Destination' }],
      ['d100', 'Anchor', 'Keys'],
    ],
    rows: [
      { type: 'row', style: 'row-indent-first', row: ['01', 'Arch', 'Horn'] },
      ['02', { type: 'cell', width: 2, entry: 'Both' }],
    ],
  }

  it('draws header rows with spanning cells, a row style and a cell style', () => {
    const { container } = book([table])
    const heads = container.querySelectorAll('thead tr')
    expect(heads).toHaveLength(2)
    const skewer = screen.getByRole('columnheader', { name: 'Destination' })
    expect(skewer).toHaveClass('th-skewer')
    expect(skewer).toHaveAttribute('colspan', '2')
    expect(container.querySelector('tbody tr')).toHaveClass('row-indent-first')
    expect(screen.getByRole('cell', { name: 'Both' })).toHaveAttribute('colspan', '2')
  })

  it('gives each column the share of the width its style asks for', () => {
    const { container } = book([table])
    const widths = [...container.querySelectorAll('col')].map((col) => col.style.width)
    expect(widths).toEqual([
      '16.666666666666664%',
      '16.666666666666664%',
      '66.66666666666666%',
    ])
  })

  it('leaves the widths to the browser when a column does not ask for one', () => {
    const { container } = book([
      { ...table, colStyles: ['col-2', 'text-center', 'col-8'] },
    ])
    expect(container.querySelector('colgroup')).toBeNull()
  })

  it('starts a numbered list at the number the data gives', () => {
    const { container } = book([
      { type: 'list', style: 'list-decimal', start: 0, items: ['first', 'second'] },
    ])
    expect(container.querySelector('ol')).toHaveAttribute('start', '0')
  })
})
