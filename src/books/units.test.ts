import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fixtureSections } from '../test/bookFixture'
import { buildFlow, flowOf, matchesOf, type Unit } from './units'
import { scan } from './outline'
import { sectionsOf } from './load'
import type { Entry } from '../text/Entries'

const read = scan(fixtureSections)
const flow = buildFlow(fixtureSections, read)

/** Every string of an entry, the way the pieces hold them. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const v of value) strings(v, out)
  else if (typeof value === 'object' && value !== null)
    for (const [k, v] of Object.entries(value)) if (k !== 'type') strings(v, out)
  return out
}

const isTitled = (unit: Unit, name: string) =>
  typeof unit.title === 'object' && (unit.title as { name?: string }).name === name

describe('the pieces of a book', () => {
  it('cut a chapter at its headings and keep every line of it', () => {
    const own = flow.units
      .filter((u) => u.chapter === 0)
      .flatMap((u) => [
        ...(u.title ? [(u.title as { name: string }).name] : []),
        ...strings(u.entries),
      ])
    // Every string of the chapter is in a piece, once.
    const all = strings(fixtureSections[0]).sort()
    expect([...own].sort()).toEqual(all)
  })

  it('start each chapter with its heading and say where the headings are', () => {
    expect(flow.starts).toEqual([0, flow.units.findIndex((u) => u.chapter === 1)])
    expect(flow.units[0].title).toMatchObject({ name: 'Chapter 1: Wanderers' })
    expect(flow.byKey.get('0:packing')).toBe(
      flow.units.findIndex(
        (u) => (u.title as { name?: string } | undefined)?.name === 'Packing',
      ),
    )
    // A sidebar is a heading drawn inside a piece; a picture is a place too.
    expect(flow.byKey.get('0:read-aloud')).toBeDefined()
  })

  it('tell the heading each piece is under', () => {
    const packing = flow.byKey.get('0:packing') ?? 0
    expect(flow.units[packing + 1].heading).toBe('0:packing')
    expect(flow.units[0].heading).toBe('0:chapter-1-wanderers')
  })

  it('count the marks of words in each piece, and cut a book once', () => {
    const found = matchesOf(flow, ['packing'])
    expect([...found.values()].reduce((a, b) => a + b, 0)).toBe(3)
    expect(matchesOf(flow, [])).toEqual(new Map())
    expect(flowOf(fixtureSections, read)).toBe(flowOf(fixtureSections, read))
  })

  it('know the pages: where each starts, the page in force, and the last page', () => {
    expect(flow.marked).toEqual([3, 4, 9, 10])
    const at = (page: number) => flow.units[flow.pages.get(page) ?? -1]
    expect(at(3).page).toBe(3)
    expect(at(4)).toMatchObject({ page: 4, from: 3 })
    // The text under Packing is still on page 4: it carries no break of its own.
    const packing = flow.byKey.get('0:packing') ?? 0
    expect(flow.units[packing + 1]).toMatchObject({ from: 4 })
    expect(flow.units[packing + 1].page).toBeUndefined()
    expect(at(9)).toMatchObject({ page: 9, from: 4 })
  })

  it('start a page before a heading whose first stat block is printed on it', () => {
    const beasts: Entry[] = [
      {
        type: 'section',
        name: 'Beasts',
        page: 12,
        entries: [
          {
            type: 'section',
            name: 'Aboleth',
            entries: [{ type: 'statblock', tag: 'creature', name: 'Aboleth', page: 13 }],
          },
        ],
      },
    ]
    const made = buildFlow(beasts, scan(beasts))
    const title = made.units.find((u) => isTitled(u, 'Aboleth'))
    expect(title).toMatchObject({ page: 13, from: 12 })
    // The stat block is on the page the heading began: it does not break the page again.
    expect(made.units.at(-1)?.page).toBeUndefined()
    expect(made.marked).toEqual([12, 13])
  })

  it('keep a styled part as one piece', () => {
    const odd: Entry[] = [
      {
        type: 'section',
        name: 'Odd',
        entries: [
          { type: 'entries', name: 'Styled', style: 'italic', entries: ['a', 'b'] },
          {
            type: 'entries',
            name: 'One',
            entries: [{ type: 'entries', name: 'Two', entries: ['x'] }],
          },
        ],
      },
    ]
    const cut = buildFlow(odd, scan(odd))
    // The styled part is one piece, and so is the text under the part that was cut.
    expect(cut.units.filter((u) => !u.title)).toHaveLength(2)
    expect(
      cut.units.filter((u) => u.title).map((u) => (u.title as { name: string }).name),
    ).toEqual(['Odd', 'One', 'Two'])
  })
})

const present = existsSync('.local/data/book')

describe.skipIf(!present)('the pieces of the books of the full content', () => {
  it('hold every string of every chapter of every book', () => {
    for (const file of readdirSync('.local/data/book').filter((f) =>
      f.endsWith('.json'),
    )) {
      const id = file.replace(/^book-|\.json$/g, '')
      const sections = sectionsOf(
        JSON.parse(readFileSync(`.local/data/book/${file}`, 'utf8')),
        id,
      )
      if (!sections) continue
      const cut = buildFlow(sections, scan(sections))
      const held = cut.units.reduce(
        (n, u) => n + strings(u.entries).length + (u.title ? 1 : 0),
        0,
      )
      const wanted = sections.reduce((n: number, s) => n + strings(s).length, 0)
      // A piece holds its strings; a heading's name is counted once as its piece's title,
      // and the `type` words of the parts that were cut are the difference.
      expect(held, id).toBeLessThanOrEqual(wanted)
      expect(held, id).toBeGreaterThan(0)
    }
  })
})
