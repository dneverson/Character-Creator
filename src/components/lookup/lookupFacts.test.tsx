import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LookupRow } from '../../lookup/types'
import { makeFeat } from '../../test/featFixtures'
import { makeItem } from '../../test/itemFixtures'
import { makeSpell } from '../../test/spellFixtures'
import { factValue } from '../table/facts'
import { describeLookup, lookupColumns, lookupTags, lookupTitle } from './lookupFacts'

const row = (kind: LookupRow['kind'], subject: LookupRow['subject'], name: string) =>
  ({
    id: `${kind}:${name}`,
    kind,
    name,
    source: 'PHB',
    edition: 'classic',
    subject,
  }) as LookupRow

const spell = row(
  'spell',
  {
    type: 'spell',
    value: makeSpell({ name: 'Fireball', entries: ['A bright streak.'] }),
  },
  'Fireball',
)
const item = row(
  'item',
  { type: 'item', value: makeItem({ name: 'Rope', entries: ['Fifty feet.'] }) },
  'Rope',
)
const feat = row(
  'feat',
  { type: 'feat', value: makeFeat({ name: 'Alert', entries: ['Always ready.'] }) },
  'Alert',
)
const condition = row(
  'condition',
  {
    type: 'text',
    value: {
      name: 'Prone',
      source: 'PHB',
      page: 292,
      facts: [{ label: 'Type', value: 'Condition' }],
      entries: ['Crawling.'],
    },
  },
  'Prone',
)

const find = (rows: LookupRow[], key: string) =>
  describeLookup(rows)
    .flatMap((group) => group.facts)
    .find((fact) => fact.key === key)

describe('describing the rows of Quick lookup', () => {
  it('draws each row with its own dataset and leaves the others blank', () => {
    const rows = [spell, item, condition]
    const groups = describeLookup(rows)
    const keys = groups.map((g) => g.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual(
      expect.arrayContaining([
        'spell-basics',
        'item-overview',
        'text-basics',
        'text-text',
      ]),
    )
    const level = find([spell], 'level')
    expect(level?.text(spell)).not.toBe('')
    expect(level?.text(item)).toBe('')
    expect(find(rows, 'Type')?.text(condition)).toBe('Condition')
    expect(find(rows, 'Type')?.text(spell)).toBe('')
    expect(find([condition], 'page')?.text(condition)).toBe('p. 292')
    expect(find([condition], 'page')?.text(spell)).toBe('')
  })

  it('draws a fact the way its dataset does, and text with its own entries', () => {
    render(<>{factValue(find([condition], 'description')!, condition)}</>)
    expect(screen.getByText('Crawling.')).toBeInTheDocument()
    render(<>{factValue(find([spell], 'description')!, spell)}</>)
    expect(screen.getByText('A bright streak.')).toBeInTheDocument()
    expect(find([feat], 'description')?.text(feat)).toContain('Always ready.')
  })

  it('names a subclass with its class and tags every row with its kind and edition', () => {
    expect(lookupTitle(spell)).toBe('Fireball')
    expect(lookupTags(spell)).toEqual(['Spell', '2014'])
    expect(lookupTags({ ...item, edition: 'one' })).toEqual(['Item', '2024'])
  })

  it('has name, kind, source, edition and match columns', () => {
    const columns = lookupColumns(
      new Map([[spell.id, { before: 'a ', match: 'fire', after: ' b' }]]),
    )
    expect(columns.map((c) => c.key)).toEqual([
      'name',
      'kind',
      'source',
      'edition',
      'match',
    ])
    const text = (key: string, r: LookupRow) => {
      const { container } = render(<>{columns.find((c) => c.key === key)?.render(r)}</>)
      return container.textContent
    }
    expect(text('kind', spell)).toBe('Spell')
    expect(text('edition', item)).toBe('2014')
    expect(text('match', spell)).toBe('a fire b')
    expect(text('match', item)).toBe('-')
    expect(text('name', { ...spell, context: 'Druid 2' })).toBe('FireballDruid 2')
    expect(text('source', spell)).toBe('PHB')
  })
})
