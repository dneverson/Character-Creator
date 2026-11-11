import { describe, expect, it } from 'vitest'
import { resolveCopy, type Copyable } from './copy'

function finder(entries: Copyable[]) {
  return (name: string, source: string) =>
    entries.find((e) => e.name === name && e.source === source)
}

describe('resolveCopy', () => {
  it('inherits base properties and overlays own', () => {
    const base: Copyable = { name: 'Goblin', source: 'MPMM', size: ['S'], darkvision: 60 }
    const child: Copyable = {
      name: 'Boggart',
      source: 'LFL',
      _copy: { name: 'Goblin', source: 'MPMM' },
      size: ['M'],
    }
    const r = resolveCopy(child, finder([base, child]))
    expect(r.name).toBe('Boggart')
    expect(r.size).toEqual(['M']) // own wins
    expect(r.darkvision).toBe(60) // inherited
    expect(r._copy).toBeUndefined()
  })

  it('applies appendArr and removeArr mods to entries', () => {
    const base: Copyable = {
      name: 'Base',
      source: 'X',
      entries: [
        { name: 'Keep', type: 'entries' },
        { name: 'Drop', type: 'entries' },
      ],
    }
    const child: Copyable = {
      name: 'Child',
      source: 'Y',
      _copy: {
        name: 'Base',
        source: 'X',
        _mod: {
          entries: [
            { mode: 'removeArr', names: 'Drop' },
            { mode: 'appendArr', items: { name: 'Added', type: 'entries' } },
          ],
        },
      },
    }
    const r = resolveCopy(child, finder([base, child])) as Copyable & {
      entries: { name: string }[]
    }
    expect(r.entries.map((e) => e.name)).toEqual(['Keep', 'Added'])
  })

  it('replaceArr swaps a named item', () => {
    const base: Copyable = {
      name: 'B',
      source: 'X',
      entries: [{ name: 'Old' }, { name: 'Stay' }],
    }
    const child: Copyable = {
      name: 'C',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: { entries: { mode: 'replaceArr', replace: 'Old', items: { name: 'New' } } },
      },
    }
    const r = resolveCopy(child, finder([base, child])) as Copyable & {
      entries: { name: string }[]
    }
    expect(r.entries.map((e) => e.name)).toEqual(['New', 'Stay'])
  })

  it('replaceArr swaps an item by index and ignores an out-of-range index', () => {
    const base: Copyable = { name: 'B', source: 'X', entries: ['first', 'second'] }
    const child = (index: number): Copyable => ({
      name: 'C',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: { entries: { mode: 'replaceArr', replace: { index }, items: 'swapped' } },
      },
    })
    const entries = (c: Copyable) => resolveCopy(c, finder([base])).entries
    expect(entries(child(0))).toEqual(['swapped', 'second'])
    expect(entries(child(5))).toEqual(['first', 'second'])
  })

  it('returns own fields when the base is missing', () => {
    const child: Copyable = {
      name: 'Orphan',
      source: 'Z',
      size: ['M'],
      _copy: { name: 'Ghost', source: 'None' },
    }
    const r = resolveCopy(child, finder([child]))
    expect(r.name).toBe('Orphan')
    expect(r.size).toEqual(['M'])
    expect(r._copy).toBeUndefined()
  })

  it('applies prependArr and insertArr mods', () => {
    const base: Copyable = {
      name: 'B',
      source: 'X',
      entries: [{ name: 'Mid' }],
    }
    const prepend: Copyable = {
      name: 'P',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: { entries: { mode: 'prependArr', items: { name: 'First' } } },
      },
    }
    const insert: Copyable = {
      name: 'I',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: { entries: { mode: 'insertArr', index: 1, items: { name: 'Ins' } } },
      },
    }
    const insertEnd: Copyable = {
      name: 'E',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: { entries: { mode: 'insertArr', items: { name: 'End' } } },
      },
    }
    const finderAll = finder([base, prepend, insert, insertEnd])
    const names = (c: Copyable) =>
      (
        resolveCopy(c, finderAll) as Copyable & { entries: { name: string }[] }
      ).entries.map((e) => e.name)
    expect(names(prepend)).toEqual(['First', 'Mid'])
    expect(names(insert)).toEqual(['Mid', 'Ins'])
    expect(names(insertEnd)).toEqual(['Mid', 'End']) // no index -> appended at end
  })

  it('leaves the array unchanged for a missing replace target or unknown mode', () => {
    const base: Copyable = { name: 'B', source: 'X', entries: [{ name: 'Only' }] }
    const missTarget: Copyable = {
      name: 'M',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: {
          entries: { mode: 'replaceArr', replace: 'Absent', items: { name: 'X' } },
        },
      },
    }
    const unknownMode: Copyable = {
      name: 'U',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: { entries: { mode: 'replaceTxt', replace: 'foo' } },
      },
    }
    const finderAll = finder([base, missTarget, unknownMode])
    const names = (c: Copyable) =>
      (
        resolveCopy(c, finderAll) as Copyable & { entries: { name: string }[] }
      ).entries.map((e) => e.name)
    expect(names(missTarget)).toEqual(['Only'])
    expect(names(unknownMode)).toEqual(['Only'])
  })

  it('ignores a replaceArr whose replace target is neither a name nor an index', () => {
    const base: Copyable = { name: 'B', source: 'X', entries: [{ name: 'Only' }] }
    const child: Copyable = {
      name: 'C',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        // A replace object without an index -> no target -> arr unchanged.
        _mod: {
          entries: { mode: 'replaceArr', replace: {}, items: { name: 'X' } },
        },
      },
    }
    const r = resolveCopy(child, finder([base, child])) as Copyable & {
      entries: { name: string }[]
    }
    expect(r.entries.map((e) => e.name)).toEqual(['Only'])
  })

  it('removeArr keeps nameless elements via the empty-string fallback', () => {
    const base: Copyable = {
      name: 'B',
      source: 'X',
      // A primitive element has no name -> itemName returns undefined -> '' fallback.
      entries: ['loose string', { name: 'Drop' }, { name: 'Keep' }],
    }
    const child: Copyable = {
      name: 'C',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: { entries: { mode: 'removeArr', names: 'Drop' } },
      },
    }
    const r = resolveCopy(child, finder([base, child])) as Copyable & {
      entries: unknown[]
    }
    expect(r.entries).toEqual(['loose string', { name: 'Keep' }])
  })

  it('skips wildcard mod fields and resets a non-array target', () => {
    const base: Copyable = {
      name: 'B',
      source: 'X',
      // Not an array -> applyMods resets the field to [] before appending.
      entries: 'not an array',
    }
    const child: Copyable = {
      name: 'C',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: {
          '*': { mode: 'appendArr', items: { name: 'Ignored' } },
          entries: { mode: 'appendArr', items: { name: 'Added' } },
        },
      },
    }
    const r = resolveCopy(child, finder([base, child])) as Copyable & {
      entries: { name: string }[]
    }
    expect(r.entries.map((e) => e.name)).toEqual(['Added'])
  })

  it('resolves a multi-level copy chain', () => {
    const a: Copyable = { name: 'A', source: 'X', darkvision: 60 }
    const b: Copyable = {
      name: 'B',
      source: 'X',
      _copy: { name: 'A', source: 'X' },
      speed: 30,
    }
    const c: Copyable = { name: 'C', source: 'X', _copy: { name: 'B', source: 'X' } }
    const r = resolveCopy(c, finder([a, b, c]))
    expect(r.darkvision).toBe(60)
    expect(r.speed).toBe(30)
  })

  it('appends to an array only what it does not already hold', () => {
    const base: Copyable = { name: 'B', source: 'X', property: ['F', 'L'] }
    const child: Copyable = {
      name: 'C',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: { property: { mode: 'appendIfNotExistsArr', items: ['L', 'T'] } },
      },
    }
    expect(resolveCopy(child, finder([base, child])).property).toEqual(['F', 'L', 'T'])
  })

  it('sets and changes properties inside a nested object by their dotted path', () => {
    const base: Copyable = {
      name: 'B',
      source: 'X',
      inherits: { rarity: 'rare', entries: ['one'] },
    }
    const child: Copyable = {
      name: 'C',
      source: 'X',
      _copy: {
        name: 'B',
        source: 'X',
        _mod: {
          'inherits.rarity': { mode: 'setProp', value: 'legendary' },
          'inherits.entries': { mode: 'appendArr', items: 'two' },
          'nowhere.entries': { mode: 'appendArr', items: 'lost' },
        },
      },
    }
    const r = resolveCopy(child, finder([base, child]))
    expect(r.inherits).toEqual({ rarity: 'legendary', entries: ['one', 'two'] })
    expect(r.nowhere).toBeUndefined()
    expect(base.inherits).toEqual({ rarity: 'rare', entries: ['one'] })
  })
})
