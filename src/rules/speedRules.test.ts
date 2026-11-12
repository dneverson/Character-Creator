import { describe, expect, it } from 'vitest'
import { dataDir, records, recordId, textOf, type Rec } from '../test/dataAudit'
import { holderId } from './holder'
import { SENSE_RULES } from './senseRules'
import { ITEM_SPEED_WHEN, SPEED_RULES } from './speedRules'

describe('speed and sense rules', () => {
  it('name each holder once, with a rule in words', () => {
    for (const rules of [SPEED_RULES, SENSE_RULES]) {
      const ids = rules.map((r) => holderId(r.holder))
      expect(new Set(ids).size).toBe(ids.length)
      for (const rule of rules) expect(rule.text.startsWith(rule.label)).toBe(true)
    }
  })
})

describe.skipIf(!dataDir)('speed and sense rules against the data', () => {
  it('have every holder present in the data', () => {
    const all = new Set(
      records(dataDir ?? '').map(({ collection, record }) =>
        recordId(collection, record),
      ),
    )
    const missing = [...SPEED_RULES, ...SENSE_RULES]
      .map((r) => holderId(r.holder))
      .filter((id) => !all.has(id))
    expect(missing).toEqual([])
  })
})

/**
 * Items whose speed change the text ties to an action or a moment, yet holds all the time:
 * the action named is for something else.
 */
const ITEM_SPEED_ALWAYS: Readonly<Record<string, string>> = {
  'Cloak of Arachnida|DMG':
    'The action is for the web; the climb speed holds while worn.',
  "Delver's Claws|BGG": 'The action invokes the rune; the burrow speed holds while worn.',
  'Jewel of Three Prayers (Exalted)|CRCotN':
    'The action is for a spell; the fly speed holds.',
  'Verminshroud (Exalted)|EGW': 'The action is for a spell; the climb speed holds.',
  'Ring of Red Fury|CRCotN':
    'The action is for a spell; the speed bonus holds while worn.',
  'Ring of Elemental Command (Air)|XDMG':
    'The action is for a spell; the fly speed holds.',
  'Silken Spite (Dormant)|EGW': 'The action is for a spell; the climb speed holds.',
  'Aquatic Wave-Swept Weapon|AU': 'The Magic action is for brine; the swim speed holds.',
  'Ascendant Wave-Swept Weapon|AU':
    'The Magic action is for brine; the swim speed holds.',
}

const ACTIVATED =
  /bonus action|an action|magic action|you drink|for the duration|for 1 hour|command word|if you help slay|blow|piety|draw|card/i

const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)

describe.skipIf(!dataDir)('item speed changes against the data', () => {
  const speedItems = new Map<string, string>()
  for (const { record } of records(dataDir ?? '')) {
    const inherits = isRec(record.inherits) ? record.inherits : {}
    if (!record.modifySpeed && !inherits.modifySpeed) continue
    const source = record.source ?? inherits.source
    const text = textOf(record.entries ? record : { entries: inherits.entries ?? record })
    speedItems.set(`${String(record.name)}|${String(source)}`, text)
  }

  it('hold every speed change that needs an action only after it', () => {
    const unlisted = [...speedItems]
      .filter(([key, text]) => ACTIVATED.test(text) && !(key in ITEM_SPEED_WHEN))
      .map(([key]) => key)
      .filter((key) => !(key in ITEM_SPEED_ALWAYS))
    expect(unlisted).toEqual([])
  })

  it('name only items that change speed', () => {
    const named = [...Object.keys(ITEM_SPEED_WHEN), ...Object.keys(ITEM_SPEED_ALWAYS)]
    expect(named.filter((key) => !speedItems.has(key))).toEqual([])
  })
})
