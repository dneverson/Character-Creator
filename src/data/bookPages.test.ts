import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _clearBookContents,
  annotateContents,
  bookSections,
  bookTextPath,
  buildPageIndex,
  collectPages,
  collectRefs,
  loadBookContents,
  pageResolver,
} from './bookPages'
import { fetchData, fetchDataUncached } from './dataClient'
import type { Book, BookContentEntry } from './types'

vi.mock('./dataClient', () => ({ fetchData: vi.fn(), fetchDataUncached: vi.fn() }))
const mockFetch = vi.mocked(fetchData)
const mockFetchUncached = vi.mocked(fetchDataUncached)

describe('collectPages', () => {
  it('records the first page seen for each name, recursing into entries', () => {
    const data = [
      {
        type: 'section',
        name: 'Chapter 1: Playing the Game',
        page: 7,
        entries: [
          { type: 'entries', name: 'Dice', page: 9 },
          { type: 'entries', name: 'Ability Checks', page: 10 },
          // A later duplicate must not overwrite the first (chapter-scoped) page.
          { type: 'entries', name: 'Ability Checks', page: 16 },
          // Leaf refs (no page) are skipped.
          { type: 'statblock', name: 'Goblin' },
          // Plain text between the nodes is skipped too.
          'Some prose.',
        ],
      },
    ]
    expect(Object.fromEntries(collectPages(data))).toEqual({
      'Chapter 1: Playing the Game': 7,
      Dice: 9,
      'Ability Checks': 10,
    })
  })

  it('is not confused by a heading named like a built-in property', () => {
    const pages = collectPages([{ type: 'entries', name: 'constructor', page: 12 }])
    expect(pages.get('constructor')).toBe(12)
    expect(pages.get('toString')).toBeUndefined()
  })
})

describe('collectRefs', () => {
  it('records each statblock stub name → its source, or null when the stub omits one', () => {
    const section = {
      type: 'section',
      name: 'Chapter 3: Character Classes',
      entries: [
        { type: 'statblock', tag: 'class', name: 'Barbarian', source: 'XPHB' },
        { type: 'statblock', tag: 'class', name: 'Bard', source: 'XPHB' },
        // A later duplicate must not overwrite the first source.
        { type: 'statblock', tag: 'class', name: 'Barbarian', source: 'PHB' },
        // Non-statblock nodes are skipped entirely…
        { type: 'entries', name: 'Multiclassing', page: 42 },
        // …but a sourceless statblock stub is recorded as null (its page lives in
        // the containing book's own entity file - the caller supplies that source).
        { type: 'statblock', tag: 'class', name: 'Fighter' },
      ],
    }
    expect(Object.fromEntries(collectRefs(section))).toEqual({
      Barbarian: { kind: 'class', source: 'XPHB' },
      Bard: { kind: 'class', source: 'XPHB' },
      Fighter: { kind: 'class', source: null },
    })
  })

  it('reads the kind of entity from the tag, or from the list its description is kept in', () => {
    const refs = collectRefs([
      { type: 'statblock', tag: 'creature', name: 'Goblin', source: 'MM' },
      { type: 'statblock', prop: 'monsterFluff', name: 'Dragons', source: 'MM' },
      { type: 'statblock', prop: 'raceFluff', name: 'Elf', source: 'PHB' },
      { type: 'statblock', name: 'Unlabelled', source: 'PHB' },
    ])
    expect(refs.get('Goblin')?.kind).toBe('creature')
    expect(refs.get('Dragons')?.kind).toBe('creature')
    expect(refs.get('Elf')?.kind).toBe('race')
    expect(refs.get('Unlabelled')?.kind).toBeNull()
  })
})

describe('buildPageIndex / pageResolver', () => {
  it('indexes name+source→page (first wins) and resolves case/punctuation-insensitively', () => {
    const index = buildPageIndex('class', [
      { name: 'Barbarian', source: 'XPHB', page: 50 },
      // A reprint under the same key must not shadow the first page.
      { name: 'Barbarian', source: 'XPHB', page: 999 },
      // Records missing name/source/page are ignored.
      { name: 'Bard', source: 'XPHB' },
      null,
    ])
    buildPageIndex('spell', [{ name: 'Cure Wounds', source: 'XPHB', page: 259 }], index)
    const resolve = pageResolver(index)

    expect(resolve({ kind: 'class', source: 'XPHB' }, 'Barbarian')).toBe(50)
    // norm() strips punctuation and case, so a "cure-wounds" heading still hits.
    expect(resolve({ kind: 'spell', source: 'XPHB' }, 'cure-wounds')).toBe(259)
    // A different source, an unindexed name, or no source all miss cleanly.
    expect(resolve({ kind: 'class', source: 'PHB' }, 'Barbarian')).toBeUndefined()
    expect(resolve({ kind: 'class', source: 'XPHB' }, 'Bard')).toBeUndefined()
    expect(resolve({ kind: 'class', source: null }, 'Barbarian')).toBeUndefined()
  })

  it('keeps entities of different kinds apart, even with the same name and source', () => {
    const index = buildPageIndex('race', [{ name: 'Goblin', source: 'MPMM', page: 19 }])
    buildPageIndex('creature', [{ name: 'Goblin', source: 'MPMM', page: 140 }], index)
    const resolve = pageResolver(index)

    expect(resolve({ kind: 'race', source: 'MPMM' }, 'Goblin')).toBe(19)
    expect(resolve({ kind: 'creature', source: 'MPMM' }, 'Goblin')).toBe(140)
    expect(resolve({ kind: null, source: 'MPMM' }, 'Goblin')).toBeUndefined()
  })
})

describe('annotateContents', () => {
  const bookData = [
    { type: 'section', name: 'Introduction: Welcome', page: 4, entries: [] },
    {
      type: 'section',
      name: 'Chapter 1: Playing the Game',
      page: 7,
      entries: [
        { type: 'entries', name: 'Dice', page: 9 },
        { type: 'entries', name: 'Ability Checks', page: 10 },
      ],
    },
  ]

  it('pages chapters by name suffix and headers by (normalised) name', () => {
    const contents: BookContentEntry[] = [
      { name: 'Introduction: Welcome', headers: [] },
      {
        name: 'Playing the Game',
        ordinal: { type: 'chapter', identifier: 1 },
        // A plain-string header gains a page and becomes an object; a header with
        // no page in the book text is left untouched.
        headers: ['Dice', { header: 'ability checks', depth: 1 }, 'Combat'],
      },
    ]
    const paged = annotateContents(contents, bookData)

    expect(paged[0].page).toBe(4)
    expect(paged[1].page).toBe(7)
    expect(paged[1].headers?.[0]).toEqual({ header: 'Dice', page: 9 })
    expect(paged[1].headers?.[1]).toEqual({
      header: 'ability checks',
      depth: 1,
      page: 10,
    })
    // No page for "Combat" - passes through as a plain string.
    expect(paged[1].headers?.[2]).toBe('Combat')
    // The ordinal and everything else about the chapter is carried over.
    expect(paged[1].ordinal).toEqual({ type: 'chapter', identifier: 1 })
  })

  it('leaves the contents it was given untouched', () => {
    const contents: BookContentEntry[] = [{ name: 'Playing the Game', headers: ['Dice'] }]
    const paged = annotateContents(contents, bookData)

    expect(paged).not.toBe(contents)
    expect(contents).toEqual([{ name: 'Playing the Game', headers: ['Dice'] }])
  })

  it('resolves reference-only sub-headings via the entity index fallback', () => {
    // The book text lists classes as stat-block stubs (source, no inline page).
    const classData = [
      {
        type: 'section',
        name: 'Chapter 3: Character Classes',
        page: 46,
        entries: [
          { type: 'statblock', tag: 'class', name: 'Barbarian', source: 'XPHB' },
          { type: 'statblock', tag: 'class', name: 'Bard', source: 'XPHB' },
        ],
      },
    ]
    const contents: BookContentEntry[] = [
      {
        name: 'Character Classes',
        ordinal: { type: 'chapter', identifier: 3 },
        headers: ['Barbarian', 'bard'],
      },
    ]
    const resolve = pageResolver(
      buildPageIndex('class', [
        { name: 'Barbarian', source: 'XPHB', page: 50 },
        { name: 'Bard', source: 'XPHB', page: 52 },
      ]),
    )
    const paged = annotateContents(contents, classData, resolve)

    expect(paged[0].page).toBe(46)
    expect(paged[0].headers?.[0]).toEqual({ header: 'Barbarian', page: 50 })
    // The heading matches its stub whatever its capitalisation.
    expect(paged[0].headers?.[1]).toEqual({ header: 'bard', page: 52 })
  })

  it('resolves sourceless class stubs against the book’s own source', () => {
    // The 2014 book text lists classes as `{ type: statblock, name, tag }` with no
    // source; their page lives in the book’s own class file, so the book source is
    // the fallback.
    const classData = [
      {
        type: 'section',
        name: 'Classes',
        page: 45,
        entries: [
          { type: 'statblock', name: 'Barbarian', tag: 'class' },
          { type: 'statblock', name: 'Bard', tag: 'class' },
        ],
      },
    ]
    const contents: BookContentEntry[] = [
      { name: 'Classes', headers: ['Barbarian', 'Bard'] },
    ]
    const resolve = pageResolver(
      buildPageIndex('class', [
        { name: 'Barbarian', source: 'PHB', page: 46 },
        { name: 'Bard', source: 'PHB', page: 51 },
      ]),
    )
    // The 4th argument supplies the book source used when a stub omits its own.
    const paged = annotateContents(contents, classData, resolve, 'PHB')

    expect(paged[0].headers?.[0]).toEqual({ header: 'Barbarian', page: 46 })
    expect(paged[0].headers?.[1]).toEqual({ header: 'Bard', page: 51 })
    // Without a book source there is nowhere to look.
    expect(annotateContents(contents, classData, resolve)[0].headers?.[0]).toBe(
      'Barbarian',
    )
  })

  it('never resolves a prose heading that is not a reference stub', () => {
    // "Combat" is a plain prose heading (no statblock stub); even though the index
    // contains a same-named entity, it must not borrow that page.
    const data = [{ type: 'section', name: 'Playing the Game', page: 5, entries: [] }]
    const contents: BookContentEntry[] = [
      { name: 'Playing the Game', headers: ['Combat'] },
    ]
    const resolve = vi.fn(() => 999)
    const paged = annotateContents(contents, data, resolve, 'PHB')

    expect(paged[0].headers?.[0]).toBe('Combat')
    expect(resolve).not.toHaveBeenCalled()
  })

  it('prefers an inline book-text page over the resolver fallback', () => {
    const data = [
      {
        type: 'section',
        name: 'Chapter 1: Playing the Game',
        page: 7,
        entries: [{ type: 'entries', name: 'Dice', page: 9 }],
      },
    ]
    const contents: BookContentEntry[] = [{ name: 'Playing the Game', headers: ['Dice'] }]
    // The resolver would return a different page; the inline one must win.
    const paged = annotateContents(contents, data, () => 999)
    expect(paged[0].headers?.[0]).toEqual({ header: 'Dice', page: 9 })
  })

  it('changes nothing when the book text has no pages', () => {
    const contents: BookContentEntry[] = [{ name: 'Only', headers: ['Thing'] }]
    const paged = annotateContents(contents, [
      { type: 'section', name: 'Only', entries: [{ type: 'entries', name: 'Thing' }] },
    ])
    expect(paged).toEqual(contents)
  })

  it('tolerates chapters the text does not have, chapters without headers and malformed sections', () => {
    const contents: BookContentEntry[] = [
      { name: 'Missing Chapter', headers: ['Thing'] },
      { name: 'Introduction: Welcome' },
    ]
    const paged = annotateContents(contents, [
      null,
      'text',
      { type: 'section' },
      ...bookData,
    ])
    expect(paged).toEqual([
      { name: 'Missing Chapter', headers: ['Thing'] },
      { name: 'Introduction: Welcome', page: 4 },
    ])
    expect(annotateContents([], bookData)).toEqual([])
  })
})

describe('bookSections', () => {
  const sections = [{ type: 'section', name: 'Introduction', page: 5 }]

  it('reads the sections of either layout of a book text file', () => {
    expect(bookSections({ data: sections }, 'PHB')).toBe(sections)
    expect(
      bookSections({ bookData: [{ id: 'PHB', source: 'PHB', data: sections }] }, 'PHB'),
    ).toBe(sections)
  })

  it('picks the book by source when a file holds several, else the first', () => {
    const other = [{ type: 'section', name: 'Other' }]
    const file = {
      bookData: [null, { source: 'MM', data: other }, { source: 'PHB', data: sections }],
    }
    expect(bookSections(file, 'PHB')).toBe(sections)
    expect(bookSections(file, 'DMG')).toBe(other)
  })

  it('returns null for anything that is not a book text', () => {
    expect(bookSections(null, 'PHB')).toBeNull()
    expect(bookSections({ book: [] }, 'PHB')).toBeNull()
    expect(bookSections({ bookData: [] }, 'PHB')).toBeNull()
    expect(bookSections({ bookData: [{ source: 'PHB' }] }, 'PHB')).toBeNull()
  })
})

describe('bookTextPath', () => {
  it('names the text file by the lower-cased source', () => {
    expect(bookTextPath('XPHB')).toBe('book/book-xphb.json')
  })
})

describe('loadBookContents', () => {
  const book: Book = {
    id: 'TST',
    name: 'Test Book',
    source: 'TST',
    contents: [
      { name: 'Introduction', headers: ['Welcome'] },
      { name: 'Classes', headers: ['Barbarian'] },
      { name: 'Bestiary', headers: ['Goblin', 'Wolf', 'Mystery'] },
      { name: 'Races', headers: ['Goblin'] },
    ],
  }
  const text = {
    bookData: [
      {
        source: 'TST',
        data: [
          {
            type: 'section',
            name: 'Introduction',
            page: 3,
            entries: [{ type: 'entries', name: 'Welcome', page: 4 }],
          },
          {
            type: 'section',
            name: 'Chapter 1: Classes',
            page: 10,
            entries: [{ type: 'statblock', tag: 'class', name: 'Barbarian' }],
          },
          {
            type: 'section',
            name: 'Chapter 2: Bestiary',
            page: 100,
            entries: [
              { type: 'statblock', tag: 'creature', name: 'Goblin', source: 'TST' },
              { type: 'statblock', tag: 'creature', name: 'Wolf', source: 'MM' },
              { type: 'statblock', tag: 'unheardof', name: 'Mystery', source: 'TST' },
            ],
          },
          {
            type: 'section',
            name: 'Chapter 3: Races',
            page: 200,
            entries: [{ type: 'statblock', tag: 'race', name: 'Goblin', source: 'TST' }],
          },
        ],
      },
    ],
  }
  const dataFiles: Record<string, unknown> = {
    'class/index.json': { barbarian: 'class-barbarian.json', bard: 'class-bard.json' },
    'class/class-barbarian.json': {
      class: [{ name: 'Barbarian', source: 'TST', page: 12 }],
    },
    'class/class-bard.json': { class: [{ name: 'Bard', source: 'TST', page: 20 }] },
    'bestiary/index.json': { TST: 'bestiary-tst.json', MM: 'bestiary-mm.json' },
    'bestiary/bestiary-tst.json': {
      _meta: { internalCopies: ['monster'] },
      monster: [{ name: 'Goblin', source: 'TST', page: 140 }],
    },
    'bestiary/bestiary-mm.json': { monster: [{ name: 'Wolf', source: 'MM', page: 341 }] },
    'races.json': { race: [{ name: 'Goblin', source: 'TST', page: 201 }] },
  }

  beforeEach(() => {
    _clearBookContents()
    mockFetch.mockReset()
    mockFetchUncached.mockReset()
    mockFetch.mockImplementation((path: string) =>
      path in dataFiles
        ? Promise.resolve(dataFiles[path])
        : Promise.reject(new Error(`no ${path}`)),
    )
    mockFetchUncached.mockResolvedValue(text)
  })

  it('pages the contents from the book text and the entities it points at', async () => {
    const paged = await loadBookContents(book)

    expect(mockFetchUncached).toHaveBeenCalledWith('book/book-tst.json')
    expect(paged).toEqual([
      { name: 'Introduction', page: 3, headers: [{ header: 'Welcome', page: 4 }] },
      // A stub without a source belongs to the book itself.
      { name: 'Classes', page: 10, headers: [{ header: 'Barbarian', page: 12 }] },
      {
        name: 'Bestiary',
        page: 100,
        headers: [
          { header: 'Goblin', page: 140 },
          // A creature reprinted from another book is looked up in that book's file.
          { header: 'Wolf', page: 341 },
          // A kind of entity nothing is known about is left without a page.
          'Mystery',
        ],
      },
      // The same name as a creature, but the stub says it is a race.
      { name: 'Races', page: 200, headers: [{ header: 'Goblin', page: 201 }] },
    ])
  })

  it('reads only the files of the entities the book points at', async () => {
    await loadBookContents(book)
    const asked = mockFetch.mock.calls.map(([path]) => path).sort()
    expect(asked).toEqual([
      'bestiary/bestiary-mm.json',
      'bestiary/bestiary-tst.json',
      'bestiary/index.json',
      'class/class-barbarian.json',
      'class/class-bard.json',
      'class/index.json',
      'races.json',
    ])
  })

  it('works the pages out once per book', async () => {
    const first = loadBookContents(book)
    expect(loadBookContents(book)).toBe(first)
    await first
    expect(mockFetchUncached).toHaveBeenCalledTimes(1)
  })

  it('gives the contents unpaged when the book has no text file', async () => {
    mockFetchUncached.mockRejectedValue(new Error('HTTP 404'))
    expect(await loadBookContents(book)).toBe(book.contents)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('gives the contents unpaged when the file is not a book text', async () => {
    mockFetchUncached.mockResolvedValue({ unexpected: true })
    expect(await loadBookContents(book)).toBe(book.contents)
  })

  it('leaves headings without a page when an entity file cannot be had', async () => {
    mockFetch.mockImplementation((path: string) =>
      path.startsWith('bestiary/') || path === 'races.json'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(dataFiles[path]),
    )
    const paged = await loadBookContents(book)

    expect(paged[1].headers).toEqual([{ header: 'Barbarian', page: 12 }])
    expect(paged[2]).toEqual({
      name: 'Bestiary',
      page: 100,
      headers: ['Goblin', 'Wolf', 'Mystery'],
    })
    expect(paged[3].headers).toEqual(['Goblin'])
  })

  it('asks for nothing when a book lists no contents', async () => {
    expect(await loadBookContents({ id: 'X', name: 'Empty', source: 'X' })).toEqual([])
    expect(mockFetchUncached).not.toHaveBeenCalled()
  })
})
