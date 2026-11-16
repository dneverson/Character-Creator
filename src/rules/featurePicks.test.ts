import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  dataDir,
  records,
  recordId,
  textOf as plainText,
  type Rec,
} from '../test/dataAudit'
import {
  ENEMY_TYPES,
  FEATURE_PICKS,
  HUMANOID_RACES,
  OPTION_CHOICES_IN_PLAY,
  HUMANOID_TAGS_NOT_RACES,
  TERRAINS,
} from './featurePicks'
import { holderId } from './holder'

describe('the feature picks table', () => {
  it('gives every pick a title, and every option a key, of its own', () => {
    const titles = FEATURE_PICKS.map((p) => p.title)
    expect(new Set(titles).size).toBe(titles.length)
    for (const pick of FEATURE_PICKS) {
      const keys = pick.options.map((o) => o.key)
      expect(new Set(keys).size).toBe(keys.length)
      // A list is written out or read from where `from` points, never both or neither.
      expect([pick.title, keys.length > 0]).toEqual([pick.title, !pick.from])
    }
    expect(new Set(HUMANOID_RACES).size).toBe(HUMANOID_RACES.length)
    expect(HUMANOID_RACES.filter((r) => r in HUMANOID_TAGS_NOT_RACES)).toEqual([])
  })
})

describe.skipIf(!dataDir)('feature picks against the data', () => {
  const dir = dataDir ?? ''
  // A record of the same address without text (Foundry's) is not the book's.
  const all = records(dir).filter(({ record }) => record.entries)
  const byId = new Map(
    all.map(({ collection, record }) => [recordId(collection, record), record]),
  )
  const textOf = (id: string) => JSON.stringify(byId.get(id)?.entries ?? '')

  it('has every feature of the table in the data', () => {
    const ids = FEATURE_PICKS.flatMap((p) => p.holders.map(holderId))
    expect(ids.filter((id) => !byId.has(id))).toEqual([])
  })

  it('offers exactly the creature types the Favored Enemy text lists, humanoids as a pair', () => {
    const text = textOf('classFeature|Favored Enemy|PHB|Ranger')
    const types = [...text.matchAll(/\|bestiary\|type=(\w+)\}/g)].map((m) => m[1])
    expect(types.filter((t) => t !== 'humanoid')).toEqual([...ENEMY_TYPES])
    expect(text).toContain('two races of {@filter humanoid')
  })

  it('offers exactly the terrains the Natural Explorer text lists', () => {
    const text = textOf('classFeature|Natural Explorer|PHB|Ranger')
    const list = /Choose one type of favored terrain: ([^.]+)\./.exec(text)?.[1] ?? ''
    const named = list
      .replace(/\bor (the )?/, '')
      .split(',')
      .map((t) => t.trim())
    expect(named).toEqual([...TERRAINS])
  })

  it('offers every humanoid race the creatures of the books are tagged with', () => {
    const tags = new Set<string>()
    const bestiary = `${dir}/bestiary`
    for (const file of readdirSync(bestiary).filter((f) => f.startsWith('bestiary-'))) {
      const json = JSON.parse(readFileSync(`${bestiary}/${file}`, 'utf8')) as {
        monster?: Rec[]
      }
      for (const m of json.monster ?? []) {
        const type = m.type as { type?: unknown; tags?: unknown[] } | undefined
        if (type?.type !== 'humanoid') continue
        for (const t of type.tags ?? []) {
          tags.add(typeof t === 'string' ? t : String((t as { tag?: unknown }).tag))
        }
      }
    }
    const races: readonly string[] = HUMANOID_RACES
    const unknown = [...tags].filter(
      (t) => !races.includes(t) && !(t in HUMANOID_TAGS_NOT_RACES),
    )
    expect(unknown).toEqual([])
    // A race or an excuse that no creature is tagged with any more is stale.
    const known = [...races, ...Object.keys(HUMANOID_TAGS_NOT_RACES)]
    expect(known.filter((t) => !tags.has(t))).toEqual([])
  })

  it('reads the kensei weapons and how many from the text', () => {
    const text = textOf('subclassFeature|Path of the Kensei|XGE|Monk|Kensei')
    expect(text).toContain('Choose two types of weapons')
    expect(text).toContain('lacks the heavy and special properties')
    expect(text).toContain('The longbow is also a valid choice')
    expect(text).toContain('When you reach 6th, 11th, and 17th level')
    const kensei = FEATURE_PICKS.find((p) => p.title === 'Kensei Weapons')
    expect(kensei?.byLevel).toEqual({ 3: 2, 6: 3, 11: 4, 17: 5 })
    expect(kensei?.from).toEqual({
      kind: 'weapons',
      without: ['H', 'S'],
      also: ['longbow'],
    })
  })

  // A field the option's data carries that is read as its choice: the spells, options,
  // feats and skills it gives.
  const READ_FIELDS = [
    'additionalSpells',
    'optionalfeatureProgression',
    'featProgression',
    'skillProficiencies',
  ]

  // Text that asks the player to choose.
  const ASKS = /\bchoose\b|of your choice/i

  it('has a row, a field that is read, or an excuse for every option that asks a choice', () => {
    const asks = all.filter(
      ({ collection, record }) =>
        collection === 'optionalfeature' && ASKS.test(plainText(record)),
    )
    const rows = new Set(
      FEATURE_PICKS.flatMap((p) =>
        p.holders.flatMap((h) => ('option' in h ? [h.option] : [])),
      ),
    )
    const tally = { row: 0, excused: 0, data: 0 }
    const missing: string[] = []
    for (const { record } of asks) {
      const key = `${String(record.name)}|${String(record.source)}`
      if (key in OPTION_CHOICES_IN_PLAY) tally.excused++
      else if (rows.has(key)) tally.row++
      else if (READ_FIELDS.some((f) => f in record)) tally.data++
      else missing.push(key)
    }
    expect(missing).toEqual([])
    // 37 options: 4 by a row, 7 by their data, 26 excused as choices made in play.
    expect(tally).toEqual({ row: 4, excused: 26, data: 7 })
    const asked = new Set(
      asks.map(({ record }) => `${String(record.name)}|${String(record.source)}`),
    )
    const stale = [...rows, ...Object.keys(OPTION_CHOICES_IN_PLAY)].filter(
      (k) => !asked.has(k),
    )
    expect(stale).toEqual([])
  })
})
