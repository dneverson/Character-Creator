import { afterEach, describe, expect, it } from 'vitest'
import {
  defaultLayout,
  LAYOUT_VERSION,
  loadLayout,
  reconcileLayout,
  reorderKey,
  saveLayout,
  visibleKeys,
  type ColumnLayout,
} from './columnLayout'

describe('defaultLayout', () => {
  it('keeps the declared order, hides nothing, and sets no widths', () => {
    expect(defaultLayout(['a', 'b', 'c'])).toEqual({
      order: ['a', 'b', 'c'],
      hidden: [],
      widths: {},
    })
  })

  it('hides the columns that start hidden', () => {
    const startHidden = ['c']
    const layout = defaultLayout(['a', 'b', 'c'], startHidden)
    startHidden.push('a')
    expect(layout).toEqual({ order: ['a', 'b', 'c'], hidden: ['c'], widths: {} })
  })

  it('copies the keys so later mutation cannot corrupt it', () => {
    const keys = ['a', 'b']
    const layout = defaultLayout(keys)
    keys.push('c')
    expect(layout.order).toEqual(['a', 'b'])
  })
})

describe('reconcileLayout', () => {
  it('keeps saved order for keys that still exist', () => {
    const saved: ColumnLayout = { order: ['c', 'a', 'b'], hidden: [], widths: {} }
    expect(reconcileLayout(saved, ['a', 'b', 'c']).order).toEqual(['c', 'a', 'b'])
  })

  it('appends newly added keys at the end in declared order', () => {
    const saved: ColumnLayout = { order: ['b', 'a'], hidden: [], widths: {} }
    expect(reconcileLayout(saved, ['a', 'b', 'c', 'd']).order).toEqual([
      'b',
      'a',
      'c',
      'd',
    ])
  })

  it('drops removed keys from order, hidden, and widths', () => {
    const saved: ColumnLayout = {
      order: ['a', 'gone', 'b'],
      hidden: ['gone'],
      widths: { a: 100, gone: 50 },
    }
    expect(reconcileLayout(saved, ['a', 'b'])).toEqual({
      order: ['a', 'b'],
      hidden: [],
      widths: { a: 100 },
    })
  })
})

describe('visibleKeys', () => {
  it('returns ordered keys minus the hidden ones', () => {
    const layout: ColumnLayout = { order: ['a', 'b', 'c'], hidden: ['b'], widths: {} }
    expect(visibleKeys(layout)).toEqual(['a', 'c'])
  })
})

describe('reorderKey', () => {
  it('moves a key before a later target', () => {
    expect(reorderKey(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c'])
  })

  it('moves a key before an earlier target', () => {
    expect(reorderKey(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
  })

  it('moves a key to the end when before is null', () => {
    expect(reorderKey(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a'])
  })

  it('preserves keys not being moved, including hidden ones', () => {
    expect(reorderKey(['a', 'hidden', 'b', 'c'], 'c', 'a')).toEqual([
      'c',
      'a',
      'hidden',
      'b',
    ])
  })

  it('is a no-op when moved equals before', () => {
    const order = ['a', 'b', 'c']
    expect(reorderKey(order, 'b', 'b')).toBe(order)
  })

  it('returns the original when the moved key is absent', () => {
    const order = ['a', 'b', 'c']
    expect(reorderKey(order, 'x', 'a')).toBe(order)
  })

  it('returns the original when the target is absent', () => {
    const order = ['a', 'b', 'c']
    expect(reorderKey(order, 'a', 'x')).toBe(order)
  })
})

describe('loadLayout / saveLayout', () => {
  afterEach(() => localStorage.clear())

  it('round-trips a saved layout', () => {
    const layout: ColumnLayout = {
      order: ['a', 'b'],
      hidden: ['b'],
      widths: { a: 120 },
    }
    saveLayout('t1', layout)
    expect(loadLayout('t1')).toEqual(layout)
  })

  it('returns null when nothing is stored', () => {
    expect(loadLayout('missing')).toBeNull()
  })

  it('returns null and does not throw on malformed JSON', () => {
    localStorage.setItem('charcreator.table:bad', '{not json')
    expect(loadLayout('bad')).toBeNull()
  })

  it('returns null when the stored order is not an array', () => {
    localStorage.setItem(
      'charcreator.table:noorder',
      JSON.stringify({ version: LAYOUT_VERSION, order: 'x' }),
    )
    expect(loadLayout('noorder')).toBeNull()
  })

  it('drops non-string keys and non-numeric widths from stored data', () => {
    localStorage.setItem(
      'charcreator.table:dirty',
      JSON.stringify({
        version: LAYOUT_VERSION,
        order: ['a', 2, 'b'],
        hidden: ['a', 3],
        widths: { a: 100, b: 'x' },
      }),
    )
    expect(loadLayout('dirty')).toEqual({
      order: ['a', 'b'],
      hidden: ['a'],
      widths: { a: 100 },
    })
  })

  it('returns null for a stored layout with no version (pre-version data)', () => {
    localStorage.setItem(
      'charcreator.table:legacy',
      JSON.stringify({ order: ['a', 'b'], hidden: [], widths: {} }),
    )
    expect(loadLayout('legacy')).toBeNull()
  })

  it('returns null for a stored layout tagged with an older version', () => {
    localStorage.setItem(
      'charcreator.table:stale',
      JSON.stringify({
        version: LAYOUT_VERSION - 1,
        order: ['a', 'b'],
        hidden: [],
        widths: {},
      }),
    )
    expect(loadLayout('stale')).toBeNull()
  })

  it('stamps the current version so a saved layout reloads', () => {
    const layout: ColumnLayout = { order: ['a', 'b'], hidden: [], widths: {} }
    saveLayout('versioned', layout)
    const raw = localStorage.getItem('charcreator.table:versioned') ?? ''
    expect(JSON.parse(raw).version).toBe(LAYOUT_VERSION)
    expect(loadLayout('versioned')).toEqual(layout)
  })
})
