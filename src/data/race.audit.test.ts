// The races and subraces against the book data in `.local/data` (skipped without it): every
// subrace, a `_copy` one included, resolves onto the race it names, and every race rule of
// the hand-written tables names a race of the data and holds for each of its subraces,
// from whatever book the subrace comes.

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createCharacter } from '../character/model'
import { collectSources, heldBy } from '../derived/sources'
import { AC_RULES } from '../rules/acRules'
import { INITIATIVE_RULES, PASSIVE_EDGE_RULES, PASSIVE_RULES } from '../rules/combatRules'
import type { Holder } from '../rules/holder'
import { HP_RULES } from '../rules/hpSources'
import { RESOURCE_RULES } from '../rules/resources'
import { SAVE_RULES } from '../rules/saveRules'
import { SENSE_RULES } from '../rules/senseRules'
import {
  ARMOR_STRENGTH_EXEMPT,
  MOVE_RULES,
  RACE_MOVE_LIMITS,
  SPEED_RULES,
} from '../rules/speedRules'
import { dataDir } from '../test/dataAudit'
import { holdsRace, loadRaces, type PlayableRace, type RaceHolder } from './race'

vi.mock('./dataClient', async () => {
  const { readFileSync: read } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(read(`.local/data/${path}`, 'utf8'))),
  }
})

interface RawSubrace {
  name?: string
  source: string
  raceName?: string
  raceSource?: string
  _copy?: { raceName?: string; raceSource?: string }
}

/** Every race rule of the hand-written tables, by the table it is in. */
const RACE_RULES: [string, RaceHolder][] = [
  ...(
    [
      ['AC_RULES', AC_RULES],
      ['INITIATIVE_RULES', INITIATIVE_RULES],
      ['PASSIVE_RULES', PASSIVE_RULES],
      ['PASSIVE_EDGE_RULES', PASSIVE_EDGE_RULES],
      ['RESOURCE_RULES', RESOURCE_RULES],
      ['SAVE_RULES', SAVE_RULES],
      ['SENSE_RULES', SENSE_RULES],
      ['SPEED_RULES', SPEED_RULES],
      ['MOVE_RULES', MOVE_RULES],
      ['RACE_MOVE_LIMITS', RACE_MOVE_LIMITS],
      ['ARMOR_STRENGTH_EXEMPT', ARMOR_STRENGTH_EXEMPT],
    ] as const satisfies readonly (readonly [string, readonly { holder: Holder }[]])[]
  ).flatMap(([table, rows]) =>
    rows.flatMap((row): [string, RaceHolder][] =>
      'race' in row.holder ? [[table, row.holder.race]] : [],
    ),
  ),
  ...HP_RULES.flatMap((row): [string, RaceHolder][] =>
    'race' in row.match ? [['HP_RULES', row.match.race]] : [],
  ),
]

const name = (h: RaceHolder) =>
  `${h.baseName}${h.subraceName ? ` (${h.subraceName})` : ''}|${h.source}`

describe.skipIf(!dataDir)('races and subraces against the data', async () => {
  const races: PlayableRace[] = dataDir ? await loadRaces() : []
  const subraces: RawSubrace[] = dataDir
    ? ((
        JSON.parse(readFileSync(`${dataDir}/races.json`, 'utf8')) as {
          subrace?: RawSubrace[]
        }
      ).subrace ?? [])
    : []

  it('lists every subrace under the race it names, a copied one included', () => {
    const missing = subraces.flatMap((s) => {
      const raceName = s.raceName ?? s._copy?.raceName
      const raceSource = s.raceSource ?? s._copy?.raceSource
      const found = races.some(
        (r) =>
          r.baseName === raceName &&
          r.baseSource === raceSource &&
          r.source === s.source &&
          r.subraceName === s.name,
      )
      return found ? [] : [`${s.name ?? '-'}|${s.source} of ${raceName}|${raceSource}`]
    })
    expect(missing).toEqual([])
    expect(subraces.length).toBeGreaterThan(90)
    // The Amonkhet Human copies the PHB Variant Human, and names its race only there.
    expect(races.find((r) => r.subraceName === 'Amonkhet')).toMatchObject({
      baseName: 'Human',
      baseSource: 'PHB',
      source: 'PSA',
    })
  })

  it('gives each race one key', () => {
    const keys = races.map((r) => r.key)
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([])
  })

  it('names a race of the data in every race rule', () => {
    const unknown = RACE_RULES.filter(([, h]) => !races.some((r) => holdsRace(r, h))).map(
      ([table, h]) => `${table}: ${name(h)}`,
    )
    expect(unknown).toEqual([])
    expect(RACE_RULES.length).toBeGreaterThan(130)
  })

  it('holds a rule of a race for each of its subraces, from whatever book', () => {
    const missed: string[] = []
    let crossBook = 0
    for (const [table, h] of RACE_RULES) {
      for (const race of races) {
        const ofRule = h.subraceName
          ? race.baseName === h.baseName &&
            race.subraceName === h.subraceName &&
            race.source === h.source
          : race.baseName === h.baseName && race.baseSource === h.source
        if (!ofRule) continue
        if (race.source !== race.baseSource) crossBook += 1
        const character = {
          ...createCharacter('Audit'),
          race: {
            name: race.name,
            baseName: race.baseName,
            baseSource: race.baseSource,
            source: race.source,
            subraceName: race.subraceName,
            abilityFixed: {},
            abilityChoices: {},
          },
        }
        const sources = collectSources(character, { classByKey: new Map(), race })
        if (!heldBy(sources, { race: h }))
          missed.push(`${table}: ${race.name}|${race.source}`)
      }
    }
    expect(missed).toEqual([])
    // The EGW Draconblood and Ravenite take the Breath Weapon of the PHB Dragonborn.
    expect(crossBook).toBeGreaterThan(20)
  })
})
