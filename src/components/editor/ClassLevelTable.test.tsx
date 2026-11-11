import { readdirSync, readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  resolveClassFeatures,
  resolveSubclassFeatures,
  type ClassFile,
} from '../../data/class'
import { dataDir } from '../../test/dataAudit'
import { ClassLevelTable } from './ClassLevelTable'

const groups = [
  { colLabels: ['Rages'], rows: Array.from({ length: 20 }, (_, i) => [i + 1]) },
  {
    title: 'Spell Slots per Spell Level',
    colLabels: ['1st', '2nd'],
    rowsSpellProgression: Array.from({ length: 20 }, () => [2, 1]),
  },
]

describe('ClassLevelTable', () => {
  it('prints a row per level with a grouped heading over the slot columns', () => {
    render(
      <ClassLevelTable groups={groups} features={new Map()} level={5} label="Test" />,
    )
    const table = screen.getByRole('table', { name: 'Test' })
    expect(within(table).getAllByRole('row')).toHaveLength(22)
    expect(
      within(table).getByRole('columnheader', { name: 'Spell Slots per Spell Level' }),
    ).toHaveAttribute('colspan', '2')
    expect(within(table).getByRole('columnheader', { name: 'PB' })).toHaveAttribute(
      'rowspan',
      '2',
    )
    expect(within(table).getByRole('columnheader', { name: '2nd' })).toBeInTheDocument()
  })

  it('marks the character level and dims the levels not yet reached', () => {
    render(
      <ClassLevelTable groups={groups} features={new Map()} level={5} label="Test" />,
    )
    const row = (level: number) =>
      screen.getByRole('rowheader', { name: String(level) }).closest('tr') as HTMLElement
    expect(row(5)).toHaveAttribute('aria-current', 'true')
    expect(row(5)).toHaveClass('table-active')
    expect(row(6)).toHaveClass('class-level-table__ahead')
    expect(row(4)).not.toHaveClass('class-level-table__ahead')
    expect(row(4)).not.toHaveAttribute('aria-current')
  })

  it('has one heading row when no column is grouped', () => {
    render(
      <ClassLevelTable
        groups={[groups[0]]}
        features={new Map()}
        level={1}
        label="Plain"
      />,
    )
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(21)
    expect(screen.getByRole('columnheader', { name: 'Level' })).toHaveAttribute(
      'rowspan',
      '1',
    )
  })
})

const classFiles = dataDir
  ? readdirSync(`${dataDir}/class`).filter((f) => /^class-.*\.json$/.test(f))
  : []

describe.skipIf(!dataDir)('class tables against the data', () => {
  const text = (container: HTMLElement) => container.textContent ?? ''

  it.each(classFiles)('%s: every class and subclass table prints whole', (file) => {
    const data = JSON.parse(readFileSync(`${dataDir}/class/${file}`, 'utf8')) as ClassFile
    for (const entry of data.class ?? []) {
      const loaded = { entry, file: data }
      const features = resolveClassFeatures(loaded)
      const { container, unmount } = render(
        <ClassLevelTable
          groups={entry.classTableGroups}
          features={features}
          level={7}
          label={entry.name}
        />,
      )
      const label = `${entry.name} (${entry.source})`
      expect(text(container), label).not.toMatch(/undefined|\{@|NaN|\[object/)
      const headings = container.querySelectorAll('thead tr:first-child th')
      expect(headings.length, label).toBeGreaterThanOrEqual(3)
      // One row per level, each as wide as the table.
      const width = container.querySelectorAll('tbody tr:first-child > *').length
      for (const tr of container.querySelectorAll('tbody tr')) {
        expect(tr.children.length, label).toBe(width)
      }
      expect(container.querySelectorAll('tbody tr'), label).toHaveLength(20)
      // Every column the data names is there.
      const shown = text(container)
      for (const group of entry.classTableGroups ?? []) {
        for (const column of group.colLabels ?? []) {
          const plain = column.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1')
          if (group.rowsSpellProgression) continue
          expect(shown, `${label} column ${plain}`).toContain(plain)
        }
      }
      unmount()
    }
    for (const subclass of data.subclass ?? []) {
      if (!subclass.subclassTableGroups) continue
      const { container, unmount } = render(
        <ClassLevelTable
          groups={subclass.subclassTableGroups}
          features={resolveSubclassFeatures(data, subclass)}
          level={7}
          label={subclass.name}
        />,
      )
      expect(text(container), subclass.name).not.toMatch(/undefined|\{@|NaN|\[object/)
      unmount()
    }
  })
})
