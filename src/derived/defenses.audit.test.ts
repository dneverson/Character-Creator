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

  it('make a dragonborn ancestry the pick of a dragon, each resisting its damage type', async () => {
    const wanted: Record<string, Record<string, string>> = {
      PHB: {
        Black: 'acid',
        Blue: 'lightning',
        Gold: 'fire',
        Green: 'poison',
        White: 'cold',
      },
      XPHB: {
        Brass: 'fire',
        Bronze: 'lightning',
        Copper: 'acid',
        Red: 'fire',
        Silver: 'cold',
      },
    }
    for (const [source, dragons] of Object.entries(wanted)) {
      const dragonborn = await find('Dragonborn', source)
      expect(dragonborn.traitChoice?.title).toBe('Draconic Ancestry')
      expect(dragonborn.traitChoice?.options).toHaveLength(10)
      // No resistance before a dragon is chosen, and no pick of bare damage types.
      expect(keys(dragonborn)).toEqual([])
      expect(sheetOf(dragonborn).picks.some((p) => p.kinds.includes('resist'))).toBe(
        false,
      )
      for (const [dragon, type] of Object.entries(dragons)) {
        const option = dragonborn.traitChoice?.options.find((o) => o.name === dragon)
        expect(option && keys(option.race)).toEqual([`resist|${type}`])
        expect(option?.facts?.[0]).toEqual({
          label: 'Damage type',
          value: type.charAt(0).toUpperCase() + type.slice(1),
        })
        expect(option?.facts?.[1].label).toBe('Breath weapon')
        expect(option?.facts?.[1].value).toMatch(/(cone|line), \w+ save$/)
      }
    }
  })

  it('keep an old dragonborn save resisting its type until the dragon is chosen', async () => {
    const dragonborn = await find('Dragonborn', 'XPHB')
    const old = { resist: { fire: 'race' } }
    // The old pick of a type three dragons share still resists it, once.
    const defenses = sheetOf(dragonborn, old).defenses
    expect(defenses.map((d) => d.key)).toEqual(['resist|fire'])
    expect(defenses[0].held.lines).toHaveLength(1)
    const red = dragonborn.traitChoice?.options.find((o) => o.name === 'Red')
    const taken = sheetOf(red?.race ?? dragonborn, old).defenses
    expect(taken.map((d) => d.key)).toEqual(['resist|fire'])
    expect(taken[0].held.lines).toHaveLength(1)
  })

  it('give the 2014 dragons their own breath weapon shape and saving throw', async () => {
    const options = (await find('Dragonborn', 'PHB')).traitChoice?.options ?? []
    const breath = (name: string) =>
      options.find((o) => o.name === name)?.facts?.[1].value
    expect(breath('Black')).toBe('5-foot-wide, 30-foot-long line, Dexterity save')
    expect(breath('Green')).toBe('15-foot cone, Constitution save')
  })

  it('make the dragon of every dragonborn book a pick, the metallic and gem ones too', async () => {
    for (const [name, count] of [
      ['Dragonborn (Chromatic)', 5],
      ['Dragonborn (Metallic)', 5],
      ['Dragonborn (Gem)', 5],
    ] as const) {
      const options = (await find(name, 'FTD')).traitChoice?.options ?? []
      expect(options).toHaveLength(count)
      expect(options.every((o) => o.race.resist?.length === 1)).toBe(true)
    }
  })

  it('give a dragonborn of Eberron no resistance of the base species', async () => {
    expect(keys(await find('Dragonborn (Draconblood)', 'EGW'))).toEqual([])
  })
})
