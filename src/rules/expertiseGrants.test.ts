import { describe, expect, it } from 'vitest'
import { dataDir, findIds, records, recordId, type Rec } from '../test/dataAudit'
import { EXPERTISE_GRANTS } from './expertiseGrants'
import { FEATURE_GRANTS } from './featureGrants'
import { holderId } from './holder'

/** A feature that counts the proficiency bonus twice, in text. */
const GRANTS_EXPERTISE =
  /expertise|proficiency bonus is doubled|double your proficiency|doubled for any/i

/**
 * What the books say about expertise that the sheet does not give as a pick of skills,
 * with the reason. A new book's grant fails the audit until it is in EXPERTISE_GRANTS
 * or here.
 */
export const EXPERTISE_NOT_GRANTED: Record<string, string> = {
  'background|Entertainer|PHB': 'a use of a performance, not expertise in a skill',
  'classFeature|Bardic Versatility|TCE|Bard':
    'an option to swap a pick for another, which the sheet does by changing the pick',
  'classFeature|Deft Explorer|TCE|Ranger':
    'an optional class feature of another book, not applied to the Ranger of the 2014 book',
  'classFeature|Expertise|TCE|Expert Sidekick': 'a sidekick, not a character of its own',
  'classFeature|Natural Explorer|PHB|Ranger':
    'doubles the bonus for the checks of a favored terrain, not for a skill',
  'classFeature|Tool Expertise|TCE|Artificer':
    'doubles the bonus for every tool proficiency; the sheet shows no tool checks',
  'feat|Keen Mind|XPHB':
    'gives proficiency, or expertise if already proficient, by the pick',
  'feat|Observant|XPHB':
    'gives proficiency, or expertise if already proficient, by the pick',
  'feat|Zhentarim Tactics|FRHoF': 'a bonus that applies in a situation, not expertise',
  'optionalfeature|Fire Rune|TCE':
    'doubles the bonus for every tool proficiency; the sheet shows no tool checks',
  'race|Dwarf (Kaladesh)|PSK':
    'doubles the bonus for the checks of one kind of stonework',
  'race|Dwarf|PHB': 'doubles the bonus for the checks of one kind of stonework',
  'subclassFeature|Blessings of Knowledge|FRHoF|Cleric|Knowledge':
    'the expertise follows the two skills picked on its skill card, not a pick of its own',
  'subclassFeature|Blessings of Knowledge|PHB|Cleric|Knowledge':
    'the expertise follows the two skills picked on its skill card, not a pick of its own',
  'subclassFeature|Dragon Ancestor|PHB|Sorcerer|Draconic':
    'doubles the Charisma bonus for the checks with dragons only',
}

describe.skipIf(!dataDir)('expertise grants against the data', () => {
  const dir = dataDir ?? ''
  // A feature that gives a skill with its expertise is a row of the features table.
  const rowIds = new Set([
    ...EXPERTISE_GRANTS.map((g) => holderId(g.holder)),
    ...FEATURE_GRANTS.filter((g) => g.expertise).map((g) => holderId(g.holder)),
  ])

  it('grants or explains every feature that gives expertise in text', () => {
    // A record that lists its expertise as data is read from there, not from its text.
    const found = findIds(
      dir,
      [
        'classFeature',
        'subclassFeature',
        'optionalfeature',
        'race',
        'subrace',
        'feat',
        'background',
      ],
      (text, r: Rec) => !r.expertise && GRANTS_EXPERTISE.test(text),
    )
    const unknown = [...found].filter(
      (id) => !rowIds.has(id) && !(id in EXPERTISE_NOT_GRANTED),
    )
    expect(unknown).toEqual([])
  })

  it('has every row of the table present in the data, at the level it names', () => {
    const all = new Map<string, number[]>()
    for (const { collection, record } of records(dir)) {
      const id = recordId(collection, record)
      all.set(id, [...(all.get(id) ?? []), Number(record.level)])
    }
    const missing = EXPERTISE_GRANTS.filter((g) => {
      const levels = all.get(holderId(g.holder))
      return !levels || (g.level !== undefined && !levels.includes(g.level))
    })
    expect(missing).toEqual([])
  })
})
