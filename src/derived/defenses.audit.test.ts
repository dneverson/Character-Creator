// The defenses of the real species against the book data in `.local/data` (skipped without
// it): the data's lists reach the sheet, and a type the data lets the player choose is a
// pick, for the species with versions (a tiefling's legacy, a dragonborn's ancestry) too.

import { describe, expect, it, vi } from 'vitest'
import { deriveSheet } from '.'
import { dataDir } from '../test/dataAudit'
import { build, deps, FIGHTER } from '../test/derivedFixtures'
import { loadRaces, type PlayableRace } from '../data/race'

vi.mock('../data/dataClient', async () => {
  const { readFileSync: read } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(read(`.local/data/${path}`, 'utf8'))),
  }
})

const sheetOf = (
  race: PlayableRace,
  picks: Record<string, Record<string, string>> = {},
) => {
  const c = build('Fighter', 1, {}, [])
  c.grantPicks = picks
  return deriveSheet(c, { ...deps([FIGHTER]), race })
}

const keys = (race: PlayableRace) => sheetOf(race).defenses.map((d) => d.key)

describe.skipIf(!dataDir)('species defenses against the data', () => {
  const find = async (name: string, source: string) => {
    const found = (await loadRaces()).find((r) => r.name === name && r.source === source)
    if (!found) throw new Error(`No race ${name}|${source}`)
    return found
  }

  it('give a dwarf resistance to poison, from the data list', async () => {
    expect(keys(await find('Dwarf', 'XPHB'))).toEqual(['resist|poison'])
    expect(keys(await find('Dwarf (Hill)', 'PHB'))).toEqual(['resist|poison'])
  })

  it('give a tiefling of the 2014 book resistance to fire', async () => {
    const tiefling = await find('Tiefling', 'PHB')
    const row = sheetOf(tiefling).defenses[0]
    expect([row.key, row.held.value, row.held.lines[0].label]).toEqual([
      'resist|fire',
      1,
      'Tiefling',
    ])
  })

  it('give a 2024 tiefling the resistance of the legacy taken, and none before', async () => {
    const tiefling = await find('Tiefling', 'XPHB')
    expect(keys(tiefling)).toEqual([])
    const abyssal = tiefling.traitChoice?.options.find((o) =>
      o.name.startsWith('Abyssal'),
    )
    expect(abyssal && keys(abyssal.race)).toEqual(['resist|poison'])
  })

  it('make a dragonborn ancestry a pick of damage types', async () => {
    for (const source of ['PHB', 'XPHB']) {
      const dragonborn = await find('Dragonborn', source)
      const card = sheetOf(dragonborn).picks.find((p) => p.kinds.includes('resist'))
      expect(card?.chips.map((c) => c.value).sort()).toEqual([
        'acid',
        'cold',
        'fire',
        'lightning',
        'poison',
      ])
      const picked = sheetOf(dragonborn, { resist: { fire: card?.tag ?? '' } })
      expect(picked.defenses.map((d) => d.key)).toEqual(['resist|fire'])
    }
  })

  it('give a dragonborn of Eberron no resistance of the base species', async () => {
    expect(keys(await find('Dragonborn (Draconblood)', 'EGW'))).toEqual([])
  })
})
