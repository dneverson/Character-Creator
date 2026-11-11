import { describe, expect, it } from 'vitest'
import {
  applyFilters,
  applySearch,
  applySort,
  filterOptions,
  processRows,
  rowsFilteredExcept,
  toggleSort,
  type FilterState,
} from './tableState'
import type { Column } from './types'

interface Row {
  name: string
  school: string
  level: number
}

const rows: Row[] = [
  { name: 'Fireball', school: 'Evocation', level: 3 },
  { name: 'Bless', school: 'Enchantment', level: 1 },
  { name: 'Counterspell', school: 'Abjuration', level: 3 },
  { name: 'Aid', school: 'Abjuration', level: 2 },
]

const columns: Column<Row>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (r) => r.name,
    sortable: true,
    sortValue: (r) => r.name,
  },
  {
    key: 'school',
    header: 'School',
    render: (r) => r.school,
    filterable: true,
    filterValue: (r) => r.school,
  },
  {
    key: 'level',
    header: 'Level',
    render: (r) => r.level,
    sortable: true,
    sortValue: (r) => r.level,
  },
]

const searchText = (r: Row) => `${r.name} ${r.school}`

describe('toggleSort', () => {
  it('sorts ascending on first click of a new column', () => {
    expect(toggleSort(null, 'name')).toEqual({ key: 'name', dir: 'asc' })
    expect(toggleSort({ key: 'level', dir: 'desc' }, 'name')).toEqual({
      key: 'name',
      dir: 'asc',
    })
  })

  it('flips direction when the same column is clicked again', () => {
    expect(toggleSort({ key: 'name', dir: 'asc' }, 'name')).toEqual({
      key: 'name',
      dir: 'desc',
    })
    expect(toggleSort({ key: 'name', dir: 'desc' }, 'name')).toEqual({
      key: 'name',
      dir: 'asc',
    })
  })
})

describe('filterOptions', () => {
  it('returns distinct, alphabetised facet values', () => {
    expect(filterOptions(rows, columns[1])).toEqual([
      'Abjuration',
      'Enchantment',
      'Evocation',
    ])
  })

  it('derives options from displayed text when a column has no filterValue', () => {
    // `name` declares no filterValue, yet it is filterable by default.
    expect(filterOptions(rows, columns[0])).toEqual([
      'Aid',
      'Bless',
      'Counterspell',
      'Fireball',
    ])
  })

  it('offers each value of a cell that lists several', () => {
    const tags: Column<Row> = {
      key: 'tags',
      header: 'Tags',
      render: (r) => r.name,
      filterValue: (r) => (r.level === 3 ? ['Damage', 'Reaction'] : ['Buff', '']),
    }
    expect(filterOptions(rows, tags)).toEqual(['Buff', 'Damage', 'Reaction'])
  })

  it('returns nothing for a column that opts out of filtering', () => {
    const locked: Column<Row> = {
      key: 'name',
      header: 'Name',
      render: (r) => r.name,
      filterable: false,
    }
    expect(filterOptions(rows, locked)).toEqual([])
  })
})

describe('applyFilters', () => {
  it('keeps only rows whose value is among a facet’s ticked values', () => {
    const filters: FilterState = { school: ['Abjuration'] }
    expect(applyFilters(rows, columns, filters).map((r) => r.name)).toEqual([
      'Counterspell',
      'Aid',
    ])
  })

  it('keeps rows matching any ticked value in a column (OR within a column)', () => {
    const filters: FilterState = { school: ['Abjuration', 'Evocation'] }
    expect(applyFilters(rows, columns, filters).map((r) => r.name)).toEqual([
      'Fireball',
      'Counterspell',
      'Aid',
    ])
  })

  it('keeps a row when any value of a cell that lists several is ticked', () => {
    const listed: Column<Row>[] = [
      {
        key: 'tags',
        header: 'Tags',
        render: (r) => r.name,
        filterValue: (r) => (r.school === 'Abjuration' ? ['Ward', 'Heal'] : ['Harm']),
      },
    ]
    expect(applyFilters(rows, listed, { tags: ['Heal'] }).map((r) => r.name)).toEqual([
      'Counterspell',
      'Aid',
    ])
    expect(applyFilters(rows, listed, { tags: ['Mend'] })).toEqual([])
  })

  it('returns all rows when no filter is active', () => {
    expect(applyFilters(rows, columns, { school: [] })).toHaveLength(4)
    expect(applyFilters(rows, columns, {})).toHaveLength(4)
  })

  it('stacks filters across columns (they AND together)', () => {
    // School=Abjuration → Counterspell, Aid; then level=3 → Counterspell only.
    const filters: FilterState = { school: ['Abjuration'], level: ['3'] }
    expect(applyFilters(rows, columns, filters).map((r) => r.name)).toEqual([
      'Counterspell',
    ])
  })

  it('filters by a column that has no explicit filterValue', () => {
    expect(applyFilters(rows, columns, { name: ['Bless'] }).map((r) => r.name)).toEqual([
      'Bless',
    ])
  })
})

describe('rowsFilteredExcept', () => {
  it('applies every filter except the named column', () => {
    // With school AND level active, dropping `school` leaves only level=3.
    const filters: FilterState = { school: ['Abjuration'], level: ['3'] }
    expect(
      rowsFilteredExcept(rows, columns, filters, 'school').map((r) => r.name),
    ).toEqual(['Fireball', 'Counterspell'])
  })

  it('returns all rows when the only active filter is the excluded one', () => {
    const filters: FilterState = { school: ['Abjuration'] }
    expect(rowsFilteredExcept(rows, columns, filters, 'school')).toHaveLength(4)
  })
})

describe('applySearch', () => {
  it('matches on the search text, case-insensitively', () => {
    expect(applySearch(rows, 'fire', searchText).map((r) => r.name)).toEqual(['Fireball'])
    expect(applySearch(rows, 'ABJUR', searchText).map((r) => r.name)).toEqual([
      'Counterspell',
      'Aid',
    ])
  })

  it('returns all rows for a blank query', () => {
    expect(applySearch(rows, '   ', searchText)).toHaveLength(4)
  })
})

describe('applySort', () => {
  it('sorts ascending and descending without mutating the input', () => {
    const asc = applySort(rows, columns, { key: 'level', dir: 'asc' })
    expect(asc.map((r) => r.level)).toEqual([1, 2, 3, 3])
    const desc = applySort(rows, columns, { key: 'name', dir: 'desc' })
    expect(desc.map((r) => r.name)).toEqual(['Fireball', 'Counterspell', 'Bless', 'Aid'])
    expect(rows[0].name).toBe('Fireball') // original order intact
  })

  it('is a no-op without sort state', () => {
    expect(applySort(rows, columns, null)).toBe(rows)
  })

  it('sorts a column with no explicit sortValue by its displayed text', () => {
    const out = applySort(rows, columns, { key: 'school', dir: 'asc' })
    // Abjuration rows first (original order kept), then Enchantment, Evocation.
    expect(out.map((r) => r.name)).toEqual(['Counterspell', 'Aid', 'Bless', 'Fireball'])
  })

  it('does not sort a column that opts out with sortable: false', () => {
    const locked: Column<Row>[] = [
      { key: 'name', header: 'Name', render: (r) => r.name, sortable: false },
    ]
    expect(applySort(rows, locked, { key: 'name', dir: 'asc' })).toBe(rows)
  })
})

describe('processRows', () => {
  it('applies filter, then search, then sort together', () => {
    const out = processRows(rows, columns, {
      filters: { school: ['Abjuration'] },
      search: 'a',
      searchText,
      sort: { key: 'name', dir: 'asc' },
    })
    // Abjuration → Counterspell, Aid; contains 'a' → both; sorted by name asc.
    expect(out.map((r) => r.name)).toEqual(['Aid', 'Counterspell'])
  })

  it('ranks rows first, keeping the column sort within a rank', () => {
    const out = processRows(rows, columns, {
      filters: {},
      search: '',
      sort: { key: 'name', dir: 'desc' },
      rank: (r) => (r.school === 'Abjuration' ? 0 : 1),
    })
    const abjuration = out.filter((r) => r.school === 'Abjuration').map((r) => r.name)
    const others = out.filter((r) => r.school !== 'Abjuration').map((r) => r.name)
    expect(abjuration.length).toBeGreaterThan(0)
    expect(others.length).toBeGreaterThan(0)
    // The ranked group leads, and each group stays in the column's order (descending).
    expect(out.map((r) => r.name)).toEqual([...abjuration, ...others])
    expect(abjuration).toEqual([...abjuration].sort().reverse())
    expect(others).toEqual([...others].sort().reverse())
  })

  it('skips search when no searchText accessor is given', () => {
    const out = processRows(rows, columns, {
      filters: {},
      search: 'ignored',
      sort: null,
    })
    expect(out).toHaveLength(4)
  })
})
