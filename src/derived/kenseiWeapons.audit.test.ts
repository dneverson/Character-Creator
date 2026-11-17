// The weapons a kensei can pick, against the book data in `.local/data` (skipped without
// it): simple or martial weapons that lack the heavy and special properties, and the
// longbow; a firearm is none of them.

import { describe, expect, it, vi } from 'vitest'
import { loadItems } from '../data/items'
import { FEATURE_PICKS } from '../rules/featurePicks'
import { dataDir } from '../test/dataAudit'
import { weaponOptions } from './featurePicks'

vi.mock('../data/dataClient', async () => {
  const { readFileSync: read } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(read(`.local/data/${path}`, 'utf8'))),
  }
})

describe.skipIf(!dataDir)('kensei weapons against the data', () => {
  it('offer no firearm, no heavy or special weapon, and the longbow', async () => {
    const items = await loadItems()
    const from = FEATURE_PICKS.find((p) => p.title === 'Kensei Weapons')?.from
    if (from?.kind !== 'weapons') throw new Error('Kensei Weapons reads no weapons')
    const names = weaponOptions(from, items).map((o) => o.key)
    const firearms = items.filter((i) => i.firearm).map((i) => i.name.toLowerCase())
    expect(firearms.length).toBeGreaterThan(10)
    expect(names.filter((n) => firearms.includes(n))).toEqual([])
    expect(names).toContain('longbow')
    expect(names).toContain('longsword')
    expect(names).not.toContain('greatsword')
    expect(names).not.toContain('net')
    expect(names.length).toBeGreaterThan(20)
  })
})
