import { describe, expect, it, vi } from 'vitest'
import { loadCrochet, patternEntries, type CrochetPattern } from './crochet'

vi.mock('../data/dataClient', () => ({
  fetchData: async (path: string): Promise<unknown> => {
    if (path !== 'homecrafts.json') throw new Error('Failed to load data: HTTP 404')
    return {
      crochetPattern: [
        { name: 'Hat', source: 'CaBoMP', level: 'B', hooks: [4], yarn: ['Red.'] },
      ],
    }
  },
}))

const full: CrochetPattern = {
  name: 'Pillow',
  source: 'CaBoMP',
  designers: ['A. Maker', 'B. Maker'],
  level: 'I',
  patternType: 'household item',
  size: [
    { name: 'Large', height: { entry: '20 in.' }, width: { entry: '20 in.' } },
    { name: 'Small', height: { entry: '10 in.' } },
  ],
  hooks: [{ name: 'Large', hooks: [6] }, 3.5],
  yarn: ['Worsted.'],
  instructions: [{ type: 'entries', name: 'Front', entries: ['Row 1'] }],
  seeAlsoItem: ['bag of holding|xdmg'],
  seeAlsoCreature: ['beholder|xmm'],
}

const names = (entries: ReturnType<typeof patternEntries>) =>
  entries.flatMap((e) =>
    typeof e === 'object' && e.type === 'entries' ? [String(e.name)] : [],
  )

describe('a crochet pattern', () => {
  it('opens with its facts, in words', () => {
    const [facts] = patternEntries(full)
    expect(facts).toMatchObject({ type: 'list', style: 'list-hang-notitle' })
    const items = (facts as { items: { name: string; entries: string[] }[] }).items
    expect(items.map((i) => [i.name, i.entries[0]])).toEqual([
      ['Designed by:', 'A. Maker, B. Maker'],
      ['Level:', 'Intermediate'],
      ['Type:', 'Household item'],
      ['Size:', 'Large, Height 20 in., Width 20 in.; Small, Height 10 in.'],
    ])
  })

  it('has a heading for each part it has, in the order the book prints them', () => {
    expect(names(patternEntries(full))).toEqual([
      'Yarn',
      'Hook',
      'Instructions',
      'See also',
    ])
  })

  it('gives the hooks in millimeters, by part when it has parts', () => {
    expect(patternEntries(full)[2]).toMatchObject({
      name: 'Hook',
      entries: ['Large: 6 mm', '3.5 mm'],
    })
  })

  it('links what to see also', () => {
    const also = patternEntries(full).at(-1)
    expect(also).toMatchObject({
      entries: ['{@item bag of holding|xdmg}, {@creature beholder|xmm}'],
    })
  })

  it('is read by name and book, whatever the case', async () => {
    expect(await loadCrochet('hat', 'cabomp')).toBeDefined()
    expect(await loadCrochet('Hat', 'MM')).toBeUndefined()
    expect(await loadCrochet('Nothing', undefined)).toBeUndefined()
  })
})
