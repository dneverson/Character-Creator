import { describe, expect, it } from 'vitest'
import type { ResolvedFeature } from '../data/class'
import { buildLevelTable, cellText, EMPTY_CELL, TABLE_LEVELS } from './classLevelTable'

const features = new Map<number, ResolvedFeature[]>([
  [
    1,
    [
      { name: 'Spellcasting', level: 1, entries: [] },
      { name: 'Sorcerous Origin', level: 1, entries: [] },
    ],
  ],
  [3, [{ name: 'Metamagic', level: 3, entries: [] }]],
])

describe('cellText', () => {
  it('reads numbers, tagged text, bonuses, speeds and dice', () => {
    expect(cellText(4)).toBe('4')
    expect(cellText('{@dice D6}')).toBe('D6')
    expect(cellText({ type: 'bonus', value: 2 })).toBe('+2')
    expect(cellText({ type: 'bonusSpeed', value: 10 })).toBe('+10 ft.')
    expect(cellText({ type: 'dice', toRoll: [{ number: 2, faces: 6 }] })).toBe('2d6')
  })

  it('shows nothing, zero and unreadable cells as the empty value', () => {
    expect(cellText(undefined)).toBe(EMPTY_CELL)
    expect(cellText(0)).toBe(EMPTY_CELL)
    expect(cellText('')).toBe(EMPTY_CELL)
    expect(cellText({ type: 'dice' })).toBe(EMPTY_CELL)
    expect(cellText({ type: 'dice', toRoll: ['x'] })).toBe(EMPTY_CELL)
    expect(cellText({ type: 'mystery' })).toBe(EMPTY_CELL)
  })
})

describe('buildLevelTable', () => {
  const rows = (fn: (i: number) => (number | string)[]) =>
    Array.from({ length: TABLE_LEVELS }, (_, i) => fn(i))
  const groups = [
    { colLabels: ['Sorcery Points'], rows: rows((i) => [i === 0 ? 0 : i + 1]) },
    {
      title: 'Spell Slots per Spell Level',
      colLabels: ['{@filter 1st|spells}', '2nd', '3rd'],
      rowsSpellProgression: rows((i) => [2, i > 0 ? 1 : 0, 0]),
    },
  ]

  it('lays out level, proficiency bonus, own columns, features, then the slot group', () => {
    const table = buildLevelTable(groups, features)
    expect(table.columns.map((c) => c.label)).toEqual([
      'Level',
      'Proficiency Bonus',
      'Sorcery Points',
      'Features',
      '1st',
      '2nd',
    ])
    expect(table.columns.map((c) => c.group)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      'Spell Slots per Spell Level',
      'Spell Slots per Spell Level',
    ])
    expect(table.rows).toHaveLength(TABLE_LEVELS)
    expect(table.rows[0].cells).toEqual([
      '1',
      '+2',
      '-',
      'Spellcasting, Sorcerous Origin',
      '2',
      '-',
    ])
    expect(table.rows[2].cells).toEqual(['3', '+2', '3', 'Metamagic', '2', '1'])
    expect(table.rows[4].cells[1]).toBe('+3')
    expect(table.rows[19].cells[1]).toBe('+6')
    expect(table.rows[1].cells[3]).toBe('-')
  })

  it('leaves out a slot level the class never reaches, but not another empty column', () => {
    const table = buildLevelTable(
      [{ colLabels: ['Rages'], rows: rows(() => [0]) }, ...groups.slice(1)],
      features,
    )
    expect(table.columns.map((c) => c.label)).toContain('Rages')
    expect(table.columns.map((c) => c.label)).not.toContain('3rd')
  })

  it('still gives a class with no groups its level, proficiency bonus and features', () => {
    const table = buildLevelTable(undefined, features)
    expect(table.columns.map((c) => c.label)).toEqual([
      'Level',
      'Proficiency Bonus',
      'Features',
    ])
    expect(table.rows[2].cells).toEqual(['3', '+2', 'Metamagic'])
  })

  it('fills a missing row with the empty value', () => {
    const table = buildLevelTable([{ colLabels: ['Short'], rows: [[7]] }], features)
    expect(table.rows[0].cells[2]).toBe('7')
    expect(table.rows[1].cells[2]).toBe('-')
  })

  it('handles a group with no labels or rows', () => {
    expect(buildLevelTable([{}], features).columns).toHaveLength(3)
  })
})
