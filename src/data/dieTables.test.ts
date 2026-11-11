import { afterEach, describe, expect, it, vi } from 'vitest'
import { dieTables, rollOnTable, withoutDieTables, type DieTable } from './dieTables'
import type { Entry } from '../text/Entries'

const traits: Entry = {
  type: 'table',
  colLabels: ['d4', 'Personality Trait'],
  rows: [
    ['1', 'I idolize a {@deity Bahamut} of my faith.'],
    ['2', 'I can find common ground.'],
    ['3', 'I see omens.'],
    ['4', 'Nothing shakes my optimism.'],
  ],
}

/** Each die in turn shows the next of these values. */
function dice(...values: number[]) {
  let at = 0
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
    // randomInt(1, N) reads one byte and shows 1 + byte % N.
    ;(array as Uint8Array)[0] = values[at++] - 1
    return array
  })
}

afterEach(() => vi.restoreAllMocks())

describe('dieTables', () => {
  it('reads a die table: die, label, title, and rows as plain text', () => {
    expect(dieTables([traits])).toEqual([
      {
        title: 'Personality Trait',
        label: 'Personality Trait',
        die: 4,
        rows: [
          { min: 1, max: 1, text: 'I idolize a Bahamut of my faith.' },
          { min: 2, max: 2, text: 'I can find common ground.' },
          { min: 3, max: 3, text: 'I see omens.' },
          { min: 4, max: 4, text: 'Nothing shakes my optimism.' },
        ],
      },
    ])
  })

  it('reads plain numbers, ranges with a hyphen or a dash, and roll cells', () => {
    const [table] = dieTables([
      {
        type: 'table',
        caption: 'Object or item:',
        colLabels: ['{@dice d8}', 'Object or item:'],
        rows: [
          [1, 'A document'],
          ['2-3', 'A trinket'],
          ['4–5', 'An heirloom'],
          [{ type: 'cell', roll: { exact: 6 } }, 'A map'],
          [{ type: 'cell', roll: { min: 7, max: 8 } }, 42],
        ],
      },
    ])
    expect(table.title).toBe('Object or Item')
    expect(table.die).toBe(8)
    expect(table.rows.map(({ min, max }) => [min, max])).toEqual([
      [1, 1],
      [2, 3],
      [4, 5],
      [6, 6],
      [7, 8],
    ])
    expect(table.rows[4].text).toBe('42')
  })

  it('finds tables at any depth, named by caption, with the section they sit in', () => {
    const tables = dieTables([
      'Some prose.',
      {
        type: 'section',
        name: 'Building a Character',
        entries: [
          {
            type: 'entries',
            name: 'Suggested Characteristics',
            entries: [{ ...traits, caption: 'Lorehold Personality Traits' }],
          },
        ],
      },
      { type: 'list', items: [{ ...traits, colLabels: ['d4', 'Bond'] }] },
    ])
    expect(tables.map((t) => [t.title, t.label, t.section])).toEqual([
      ['Lorehold Personality Traits', 'Personality Trait', 'Suggested Characteristics'],
      ['Bond', 'Bond', undefined],
    ])
  })

  it('leaves out tables that are not die tables', () => {
    const table = (colLabels: unknown[], rows: unknown[]): Entry => ({
      type: 'table',
      colLabels,
      rows,
    })
    expect(
      dieTables([
        // A lookup, not a die.
        table(['Spell Level', 'Spells'], [['1st', 'Shield']]),
        // More than two columns.
        table(['d2', 'A', 'B'], [['1', 'a', 'b']]),
        // A gap at 2.
        table(
          ['d3', 'Gap'],
          [
            ['1', 'a'],
            ['3', 'c'],
          ],
        ),
        // Rows overlap.
        table(
          ['d2', 'Overlap'],
          [
            ['1-2', 'a'],
            ['2', 'b'],
          ],
        ),
        // Short of the die.
        table(
          ['d4', 'Short'],
          [
            ['1', 'a'],
            ['2', 'b'],
          ],
        ),
        // A backwards range, a row that is not a pair, a cell that says nothing.
        table(['d2', 'Backwards'], [['2-1', 'a']]),
        table(['d1', 'Single'], [['1']]),
        table(['d1', 'Odd'], [[{ type: 'cell' }, 'a']]),
        table(['d1', 'Object'], [['1', { type: 'entries' }]]),
        table(['d1', 'Text'], [['one', 'a']]),
        table(['d1', 'Empty'], []),
        { type: 'table', rows: [] },
        { type: 'list', items: [] },
      ]),
    ).toEqual([])
    expect(dieTables(undefined)).toEqual([])
  })

  it('does not look for die tables inside another table', () => {
    const lookup: Entry = {
      type: 'table',
      colLabels: ['House', 'Tools'],
      rows: [['Cannith', traits]],
    }
    expect(dieTables([lookup])).toEqual([])
  })
})

describe('withoutDieTables', () => {
  it('takes the die tables out at any depth and keeps everything else', () => {
    const lookup: Entry = {
      type: 'table',
      colLabels: ['Spell Level', 'Spells'],
      rows: [['1st', 'Shield']],
    }
    const entries: Entry[] = [
      'Prose.',
      traits,
      lookup,
      {
        type: 'entries',
        name: 'Suggested Characteristics',
        entries: ['Use these.', traits, { type: 'list', items: ['a', traits] }],
      },
    ]
    expect(withoutDieTables(entries)).toEqual([
      'Prose.',
      lookup,
      {
        type: 'entries',
        name: 'Suggested Characteristics',
        entries: ['Use these.', { type: 'list', items: ['a'] }],
      },
    ])
    // The entries given are left as they were.
    expect(entries[1]).toBe(traits)
  })
})

describe('rollOnTable', () => {
  const [table] = dieTables([traits])
  const ranged: DieTable = {
    title: 'Origin',
    label: 'Origin',
    die: 6,
    rows: [
      { min: 1, max: 3, text: 'Low' },
      { min: 4, max: 6, text: 'High' },
    ],
  }

  it('rolls once for one row', () => {
    dice(3)
    expect(rollOnTable(table, 1, [])).toEqual({ values: [3], rows: [2] })
  })

  it('rolls again on a taken row, and on a row this roll took', () => {
    dice(2, 4, 4, 1)
    // Row 1 (die 2) is taken; 4 is taken by this roll, then 4 again is rolled over.
    expect(rollOnTable(table, 2, [1])).toEqual({ values: [2, 4, 4, 1], rows: [3, 0] })
  })

  it('finds the row a value falls in when a row covers several', () => {
    dice(5, 2)
    expect(rollOnTable(ranged, 2, [])).toEqual({ values: [5, 2], rows: [1, 0] })
  })

  it('takes no more rows than are free, and none when asked for none', () => {
    dice(1, 2, 3, 4)
    expect(rollOnTable(table, 3, [0, 1, 2])).toEqual({ values: [1, 2, 3, 4], rows: [3] })
    expect(rollOnTable(table, 2, [0, 1, 2, 3])).toEqual({ values: [], rows: [] })
    expect(rollOnTable(table, 0, [])).toEqual({ values: [], rows: [] })
    expect(rollOnTable(table, -1, [])).toEqual({ values: [], rows: [] })
  })

  it('stays on the table with real dice', () => {
    const { values, rows } = rollOnTable(table, 2, [])
    expect(rows).toHaveLength(2)
    expect(new Set(rows).size).toBe(2)
    for (const value of values) expect(value >= 1 && value <= 4).toBe(true)
  })
})
