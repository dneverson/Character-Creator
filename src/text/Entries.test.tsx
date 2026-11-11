import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Entries, type Entry } from './Entries'

function renderEntries(entries: Entry[]) {
  return render(<Entries entries={entries} />)
}

describe('Entries', () => {
  it('renders strings and numbers as paragraphs with tags stripped', () => {
    renderEntries(['Cast {@spell fireball}', 7])
    expect(screen.getByText('Cast fireball')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders a list with plain and nested items', () => {
    renderEntries([
      {
        type: 'list',
        items: ['Simple {@item longsword|phb}', { type: 'entries', entries: ['Nested'] }],
      },
    ])
    expect(screen.getByText('Simple longsword')).toBeInTheDocument()
    expect(screen.getByText('Nested')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('renders a named section with its heading and body', () => {
    renderEntries([{ type: 'section', name: 'Traits', entries: ['Keen senses.'] }])
    expect(screen.getByText('Traits')).toBeInTheDocument()
    expect(screen.getByText('Keen senses.')).toBeInTheDocument()
  })

  it('renders a table with labels and roll/exact/range/entry cells', () => {
    renderEntries([
      {
        type: 'table',
        colLabels: ['{@dice d6}', 'Result'],
        rows: [
          [{ type: 'cell', roll: { exact: 3 } }, 'Exact'],
          [{ type: 'cell', roll: { min: 1, max: 2 } }, { entry: 'A {@item gem}' }],
          ['plain', { type: 'cell' }], // cell without roll -> empty string
        ],
      },
    ])
    expect(screen.getByText('d6')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1–2')).toBeInTheDocument()
    expect(screen.getByText('A gem')).toBeInTheDocument()
    expect(screen.getByText('plain')).toBeInTheDocument()
  })

  it('renders an item entry with a bold name and inline text', () => {
    renderEntries([{ type: 'item', name: 'Languages:', entry: 'Common, Elvish' }])
    expect(screen.getByText('Languages:')).toBeInTheDocument()
    expect(screen.getByText('Common, Elvish')).toBeInTheDocument()
  })

  it('renders an itemSub entry with nested entries', () => {
    renderEntries([{ type: 'itemSub', entries: ['Sub detail'] }])
    expect(screen.getByText('Sub detail')).toBeInTheDocument()
  })

  it('falls back to nested entries for an unknown type', () => {
    renderEntries([{ type: 'mystery', entries: ['Recovered'] }])
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('renders nothing for an unknown type with no nested entries', () => {
    const { container } = renderEntries([{ type: 'mystery' }])
    expect(container.textContent).toBe('')
  })
})
