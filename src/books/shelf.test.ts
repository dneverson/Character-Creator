import { describe, expect, it } from 'vitest'
import { fixtureDoc } from '../test/bookFixture'
import { shelfGroups } from './shelf'
import type { BookDoc } from './types'

const doc = (id: string, over: Partial<BookDoc> = {}): BookDoc => ({
  ...fixtureDoc,
  id,
  name: id,
  ...over,
})

describe('shelfGroups', () => {
  it('groups in the order the catalog names the groups, oldest book first', () => {
    const groups = shelfGroups(
      [
        doc('B', { group: 'supplement', published: '2020-01-01' }),
        doc('A', { group: 'core', published: '2014-08-19' }),
        doc('C', { group: 'supplement', published: '2017-05-01' }),
      ],
      'book',
    )
    expect(groups.map((g) => [g.group, g.label, g.docs.map((d) => d.id)])).toEqual([
      ['supplement', 'Supplement', ['C', 'B']],
      ['core', 'Core rulebook', ['A']],
    ])
  })

  it('puts a document without a date last, and one without a group under Other', () => {
    const [group] = shelfGroups(
      [
        doc('Z', { group: undefined, published: undefined }),
        doc('Y', { group: undefined, published: '2000' }),
      ],
      'book',
    )
    expect(group.label).toBe('Other')
    expect(group.docs.map((d) => d.id)).toEqual(['Y', 'Z'])
  })

  it('keeps books and adventures apart', () => {
    const docs = [doc('B'), doc('A', { kind: 'adventure' })]
    expect(
      shelfGroups(docs, 'adventure').flatMap((g) => g.docs.map((d) => d.id)),
    ).toEqual(['A'])
    expect(shelfGroups([], 'book')).toEqual([])
  })
})
