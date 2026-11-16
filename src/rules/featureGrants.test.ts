import { describe, expect, it } from 'vitest'
import { readGrant } from '../data/grants'
import { parseSkillGrants, SKILLS } from '../data/skills'
import { dataDir, findIds, records, recordId } from '../test/dataAudit'
import { FEATURE_GRANTS } from './featureGrants'
import { holderId } from './holder'

/** A class or subclass feature that gives proficiency in a skill, in text. */
const GRANTS_SKILL_TEXT =
  /proficien\w* (in|with)\b[^.]{0,100}\bskills?\b|\bskills? of your choice/i

/**
 * Class and subclass features that name a skill proficiency in text without giving one
 * to keep, with why. A new book's feature fails the audit until it is in FEATURE_GRANTS
 * or here.
 */
export const SKILL_NOT_GRANTED: Record<string, string> = {
  'classFeature|Bonus Proficiencies|TCE|Expert Sidekick':
    'a sidekick, not a character of its own',
  'classFeature|Bonus Proficiencies|TCE|Spellcaster Sidekick':
    'a sidekick, not a character of its own',
  'classFeature|Bonus Proficiencies|TCE|Warrior Sidekick':
    'a sidekick, not a character of its own',
  'subclassFeature|Channel Divinity: Knowledge of the Ages|PHB|Cleric|Knowledge':
    'a skill or tool for 10 minutes, not a standing proficiency',
}

describe('the features table', () => {
  it('writes every grant the way the reader reads it, with nothing unknown', () => {
    const unknown = FEATURE_GRANTS.flatMap((g) => [
      ...readGrant(g.languageProficiencies, 'language').unknown,
      ...readGrant(g.toolProficiencies, 'tool').unknown,
      ...readGrant(g.skillToolLanguageProficiencies, 'mixed').unknown,
      ...readGrant(g.expertise, 'expertise').unknown,
    ])
    expect(unknown).toEqual([])
  })

  it('names only skills there are, and gives every row something', () => {
    const keys = new Set(SKILLS.map((s) => s.key))
    for (const g of FEATURE_GRANTS) {
      const { fixed, choices } = parseSkillGrants(g.skillProficiencies)
      const named = [
        ...fixed,
        ...choices.flatMap((c) => c.from),
        ...(g.classSkills?.plus ?? []),
      ]
      expect(named.filter((k) => !keys.has(k))).toEqual([])
      const gives =
        fixed.length +
        choices.length +
        (g.classSkills ? 1 : 0) +
        (g.languageProficiencies?.length ?? 0) +
        (g.toolProficiencies?.length ?? 0)
      expect(gives, g.text).toBeGreaterThan(0)
    }
  })
})

describe.skipIf(!dataDir)('feature grants against the data', () => {
  const dir = dataDir ?? ''
  const rowIds = new Set(FEATURE_GRANTS.map((g) => holderId(g.holder)))

  const found = () =>
    findIds(
      dir,
      ['classFeature', 'subclassFeature'],
      (text, r) => !r.skillProficiencies && GRANTS_SKILL_TEXT.test(text),
    )

  it('grants or explains every class and subclass feature that gives a skill in text', () => {
    const ids = [...found()]
    expect(ids.filter((id) => !rowIds.has(id) && !(id in SKILL_NOT_GRANTED))).toEqual([])
    // 38 features found: 34 given by a row, 4 excused.
    expect([ids.length, ids.filter((id) => rowIds.has(id)).length]).toEqual([38, 34])
  })

  it('has every row of the table present in the data', () => {
    const all = new Set(
      records(dir).map(({ collection, record }) => recordId(collection, record)),
    )
    expect([...rowIds].filter((id) => !all.has(id))).toEqual([])
  })

  it('excuses only features the audit finds and the table does not give', () => {
    const ids = found()
    const stale = Object.keys(SKILL_NOT_GRANTED).filter(
      (id) => !ids.has(id) || rowIds.has(id),
    )
    expect(stale).toEqual([])
  })
})
