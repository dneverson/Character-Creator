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

interface RawVersion {
  name?: string
  _abstract?: unknown
  [field: string]: unknown
}

interface RawRace {
  name: string
  source: string
  raceName?: string
  _versions?: RawVersion[]
}

interface RawFile {
  race: RawRace[]
  subrace?: RawRace[]
}

/**
 * The fields of a version that are not a number or grant of the race: its name and book,
 * its text (`_mod`, shown as the option's text), the data's own search tags, and which of
 * its grants replace the race's (applied as the version's fields themselves).
 */
const NOT_APPLIED = ['name', 'source', '_mod', 'traitTags', 'overwrite']

/** A spell block of the data with its first-level keys in one order, to compare. */
const sorted = (value: unknown): unknown => {
  const block: unknown = Array.isArray(value) ? value[0] : value
  return block && typeof block === 'object'
    ? Object.fromEntries(Object.entries(block).sort(([a], [b]) => a.localeCompare(b)))
    : block
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

  const rawFile: RawFile = dataDir
    ? (JSON.parse(readFileSync(`${dataDir}/races.json`, 'utf8')) as RawFile)
    : { race: [] }

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

  it('offers the options of a trait to choose, each giving what it says', () => {
    const choosing = races.filter((r) => r.traitChoice)
    const lineage = races.find((r) => r.name === 'Custom Lineage')
    expect(lineage?.traitChoice?.title).toBe('Variable Trait')
    const options = lineage?.traitChoice?.options ?? []
    expect(options.map((o) => o.name)).toEqual(['Darkvision', 'Skill Proficiency'])
    // Neither before one is taken: no darkvision, no skill.
    expect(lineage?.darkvision).toBeUndefined()
    expect(lineage?.skillProficiencies ?? []).toEqual([])
    expect(options[0].race.darkvision).toBe(60)
    expect(options[0].race.skillProficiencies ?? []).toEqual([])
    expect(options[1].race.darkvision).toBeUndefined()
    expect(options[1].race.skillProficiencies?.length).toBe(1)
    const kobold = races.find((r) => r.name === 'Kobold' && r.source === 'MPMM')
    expect(kobold?.traitChoice?.options.length).toBe(3)
    expect(kobold?.skillProficiencies ?? []).toEqual([])
    expect(choosing.every((r) => (r.traitChoice?.options.length ?? 0) >= 2)).toBe(true)
    expect(choosing.map((r) => `${r.name}|${r.source}`)).toMatchInlineSnapshot(`
      [
        "Aasimar|MPMM",
        "Custom Lineage|TCE",
        "Draenei|WoW",
        "Elf|LFL",
        "Elf|WoW",
        "Elf|XPHB",
        "Faerie|LFL",
        "Gnome|XPHB",
        "Goliath|XPHB",
        "Half-Elf (Variant; Aquatic Elf Descent)|SCAG",
        "Half-Elf (Variant; Drow Descent)|SCAG",
        "Half-Elf (Variant; Moon Elf or Sun Elf Descent)|SCAG",
        "Half-Elf (Variant; Wood Elf Descent)|SCAG",
        "Kithkin|LFL",
        "Kobold|MPMM",
        "Shifter|EFA",
        "Shifter|MPMM",
        "Tauren|WoW",
        "Tiefling|XPHB",
        "Troll|WoW",
      ]
    `)
  })

  it('applies every field a version of a race sets to the option of it', () => {
    const owners = [...rawFile.race, ...(rawFile.subrace ?? [])].filter(
      (r) => (r._versions?.length ?? 0) > 1 && !r._versions?.some((v) => v._abstract),
    )
    const wrong: string[] = []
    let checked = 0
    for (const owner of owners) {
      const playable = races.filter((r) =>
        owner.raceName
          ? r.baseName === owner.raceName &&
            r.subraceName === owner.name &&
            r.source === owner.source
          : r.baseName === owner.name && r.baseSource === owner.source && !r.subraceName,
      )
      for (const race of playable)
        for (const version of owner._versions ?? []) {
          const optionName = (version.name ?? '').replace(`${owner.name}; `, '')
          const option = race.traitChoice?.options.find((o) => o.name === optionName)
          const where = `${race.name}|${race.source}: ${optionName}`
          if (!option) {
            wrong.push(`${where}: no option`)
            continue
          }
          for (const [field, value] of Object.entries(version)) {
            if (NOT_APPLIED.includes(field)) continue
            checked += 1
            const got: unknown = Reflect.get(option.race, field)
            if (field === 'additionalSpells' && value !== null) {
              // The option takes the race's set of spells named for it.
              const set = (Array.isArray(got) ? got : []).find(
                (b: { name?: string }) => b.name === option.race.spellSet,
              ) as Record<string, unknown> | undefined
              const { name: _name, ...spells } = set ?? {}
              void _name
              if (
                !set ||
                JSON.stringify(sorted(spells)) !== JSON.stringify(sorted(value))
              )
                wrong.push(`${where}: ${field}`)
            } else if (value === null) {
              if (got !== undefined && !(Array.isArray(got) && got.length === 0))
                wrong.push(`${where}: ${field} not cleared`)
            } else if (JSON.stringify(got) !== JSON.stringify(value))
              wrong.push(`${where}: ${field}`)
          }
        }
    }
    expect(wrong).toEqual([])
    expect(checked).toBeGreaterThan(55)
  })
})
