// The counters of species traits against the playable races of the data in `.local/data`
// (skipped without it): a race holds the counter of a trait it still has, and a subrace
// that replaces the trait (`data.overwrite`) leaves the race without it.

import { describe, expect, it, vi } from 'vitest'
import { hasTrait, holdsRace, loadRaces } from '../data/race'
import { dataDir } from '../test/dataAudit'
import { RESOURCE_RULES } from './resources'

vi.mock('../data/dataClient', async () => {
  const { readFileSync: read } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(read(`.local/data/${path}`, 'utf8'))),
  }
})

describe.skipIf(!dataDir)('species counters against the playable races', async () => {
  const races = dataDir ? await loadRaces() : []
  const lacking = RESOURCE_RULES.flatMap((rule) => {
    const h = rule.holder
    if (!('race' in h) || !rule.feature) return []
    const feature = rule.feature
    return races
      .filter((r) => holdsRace(r, h.race) && !hasTrait(r, feature))
      .map((r) => `${r.key}: ${feature}`)
  })

  it('lacks a trait only where a subrace replaces it', () => {
    // Mark of Finding replaces the Half-Orc's Relentless Endurance with Finder's Magic.
    expect(lacking).toEqual([
      'Half-Orc|PHB|Variant; Mark of Finding|ERLW: Relentless Endurance',
    ])
  })
})
