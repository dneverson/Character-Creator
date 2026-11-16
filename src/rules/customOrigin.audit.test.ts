// Customizing Your Origin against the book data in `.local/data` (skipped without it):
// every proficiency and language a race gives outright takes a row of the Proficiency
// Swaps table (a weapon by its category in the item catalog), and swapping all of them
// leaves the race giving none of them.

import { describe, expect, it, vi } from 'vitest'
import { loadItems } from '../data/items'
import { loadRaces } from '../data/race'
import { dataDir } from '../test/dataAudit'
import {
  canCustomizeOrigin,
  originValues,
  swapId,
  swapRowOf,
  withSwaps,
} from './customOrigin'

vi.mock('../data/dataClient', async () => {
  const { readFileSync: read } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(read(`.local/data/${path}`, 'utf8'))),
  }
})

/** Weapon words that are a category of their own, not a weapon of the catalog. */
const CATEGORY_WORDS = new Set(['simple', 'martial', 'firearms'])

describe.skipIf(!dataDir)('Customizing Your Origin against the data', async () => {
  const races = dataDir ? (await loadRaces()).filter(canCustomizeOrigin) : []
  const items = dataDir ? await loadItems() : []
  const category = new Map(
    items.flatMap((i) =>
      i.weapon?.category ? [[i.name.toLowerCase(), i.weapon.category] as const] : [],
    ),
  )

  it('reads a row of the table for every value a race gives outright', () => {
    const unknown: string[] = []
    let values = 0
    for (const race of races) {
      for (const value of originValues(race)) {
        values++
        swapRowOf(value, (n) => category.get(n))
        if (
          value.kind === 'weapon' &&
          !CATEGORY_WORDS.has(value.key) &&
          !category.has(value.key)
        )
          unknown.push(`${race.name}|${race.source}: ${value.key}`)
      }
    }
    expect(unknown).toEqual([])
    expect(values).toBeGreaterThan(100)
  })

  it('gives none of a value once it is swapped', () => {
    const left: string[] = []
    for (const race of races) {
      const swaps = originValues(race).map(swapId)
      if (swaps.length === 0) continue
      const swapped = withSwaps(race, {
        name: race.name,
        baseName: race.baseName,
        source: race.source,
        subraceName: race.subraceName,
        abilityFixed: {},
        abilityChoices: {},
        customOrigin: true,
        swaps,
      })
      const still = originValues(swapped).map(swapId)
      if (still.length > 0) left.push(`${race.name}|${race.source}: ${still.join(', ')}`)
      expect(swapped.originSwaps).toHaveLength(swaps.length)
    }
    expect(left).toEqual([])
  })
})
