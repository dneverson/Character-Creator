import { describe, expect, it } from 'vitest'
import { readGrant } from '../data/grants'
import { dataDir, records, recordId } from '../test/dataAudit'
import { GRANT_FIELDS } from './grantBlocks'

const KIND = {
  languageProficiencies: 'language',
  toolProficiencies: 'tool',
  weaponProficiencies: 'weapon',
  armorProficiencies: 'armor',
  skillProficiencies: 'skill',
  skillToolLanguageProficiencies: 'mixed',
  expertise: 'expertise',
  savingThrowProficiencies: 'save',
} as const

describe('readGrant', () => {
  it('reads what is given and what is chosen, per alternative', () => {
    const read = readGrant(
      [
        { common: true, anyStandard: 2 },
        { elvish: true },
        { optional: true, firearms: true },
      ],
      'language',
    )
    expect(read.alternatives).toHaveLength(2)
    expect(read.alternatives[0].fixed).toEqual([{ kind: 'language', key: 'common' }])
    expect(read.alternatives[0].picks).toMatchObject([
      {
        count: 2,
        kinds: ['language'],
        any: ['anyStandard'],
        text: '2 standard languages of your choice',
      },
    ])
    expect(read.optional).toHaveLength(1)
    expect(read.unknown).toEqual([])
  })

  it('reads a choice between kinds as one pick', () => {
    const [alt] = readGrant(
      [{ choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] }],
      'mixed',
    ).alternatives
    expect(alt.picks[0]).toMatchObject({ count: 3, kinds: ['skill', 'tool'] })
  })

  it('reads the words of an older class list as one alternative', () => {
    const read = readGrant(
      [
        'simple',
        '{@item rapier|phb|rapiers}',
        { proficiency: 'firearms', optional: true },
      ],
      'weapon',
    )
    expect(read.alternatives).toHaveLength(1)
    expect(read.alternatives[0].fixed.map((v) => v.key)).toEqual(['simple', 'rapier'])
    expect(read.optional).toHaveLength(1)
  })

  it('reports a key it does not know', () => {
    expect(readGrant([{ trebuchet: true }], 'weapon').unknown).toEqual(['trebuchet'])
    expect(readGrant([{ heavyish: true }], 'armor').unknown).toEqual(['heavyish'])
  })
})

describe.skipIf(!dataDir)('grant blocks against the data', () => {
  it('reads every proficiency block of every class, species, background and feat', () => {
    const unknown: string[] = []
    for (const { collection, record } of records(dataDir ?? '')) {
      if (!['class', 'race', 'subrace', 'background', 'feat'].includes(collection))
        continue
      const multi = (
        record.multiclassing as
          { proficienciesGained?: Record<string, unknown> } | undefined
      )?.proficienciesGained
      const start = record.startingProficiencies as Record<string, unknown> | undefined
      for (const holder of [record, start, multi]) {
        if (!holder) continue
        for (const field of Object.keys(KIND) as (keyof typeof KIND)[]) {
          const blocks = holder[field]
          if (!Array.isArray(blocks)) continue
          for (const key of readGrant(blocks, KIND[field]).unknown)
            unknown.push(`${recordId(collection, record)} ${field} ${key}`)
        }
        if (Array.isArray(holder.armor))
          unknown.push(
            ...readGrant(holder.armor, 'armor').unknown.map(
              (k) => `${recordId(collection, record)} armor ${k}`,
            ),
          )
        if (Array.isArray(holder.weapons))
          unknown.push(
            ...readGrant(holder.weapons, 'weapon').unknown.map(
              (k) => `${recordId(collection, record)} weapons ${k}`,
            ),
          )
      }
      if (collection === 'class' && Array.isArray(record.proficiency))
        unknown.push(
          ...readGrant(record.proficiency, 'save').unknown.map(
            (k) => `${recordId(collection, record)} save ${k}`,
          ),
        )
    }
    expect(unknown).toEqual([])
  })

  it('lists every field the sheet reads', () => {
    expect([...GRANT_FIELDS].sort()).toEqual(
      Object.keys(KIND)
        .filter((k) => k !== 'skillProficiencies')
        .sort(),
    )
  })
})
