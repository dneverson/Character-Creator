import { describe, expect, it } from 'vitest'
import { dataDir, findIds, records, recordId } from '../test/dataAudit'
import { INITIATIVE_RULES, PASSIVE_RULES } from './combatRules'
import { holderId } from './holder'

/** What changes initiative or a passive score in text. */
const CHANGES_COMBAT_ROLL =
  /bonus to (your )?initiative|to your initiative|initiative rolls?|your passive (Wisdom|Intelligence)|bonus to your passive/i

/**
 * What the books say about initiative or passive scores that the sheet does not count as
 * a number, with the reason. A new book's feature fails the audit until it is in a table
 * or here.
 */
export const COMBAT_NOT_APPLIED: Record<string, string> = {
  "subclassFeature|Adventurer's Atlas|EFA|Artificer|Cartographer":
    'a die the artificer gives a creature it targets, not a bonus of its own',
  'subclassFeature|Tandem Footwork|XPHB|Bard|Dance':
    'a bonus the bard gives allies by a roll of a die in play',
  'classFeature|Battle Readiness|TCE|Warrior Sidekick':
    'a sidekick, not a character of its own',
  'feat|Zhentarim Ruffian|FRHoF': 'gives advantage by spending a use in play',
  'feat|Dungeon Delver|PHB':
    'removes a penalty to a passive score while traveling fast, not a bonus',
  'subclassFeature|Avatar of Battle|UATheMysticClass|Mystic|Avatar':
    'a bonus the mystic gives allies, in a class of an Unearthed Arcana',
  'subclassFeature|Aura of the Sentinel|TCE|Paladin|Watchers':
    'a bonus the paladin gives creatures near them when initiative is rolled',
  'optionalfeature|Ambush|TCE': 'spends a superiority die on the roll in play',
  'optionalfeature|Ambush|XPHB': 'spends a superiority die on the roll in play',
  'optionalfeature|Helm of Awareness|TCE': 'an option of a creature that wears a helm',
  'magicvariant|Weapon of Warning|':
    'an item that gives advantage while it is on the person',
  'race|Lorwyn Changeling|LFL': 'a move after the roll, not a bonus to it',
}

describe.skipIf(!dataDir)('combat rules against the data', () => {
  const dir = dataDir ?? ''
  const rowIds = new Set(
    [...INITIATIVE_RULES, ...PASSIVE_RULES].map((r) => holderId(r.holder)),
  )

  it('applies or explains every feature that changes initiative or a passive score', () => {
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
        'action',
        'magicvariant',
      ],
      (text) => CHANGES_COMBAT_ROLL.test(text),
    )
    const unknown = [...found].filter(
      (id) => !rowIds.has(id) && !(id in COMBAT_NOT_APPLIED),
    )
    expect(unknown).toEqual([])
  })

  it('has every row of the tables present in the data', () => {
    const all = new Set(
      records(dir).map(({ collection, record }) => recordId(collection, record)),
    )
    const missing = [...INITIATIVE_RULES, ...PASSIVE_RULES].filter(
      (r) => !all.has(holderId(r.holder)),
    )
    expect(missing.map((r) => holderId(r.holder))).toEqual([])
  })
})
