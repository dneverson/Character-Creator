import { describe, expect, it } from 'vitest'
import type { Entry } from '../text/Entries'
import { inPrintOrder } from './printOrder'

const block = (name: string, page?: number): Entry => ({
  type: 'statblock',
  tag: 'spell',
  name,
  ...(page !== undefined && { page }),
})
const part = (name: string, entries: Entry[], page?: number): Entry => ({
  type: 'section',
  name,
  ...(page !== undefined && { page }),
  entries,
})
const names = (entries: Entry[]) =>
  entries.map((e) => (typeof e === 'object' ? String((e as { name?: string }).name) : e))
const kids = (chapter: Entry | undefined): Entry[] =>
  (chapter as { entries: Entry[] }).entries

describe('a list the data orders differently from print', () => {
  it('puts a block where its page belongs, keeping the order of equal pages', () => {
    const [chapter] = inPrintOrder([
      part('Spells', [
        block('Find Traps', 241),
        block('Fire Bolt', 242),
        block('Fire Shield', 242),
        block('Fire Storm', 242),
        block('Fireball', 241),
        block('Flame Blade', 242),
      ]),
    ])
    expect(names(kids(chapter))).toEqual([
      'Find Traps',
      'Fireball',
      'Fire Bolt',
      'Fire Shield',
      'Fire Storm',
      'Flame Blade',
    ])
  })

  it('puts whole sections in place, with the text that follows each', () => {
    const [chapter] = inPrintOrder([
      part('A-Z', [
        part('Dracolich', [block('Dracolich', 84)]),
        'Text after the Dracolich.',
        part('Dragon Turtle', [block('Dragon Turtle', 119)]),
        part('Dragon, Shadow', [block('Shadow', 85)]),
        part('Dragons', ['Prose first.', block('Black Dragon', 86)]),
        part('Drider', [block('Drider', 120)]),
      ]),
    ])
    expect(names(kids(chapter))).toEqual([
      'Dracolich',
      'Text after the Dracolich.',
      'Dragon, Shadow',
      'Dragons',
      'Dragon Turtle',
      'Drider',
    ])
  })

  it('leaves a list that is in order as it is', () => {
    const chapter = part('Spells', [block('A', 1), 'text', block('B', 2), block('C', 2)])
    const [done] = inPrintOrder([chapter])
    expect(done).toBe(chapter)
  })

  it('does not move the chapters, and lists with fewer than two pages stay', () => {
    const chapters = [part('One', [block('A', 5)], 5), part('Two', ['text'], 9)]
    expect(inPrintOrder(chapters)).toEqual(chapters)
  })
})

describe('a part printed elsewhere', () => {
  const appendix = part('Appendix', [block('Cave Bear', 334)], 330)

  it('keeps its place, marks no page and says where it is printed', () => {
    const [chapter] = inPrintOrder([
      part(
        'Monsters',
        [
          part('Carrion Crawler', [block('Carrion Crawler', 37)]),
          part('Cave Bear', [block('Cave Bear', 334)]),
          part('Centaur', [block('Centaur', 38)]),
        ],
        4,
      ),
      appendix,
    ])
    const [crawler, bear, centaur] = kids(chapter)
    expect(names(kids(chapter))).toEqual(['Carrion Crawler', 'Cave Bear', 'Centaur'])
    expect(bear).toEqual({
      type: 'section',
      name: 'Cave Bear',
      printedOn: 334,
      entries: [{ type: 'statblock', tag: 'spell', name: 'Cave Bear' }],
    })
    expect(crawler).toEqual(part('Carrion Crawler', [block('Carrion Crawler', 37)]))
    expect(centaur).toEqual(part('Centaur', [block('Centaur', 38)]))
  })

  it('leaves the appendix its own page', () => {
    const [, second] = inPrintOrder([part('Monsters', [block('Ape', 5)], 4), appendix])
    expect(second).toBe(appendix)
  })

  it('marks a block of a list that is out of its page span, though it is alone', () => {
    const [chapter] = inPrintOrder([
      part(
        'Wizard',
        [
          part(
            'Class Features',
            [part('Spellcasting', ['text', part('Spellbook', ['x'], 139)], 112)],
            112,
          ),
        ],
        112,
      ),
      part('Next chapter', ['text'], 121),
    ])
    const spellbook = JSON.stringify(chapter)
    expect(spellbook).toContain('"printedOn":139')
    expect(spellbook).not.toContain('"page":139')
  })

  it('marks the named parts of a group that has no name', () => {
    const group: Entry = {
      type: 'section',
      entries: [part('Cave Bear', [block('Cave Bear', 334)]), 'prose'],
    }
    const [chapter] = inPrintOrder([
      part('Monsters', [part('Ape', [block('Ape', 5)]), group], 4),
      appendix,
    ])
    const [, done] = kids(chapter)
    expect(JSON.stringify(done)).toContain('"printedOn":334')
    expect(JSON.stringify(done)).not.toContain('"page"')
    expect((done as { entries: Entry[] }).entries[1]).toBe('prose')
  })

  it('marks a chapter the book prints before its first one (the credits)', () => {
    const chapters = [
      part('Chapter 1', [block('A', 10)], 10),
      part('Chapter 2', [block('B', 40)], 40),
      part('Credits', ['text', block('C', 2)], 2),
    ]
    const done = inPrintOrder(chapters)
    expect(done[0]).toBe(chapters[0])
    expect(done[2]).toMatchObject({ name: 'Credits', printedOn: 2 })
    expect(JSON.stringify(done[2])).not.toContain('"page"')
  })

  it('takes the run of the list for the book, not the part the list opens with', () => {
    const [chapter] = inPrintOrder([
      part('Quaggoth', [
        block('Quaggoth', 256),
        part('Spore Servant Template', ['x'], 230),
        block('Thonot', 256),
        block('Elder', 256),
      ]),
    ])
    expect(names(kids(chapter))).toEqual([
      'Quaggoth',
      'Spore Servant Template',
      'Thonot',
      'Elder',
    ])
    expect(kids(chapter)[1]).toMatchObject({ printedOn: 230 })
  })

  it('leaves the pages of a part that is not an object alone', () => {
    const [chapter] = inPrintOrder([
      part('One', ['text', 5, block('A', 2), block('B', 4), block('C', 3)]),
    ])
    expect(names(kids(chapter))).toEqual(['text', 5, 'A', 'C', 'B'])
  })
})
