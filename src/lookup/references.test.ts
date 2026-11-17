// How the resolver finds what a book names, with the races and feats it has no row of
// as such: a race that is only played as one of its subraces, a feat that is only taken
// in one of its versions, and a subrace spelled the way the Plane Shift books spell it.

import { describe, expect, it, vi } from 'vitest'
import { loadResolver, referenceOf } from './references'

vi.mock('../data/dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  const own: Record<string, unknown> = {
    'races.json': {
      race: [
        {
          name: 'Elf (Kaladesh)',
          source: 'PSK',
          size: ['M'],
          speed: 30,
          entries: [{ type: 'entries', name: 'Age', entries: ['Old.'] }],
        },
      ],
      subrace: [
        {
          name: 'Vahadar',
          source: 'PSK',
          raceName: 'Elf (Kaladesh)',
          raceSource: 'PSK',
          entries: [{ type: 'entries', name: 'Vahadar Magic', entries: ['Bright.'] }],
        },
      ],
    },
    'feats.json': {
      feat: [
        {
          name: 'Strike of the Giants',
          source: 'BGG',
          entries: ['Choose a strike.'],
          _versions: [{ name: 'Strike of the Giants; Cloud', source: 'BGG' }],
        },
      ],
    },
  }
  return {
    fetchData: async (path: string): Promise<unknown> => {
      if (path in own) return own[path]
      try {
        return JSON.parse(readFileSync(`public/data/${path}`, 'utf8'))
      } catch {
        throw new Error(`Failed to load data "${path}": HTTP 404`)
      }
    },
  }
})

const find = async (tag: string, content: string) => {
  const reference = referenceOf(tag, content)
  expect(reference).toBeDefined()
  return (await loadResolver()).find(reference!)
}

describe('the resolver', () => {
  it('finds a race that is played only as one of its subraces', async () => {
    const row = await find('race', 'Elf (Kaladesh)|PSK')
    expect(row?.name).toBe('Elf (Kaladesh)')
    expect(row?.source).toBe('PSK')
  })

  it('finds a subrace spelled with a semicolon, as the Plane Shift books name it', async () => {
    const row = await find('race', 'Elf (Kaladesh; Vahadar)|PSK')
    expect(row?.name).toBe('Elf (Kaladesh) (Vahadar)')
  })

  it('finds a feat that is only taken in one of its versions, and the versions', async () => {
    expect((await find('feat', 'Strike of the Giants|BGG'))?.name).toBe(
      'Strike of the Giants',
    )
    expect((await find('feat', 'Strike of the Giants; Cloud|BGG'))?.name).toBe(
      'Strike of the Giants (Cloud)',
    )
  })

  it('still finds nothing for a name no kind has', async () => {
    expect(await find('race', 'Elf (Nowhere)|PSK')).toBeUndefined()
  })
})
