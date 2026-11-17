// A small book in the shape of the content source's book text, for the reader's tests: two
// chapters, a heading with a sidebar, a table, a list, a picture and a stat block.

import type { BookDoc } from '../books/types'
import type { Entry } from '../text/Entries'

export const fixtureSections: Entry[] = [
  {
    type: 'section',
    name: 'Chapter 1: Wanderers',
    page: 3,
    entries: [
      'The road runs {@b north} through the {@creature goblin|MM} country.',
      {
        type: 'entries',
        name: 'Packing',
        page: 4,
        entries: [
          'Bring rope and a lantern.',
          {
            type: 'list',
            items: [
              'A sturdy rope',
              { type: 'item', name: 'Lantern', entry: 'Burns for six hours.' },
            ],
          },
          {
            type: 'table',
            caption: 'Supplies',
            colLabels: ['Item', 'Cost'],
            colStyles: ['col-8', 'col-4 text-right'],
            rows: [
              ['Rope', '1 gp'],
              ['Lantern', '5 gp'],
            ],
          },
        ],
      },
      {
        type: 'insetReadaloud',
        name: 'Read aloud',
        entries: ['The dragon wakes slowly.'],
      },
      {
        type: 'image',
        href: { type: 'internal', path: 'book/TST/map.webp' },
        title: 'The old road',
        width: 800,
        height: 400,
      },
      { type: 'statblock', tag: 'creature', name: 'Goblin', source: 'MM' },
    ],
  },
  {
    type: 'section',
    name: 'Chapter 2: Arrival',
    page: 9,
    entries: [
      'The town gate closes at dusk.',
      { type: 'entries', name: 'Packing', page: 10, entries: ['A second packing list.'] },
    ],
  },
]

export const fixtureFile = {
  bookData: [{ id: 'TST', source: 'TST', data: fixtureSections }],
}

export const fixtureDoc: BookDoc = {
  kind: 'book',
  id: 'TST',
  name: 'Test Handbook',
  group: 'core',
  published: '2014-08-19',
  cover: null,
}
