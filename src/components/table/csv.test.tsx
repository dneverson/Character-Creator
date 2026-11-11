import { describe, expect, it } from 'vitest'
import { csvField, csvFileName, plainText, rowsToCsv } from './csv'
import type { Column } from './types'

interface Row {
  name: string
  note: string
}

describe('plainText', () => {
  it('strips tags, decodes entities and tidies spaces', () => {
    expect(
      plainText(
        <>
          <b>Fire</b> &amp; <i>ice</i>
          <div>line one</div>
          <div>line two</div>
        </>,
      ),
    ).toBe('Fire & ice line one line two')
  })

  it('shows null and booleans as nothing', () => {
    expect(plainText(null)).toBe('')
    expect(plainText(false)).toBe('')
  })

  it('falls back to the cell children when it cannot be rendered', () => {
    function Broken(): never {
      throw new Error('needs the page')
    }
    expect(plainText(<Broken />)).toBe('')
  })
})

describe('csvField', () => {
  it('quotes only what needs it, doubling quotes', () => {
    expect(csvField('plain')).toBe('plain')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('two\nlines')).toBe('"two\nlines"')
  })
})

describe('rowsToCsv', () => {
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Name', render: (r) => <strong>{r.name}</strong> },
    { key: 'note', header: <span>Note, long</span>, render: (r) => r.note },
  ]

  it('writes a BOM, the headings, then a CRLF line per row in the given order', () => {
    const csv = rowsToCsv(
      [
        { name: 'Cat', note: 'small, quick' },
        { name: 'Wolf', note: 'says "grr"' },
      ],
      columns,
    )
    expect(csv).toBe(
      '\uFEFFName,"Note, long"\r\nCat,"small, quick"\r\nWolf,"says ""grr"""\r\n',
    )
  })

  it('has only the heading line for no rows', () => {
    expect(rowsToCsv([], columns)).toBe('\uFEFFName,"Note, long"\r\n')
  })
})

describe('csvFileName', () => {
  it('slugs the name and adds the day', () => {
    expect(csvFileName('Available books', new Date('2026-11-11T10:00:00Z'))).toBe(
      'available-books-2026-11-11.csv',
    )
    expect(csvFileName('!!!', new Date('2026-01-02T00:00:00Z'))).toBe(
      'table-2026-01-02.csv',
    )
  })
})
