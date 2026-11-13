import { describe, expect, it } from 'vitest'
import { dataDir, findIds, records, recordId } from '../test/dataAudit'
import { holderId } from './holder'
import { SAVE_RULES } from './saveRules'

/** What the books say about saving throws that the sheet does not count as a number. */
const CHANGES_SAVE =
  /proficiency in (all |wisdom |charisma |constitution |dexterity |strength |intelligence )?(and \w+ )?saving throws?|to (all |every |each )?saving throws?|add (your|its) \w+ modifier to[^.]{0,40}saving throws?/i

/**
 * Features that mention a saving throw bonus or proficiency that the sheet does not count
 * as a standing number, with the reason. A new book's feature fails the audit until it is
 * in SAVE_RULES or here.
 */
const SAVES_NOT_APPLIED: Record<string, string> = {
  'classFeature|Soul of Artifice|TCE|Artificer': 'Depends on the attuned items worn.',
  'subclassFeature|Unfettered Mind|FRHoF|Cleric|Knowledge':
    'A reaction bonus, not a standing one.',
  'subclassFeature|Improved Circle Forms|XPHB|Druid|Moon': 'Only while in Wild Shape.',
  'classFeature|Strength of Mind|UATheMysticClass|Mystic':
    'Unearthed Arcana, not offered.',
  "subclassFeature|Transmuter's Stone|PHB|Wizard|Transmutation":
    'A stone effect the player chooses.',
  "subclassFeature|Transmuter's Stone|AU|Wizard|Transmuter":
    'A stone effect the player chooses.',
}

describe('save rules', () => {
  it('names every holder once, with a label and a rule in words', () => {
    const ids = SAVE_RULES.map((r) => holderId(r.holder))
    expect(new Set(ids).size).toBe(ids.length)
    for (const rule of SAVE_RULES) {
      expect(rule.label).not.toBe('')
      expect(rule.text.startsWith(rule.label)).toBe(true)
    }
  })
})

describe.skipIf(!dataDir)('save rules against the data', () => {
  const dir = dataDir ?? ''

  it('has every row of the table present in the data', () => {
    const all = new Set(
      records(dir).map(({ collection, record }) => recordId(collection, record)),
    )
    const missing = SAVE_RULES.filter((r) => !all.has(holderId(r.holder)))
    expect(missing.map((r) => holderId(r.holder))).toEqual([])
  })

  it('applies or explains every class feature that changes saving throws', () => {
    const rows = new Set(SAVE_RULES.map((r) => holderId(r.holder)))
    const found = findIds(dir, ['classFeature', 'subclassFeature'], (text) =>
      CHANGES_SAVE.test(text),
    )
    const unknown = [...found].filter((id) => !rows.has(id) && !(id in SAVES_NOT_APPLIED))
    expect(unknown).toEqual([])
  })
})
