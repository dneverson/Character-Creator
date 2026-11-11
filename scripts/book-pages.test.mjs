import { describe, expect, it } from 'vitest'
import {
  annotateContents,
  buildPageIndex,
  collectPages,
  collectRefs,
  pageResolver,
} from './book-pages.mjs'

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
        ],
      },
    ]
    const map = collectPages(data)
    expect(map).toEqual({
      'Chapter 1: Playing the Game': 7,
      Dice: 9,
      'Ability Checks': 10,
    })
  })
})

describe('collectRefs', () => {
  it('records each statblock stub name → its source, or null when the stub omits one', () => {
    const section = {
      type: 'section',
      name: 'Chapter 3: Character Classes',
      entries: [
        { type: 'statblock', name: 'Barbarian', source: 'XPHB' },
        { type: 'statblock', name: 'Bard', source: 'XPHB' },
        // A later duplicate must not overwrite the first source.
        { type: 'statblock', name: 'Barbarian', source: 'PHB' },
        // Non-statblock nodes are skipped entirely…
        { type: 'entries', name: 'Multiclassing', page: 42 },
        // …but a sourceless statblock stub is recorded as null (its page lives in
        // the containing book's own entity file - the caller supplies that source).
        { type: 'statblock', name: 'Fighter' },
      ],
    }
    expect(collectRefs(section)).toEqual({
      Barbarian: 'XPHB',
      Bard: 'XPHB',
      Fighter: null,
    })
  })
})

describe('buildPageIndex / pageResolver', () => {
  it('indexes name+source→page (first wins) and resolves case/punctuation-insensitively', () => {
    const index = buildPageIndex([
      { name: 'Barbarian', source: 'XPHB', page: 50 },
      // A reprint under the same key must not shadow the first page.
      { name: 'Barbarian', source: 'XPHB', page: 999 },
      // Records missing name/source/page are ignored.
      { name: 'Bard', source: 'XPHB' },
      { name: 'Cure Wounds', source: 'XPHB', page: 259 },
    ])
    const resolve = pageResolver(index)

    expect(resolve('XPHB', 'Barbarian')).toBe(50)
    // norm() strips punctuation and case, so a "cure-wounds" heading still hits.
    expect(resolve('XPHB', 'cure-wounds')).toBe(259)
    // A different source, an unindexed name, or no source all miss cleanly.
    expect(resolve('PHB', 'Barbarian')).toBeUndefined()
    expect(resolve('XPHB', 'Bard')).toBeUndefined()
    expect(resolve(undefined, 'Barbarian')).toBeUndefined()
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
    const contents = [
      { name: 'Introduction: Welcome', headers: [] },
      {
        name: 'Playing the Game',
        ordinal: { type: 'chapter', identifier: 1 },
        // A plain-string header gains a page and becomes an object; a header with
        // no page in the book text is left untouched.
        headers: ['Dice', { header: 'Ability Checks', depth: 1 }, 'Combat'],
      },
    ]
    const applied = annotateContents(contents, bookData)

    expect(contents[0].page).toBe(4)
    expect(contents[1].page).toBe(7)
    expect(contents[1].headers[0]).toEqual({ header: 'Dice', page: 9 })
    expect(contents[1].headers[1]).toEqual({
      header: 'Ability Checks',
      depth: 1,
      page: 10,
    })
    // No page for "Combat" - passes through as a plain string.
    expect(contents[1].headers[2]).toBe('Combat')
    // 2 chapters + 2 headers.
    expect(applied).toBe(4)
  })

  it('resolves reference-only sub-headings via the entity index fallback', () => {
    // The book text lists classes as stat-block stubs (source, no inline page).
    const classData = [
      {
        type: 'section',
        name: 'Chapter 3: Character Classes',
        page: 46,
        entries: [
          { type: 'statblock', name: 'Barbarian', source: 'XPHB' },
          { type: 'statblock', name: 'Bard', source: 'XPHB' },
        ],
      },
    ]
    const contents = [
      {
        name: 'Character Classes',
        ordinal: { type: 'chapter', identifier: 3 },
        headers: ['Barbarian', 'Bard'],
      },
    ]
    const resolve = pageResolver(
      buildPageIndex([
        { name: 'Barbarian', source: 'XPHB', page: 50 },
        { name: 'Bard', source: 'XPHB', page: 52 },
      ]),
    )
    const applied = annotateContents(contents, classData, resolve)

    expect(contents[0].page).toBe(46)
    expect(contents[0].headers[0]).toEqual({ header: 'Barbarian', page: 50 })
    expect(contents[0].headers[1]).toEqual({ header: 'Bard', page: 52 })
    // 1 chapter + 2 resolved headers.
    expect(applied).toBe(3)
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
    const contents = [{ name: 'Classes', headers: ['Barbarian', 'Bard'] }]
    const resolve = pageResolver(
      buildPageIndex([
        { name: 'Barbarian', source: 'PHB', page: 46 },
        { name: 'Bard', source: 'PHB', page: 51 },
      ]),
    )
    // The 4th argument supplies the book source used when a stub omits its own.
    annotateContents(contents, classData, resolve, 'PHB')

    expect(contents[0].headers[0]).toEqual({ header: 'Barbarian', page: 46 })
    expect(contents[0].headers[1]).toEqual({ header: 'Bard', page: 51 })
  })

  it('never resolves a prose heading that is not a reference stub', () => {
    // "Combat" is a plain prose heading (no statblock stub); even though the index
    // contains a same-named entity, it must not borrow that page.
    const data = [{ type: 'section', name: 'Playing the Game', page: 5, entries: [] }]
    const contents = [{ name: 'Playing the Game', headers: ['Combat'] }]
    const resolve = pageResolver(
      buildPageIndex([{ name: 'Combat', source: 'PHB', page: 999 }]),
    )
    annotateContents(contents, data, resolve, 'PHB')
    expect(contents[0].headers[0]).toBe('Combat')
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
    const contents = [{ name: 'Playing the Game', headers: ['Dice'] }]
    // The resolver would return a different page; the inline one must win.
    const resolve = () => 999
    annotateContents(contents, data, resolve)
    expect(contents[0].headers[0]).toEqual({ header: 'Dice', page: 9 })
  })

  it('returns 0 and mutates nothing when the book text has no pages', () => {
    const contents = [{ name: 'Only', headers: ['Thing'] }]
    const applied = annotateContents(contents, [
      { type: 'section', name: 'Only', entries: [{ type: 'entries', name: 'Thing' }] },
    ])
    expect(applied).toBe(0)
    expect(contents[0].page).toBeUndefined()
    expect(contents[0].headers[0]).toBe('Thing')
  })

  it('tolerates missing or malformed inputs', () => {
    expect(annotateContents(undefined, [])).toBe(0)
    expect(annotateContents([], undefined)).toBe(0)
  })
})
