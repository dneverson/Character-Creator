import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFluff, loadTable, targetOf } from './statblock'

const files = new Map<string, unknown>()
vi.mock('../data/dataClient', () => ({
  fetchData: async (path: string): Promise<unknown> => {
    if (!files.has(path)) throw new Error(`Failed to load data "${path}": HTTP 404`)
    return files.get(path)
  },
}))

beforeEach(() => files.clear())

describe('what a stat block stands for', () => {
  it('is the entry its tag names, with the book it is from', () => {
    expect(
      targetOf({ type: 'statblock', tag: 'creature', name: 'Goblin', source: 'MM' }),
    ).toEqual({
      kind: 'lookup',
      reference: expect.objectContaining({
        kind: 'creature',
        name: 'Goblin',
        source: 'MM',
      }),
    })
  })

  it('names a subclass by its short name and its class, and a deity by its pantheon', () => {
    const subclass = targetOf({
      type: 'statblock',
      prop: 'subclass',
      name: 'Oath of the Ebon Blade',
      shortName: 'Ebon Blade',
      className: 'Death Knight',
      classSource: 'WoW',
      source: 'WoW',
    })
    expect(subclass).toEqual({
      kind: 'lookup',
      reference: expect.objectContaining({
        kind: 'subclass',
        name: 'Ebon Blade',
        context: 'Death Knight',
        source: 'WoW',
      }),
    })
    const deity = targetOf({
      type: 'statblock',
      tag: 'deity',
      name: 'Bahamut',
      pantheon: 'Draconic',
      source: 'FTD',
    })
    expect(deity).toEqual({
      kind: 'lookup',
      reference: expect.objectContaining({
        kind: 'deity',
        name: 'Bahamut',
        source: 'FTD',
      }),
    })
  })

  it('is a description when the stat block names a list of descriptions', () => {
    expect(
      targetOf({
        type: 'statblock',
        prop: 'monsterFluff',
        name: 'Aboleth',
        source: 'MM',
      }),
    ).toEqual({
      kind: 'fluff',
      prop: 'monsterFluff',
      name: 'Aboleth',
      source: 'MM',
    })
  })

  it('is nothing known for a nameless one', () => {
    expect(targetOf({ type: 'statblock' })).toEqual({ kind: 'none' })
  })

  it('is a crochet pattern, or the description a book keeps for one', () => {
    expect(
      targetOf({ type: 'statblock', tag: 'crochet', name: 'Hat', source: 'CaBoMP' }),
    ).toEqual({ kind: 'crochet', name: 'Hat', source: 'CaBoMP' })
    expect(
      targetOf({
        type: 'statblock',
        prop: 'crochetPatternFluff',
        name: 'Hat',
        source: 'CaBoMP',
      }),
    ).toEqual({
      kind: 'fluff',
      prop: 'crochetPatternFluff',
      name: 'Hat',
      source: 'CaBoMP',
    })
  })
})

describe('the description of a stat block', () => {
  it('is read from the file the source has, through the index', async () => {
    files.set('bestiary/fluff-index.json', { MM: 'fluff-bestiary-mm.json' })
    files.set('bestiary/fluff-bestiary-mm.json', {
      monsterFluff: [{ name: 'Aboleth', source: 'MM', entries: ['Old.'], images: [] }],
    })
    expect((await loadFluff('monsterFluff', 'Aboleth', 'MM'))?.entries).toEqual(['Old.'])
    expect(await loadFluff('monsterFluff', 'Nothing', 'MM')).toBeUndefined()
    expect(await loadFluff('monsterFluff', 'Aboleth', 'XX')).toBeUndefined()
    expect(await loadFluff('unknownFluff', 'Aboleth', 'MM')).toBeUndefined()
  })

  it('works out the one it copies, even from another book, with its changes', async () => {
    files.set('bestiary/fluff-index.json', { AU: 'fluff-au.json', MM: 'fluff-mm.json' })
    files.set('bestiary/fluff-au.json', {
      monsterFluff: [
        {
          name: 'Abjurer',
          source: 'AU',
          _copy: {
            name: 'Archmage',
            source: 'MM',
            _mod: { entries: { mode: 'prependArr', items: 'Warding.' } },
          },
        },
      ],
    })
    files.set('bestiary/fluff-mm.json', {
      monsterFluff: [{ name: 'Archmage', source: 'MM', entries: ['Wise.'] }],
    })
    const fluff = await loadFluff('monsterFluff', 'Abjurer', 'AU')
    expect(fluff?.entries).toEqual(['Warding.', 'Wise.'])
    expect(fluff?.name).toBe('Abjurer')
  })

  it('is read by class name for a class, and from the one file for a race', async () => {
    files.set('class/fluff-index.json', { deathknight: 'fluff-class-deathknight.json' })
    files.set('class/fluff-class-deathknight.json', {
      classFluff: [{ name: 'Death Knight', source: 'WoW', entries: ['Cold.'] }],
    })
    files.set('fluff-races.json', {
      raceFluff: [{ name: 'Elf', source: 'PHB', entries: ['Fey.'] }],
    })
    expect((await loadFluff('classFluff', 'Death Knight', 'WoW'))?.entries).toEqual([
      'Cold.',
    ])
    expect((await loadFluff('raceFluff', 'Elf', 'PHB'))?.entries).toEqual(['Fey.'])
  })

  it('is undefined when a file cannot be read, and keeps what it has when the original is missing', async () => {
    expect(await loadFluff('raceFluff', 'Elf', 'PHB')).toBeUndefined()
    files.set('bestiary/fluff-index.json', {})
    expect(await loadFluff('monsterFluff', 'Aboleth', 'MM')).toBeUndefined()
    files.set('bestiary/fluff-index.json', { MM: 'fluff-mm.json' })
    files.set('bestiary/fluff-mm.json', {
      monsterFluff: [
        {
          name: 'Copy',
          source: 'MM',
          entries: ['Own.'],
          _copy: { name: 'Gone', source: 'MM' },
        },
      ],
    })
    expect((await loadFluff('monsterFluff', 'Copy', 'MM'))?.entries).toEqual(['Own.'])
  })
})

describe('the table a stat block names', () => {
  it('is a table of the books by its name, and the group of tables of that name', async () => {
    expect(
      targetOf({ type: 'statblock', tag: 'table', name: 'Loot', source: 'XX' }),
    ).toEqual({
      kind: 'table',
      name: 'Loot',
      source: 'XX',
    })
    files.set('generated/gendata-tables.json', {
      table: [{ type: 'table', name: 'Loot', source: 'XX', rows: [] }],
      tableGroup: [{ type: 'tableGroup', name: 'Hoards', source: 'XX', tables: [] }],
    })
    expect(await loadTable('loot', 'xx')).toMatchObject({ type: 'table', name: 'Loot' })
    expect(await loadTable('Hoards', undefined)).toMatchObject({ type: 'tableGroup' })
    expect(await loadTable('Loot', 'YY')).toBeUndefined()
  })

  it('is nothing when the file cannot be read', async () => {
    expect(await loadTable('Loot', 'XX')).toBeUndefined()
  })
})
