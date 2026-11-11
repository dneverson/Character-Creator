import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createCharacter, type Character, type RaceRef } from '../character/model'
import { stripTags } from '../text/tags'
import { featHpRule, HP_RULES, hpSources } from './hpSources'

function race(baseName: string, source: string, subraceName?: string): RaceRef {
  return {
    name: subraceName ? `${baseName} (${subraceName})` : baseName,
    baseName,
    source,
    subraceName,
    abilityFixed: {},
    abilityChoices: {},
  }
}

function sorcerer(level: number, sub: 'phb' | 'xphb', classSource = 'PHB'): Character {
  const c = createCharacter('Test')
  c.classes = [
    {
      name: 'Sorcerer',
      source: classSource,
      level,
      subclass:
        sub === 'phb'
          ? { name: 'Draconic Bloodline', shortName: 'Draconic', source: 'PHB' }
          : { name: 'Draconic Sorcery', shortName: 'Draconic', source: 'XPHB' },
    },
  ]
  return c
}

const totals = (c: Character, feats: string[] = []) =>
  hpSources(c, feats).map((l) => [l.label, l.total])

describe('hpSources', () => {
  it('applies the feat rules once each', () => {
    const c = createCharacter('Test')
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 4 }]
    expect(totals(c, ['tough|phb', 'tough|phb'])).toEqual([['Tough', 8]])
    expect(totals(c, ['tough|xphb', 'boon of fortitude|xphb'])).toEqual([
      ['Tough', 8],
      ['Boon of Fortitude', 40],
    ])
    expect(totals(c, ['alert|xphb'])).toEqual([])
  })

  it('gives every dwarf variant and the Stensia human their per-level bonus', () => {
    const c = createCharacter('Test')
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
    c.race = race('Dwarf', 'PHB', 'Hill')
    expect(totals(c)).toEqual([['Dwarven Toughness', 3]])
    c.race = race('Dwarf', 'PHB', 'Mountain')
    expect(totals(c)).toEqual([])
    c.race = race('Dwarf', 'XPHB')
    expect(totals(c)).toEqual([['Dwarven Toughness', 3]])
    c.race = race('Dwarf (Kaladesh)', 'PSK')
    expect(totals(c)).toEqual([['Dwarven Toughness', 3]])
    c.race = race('Human (Innistrad)', 'PSI', 'Stensia')
    expect(totals(c)).toEqual([['Tough', 6]])
  })

  it('counts Draconic Resilience by sorcerer level, from where each edition grants it', () => {
    expect(totals(sorcerer(5, 'phb'))).toEqual([['Draconic Resilience', 5]])
    expect(totals(sorcerer(1, 'phb'))).toEqual([['Draconic Resilience', 1]])
    expect(totals(sorcerer(2, 'xphb', 'XPHB'))).toEqual([])
    // Level 3 gives 3, then 1 per level: it equals the sorcerer level.
    expect(totals(sorcerer(3, 'xphb', 'XPHB'))).toEqual([['Draconic Resilience', 3]])
    expect(totals(sorcerer(7, 'xphb', 'XPHB'))).toEqual([['Draconic Resilience', 7]])
    // A 2014 subclass on a 2024 Sorcerer arrives at 3 with the rest of the subclass.
    expect(totals(sorcerer(2, 'phb', 'XPHB'))).toEqual([])
    expect(totals(sorcerer(4, 'phb', 'XPHB'))).toEqual([['Draconic Resilience', 4]])
  })

  it('uses the class level, not the character level, in a multiclass', () => {
    const c = sorcerer(2, 'phb')
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }, ...c.classes]
    const [line] = hpSources(c, [])
    expect(line).toMatchObject({
      per: 'class',
      levels: 2,
      total: 2,
      source: 'Sorcerer, Draconic Bloodline',
    })
  })

  it('gives the Order of the Immortal mystic 1 per mystic level', () => {
    const c = createCharacter('Test')
    c.classes = [
      {
        name: 'Mystic',
        source: 'UATheMysticClass',
        level: 4,
        subclass: {
          name: 'Order of the Immortal',
          shortName: 'Immortal',
          source: 'UATheMysticClass',
        },
      },
    ]
    expect(totals(c)).toEqual([['Immortal Durability', 4]])
  })

  it('stacks sources from different origins', () => {
    const c = sorcerer(5, 'phb')
    c.race = race('Dwarf', 'PHB', 'Hill')
    expect(totals(c, ['tough|phb']).map(([, t]) => t)).toEqual([10, 5, 5])
  })

  it('finds a feat rule by key', () => {
    expect(featHpRule('tough|phb')?.perLevel).toBe(2)
    expect(featHpRule('alert|xphb')).toBeUndefined()
  })
})

// Hit point maximum increases found in the data that are not the character's own
// permanent maximum, by data identity (collection|name|source).
const NOT_THE_CHARACTERS_OWN_MAXIMUM: Record<string, string> = {
  'classFeature|Pet Specialization|WoW': 'The ranger pet',
  'subclassFeature|Undead Thralls|PHB': 'The thralls the wizard raises',
  "item|Tloques' Berserker Battleaxe|TftYP": 'A temporary item effect',
  'magicvariant|Armor of Safeguarding|': 'A temporary item effect',
  'magicvariant|Berserker Axe|': 'A temporary item effect while wielded',
  'reward|Boon of Fortitude|DMG': 'A DM reward, not a feat the character takes',
  'spell|Aid|XPHB': 'A spell, temporary',
  "spell|Heroes' Feast|XPHB": 'A spell, temporary',
  'spell|Vampiric Blood|WoW': 'A spell, temporary',
  'variantrule|Sidekicks|TCE': 'The sidekick rules',
  'variantrule|Survivors|VRGR': 'The survivor rules',
}

const dataDir = existsSync('.local/data/races.json') ? '.local/data' : undefined
const SKIPPED = /fluff|bestiary|generated|adventure|\/book\//
const INCREASE =
  /hit points? maximum (increases|is increased|increase)|increases? your hit point/i

function jsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`
    if (e.isDirectory()) return jsonFiles(path)
    return e.name.endsWith('.json') && !SKIPPED.test(path) ? [path] : []
  })
}

function foundInData(dir: string): Set<string> {
  const found = new Set<string>()
  for (const file of jsonFiles(dir)) {
    const json: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (!json || typeof json !== 'object' || Array.isArray(json)) continue
    for (const [collection, records] of Object.entries(json)) {
      if (!Array.isArray(records)) continue
      for (const r of records as Record<string, unknown>[]) {
        if (!r || typeof r !== 'object') continue
        if (INCREASE.test(stripTags(JSON.stringify(r.entries ?? r)))) {
          found.add(`${collection}|${String(r.name)}|${String(r.source ?? '')}`)
        }
      }
    }
  }
  return found
}

describe.skipIf(!dataDir)('hit point rules against the data', () => {
  const found = dataDir ? foundInData(dataDir) : new Set<string>()
  const ruleIds = new Set(HP_RULES.map((r) => r.id))

  it('applies or explains every hit point maximum increase in the books', () => {
    const unknown = [...found].filter(
      (id) => !ruleIds.has(id) && !(id in NOT_THE_CHARACTERS_OWN_MAXIMUM),
    )
    // A new book added a rule: put it in HP_RULES, or in the allowlist with its reason.
    expect(unknown).toEqual([])
  })

  it('has every rule in the table present in the data', () => {
    const missing = [...ruleIds].filter((id) => !found.has(id))
    expect(missing).toEqual([])
  })
})
