import { describe, expect, it } from 'vitest'
import { dataDir, findIds, records, recordId, textOf, type Rec } from '../test/dataAudit'
import { holderId } from './holder'
import { SENSE_RULES } from './senseRules'
import { ITEM_SPEED_WHEN, SPEED_RULES } from './speedRules'

describe('speed and sense rules', () => {
  it('name each holder once, with a rule in words', () => {
    // A feature may give two senses (Power of Shadow), one row each.
    const keys = [
      ...SPEED_RULES.map((r) => holderId(r.holder)),
      ...SENSE_RULES.map((r) => `${holderId(r.holder)}|${r.sense}`),
    ]
    expect(new Set(keys).size).toBe(keys.length)
    for (const rule of [...SPEED_RULES, ...SENSE_RULES])
      expect(rule.text.startsWith(rule.label)).toBe(true)
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

/** What the books say about a sense with a range, or seeing in the dark. */
const GIVES_SENSE =
  /(darkvision|blindsight|truesight|tremorsense)[^.]{0,50}\d+ ?(feet|foot|ft)|see normally in (darkness|dim light)/i

/** Sense grants the sheet deliberately does not count, each with the reason. */
const SENSES_NOT_APPLIED: Readonly<Record<string, string>> = {
  'subclassFeature|Aspect of the Wilds|XPHB|Barbarian|Wild Heart':
    'Darkvision comes with the Owl, one of three options chosen again at each long rest.',
  'subclassFeature|Visage of the Astral Self|TCE|Monk|Astral Self':
    'Holds only while the astral visage is summoned (a bonus action, for 10 minutes).',
  'subclassFeature|Mortal Bulwark|TCE|Paladin|Watchers':
    'Truesight holds only for 1 minute after the bonus action that starts it.',
  'subclassFeature|The Third Eye|PHB|Wizard|Divination':
    'One benefit chosen as an action, until the next rest.',
  'subclassFeature|The Third Eye|XPHB|Wizard|Diviner':
    'One benefit chosen as a bonus action, until the next rest.',
  'subclassFeature|Manifest Mind|TCE|Wizard|Scribes':
    "The darkvision is the spectral mind's, not the character's.",
  "subclassFeature|Transmuter's Stone|PHB|Wizard|Transmutation":
    'A benefit chosen for the stone, given to whoever carries it.',
  "subclassFeature|Transmuter's Stone|AU|Wizard|Transmuter":
    'A benefit chosen for the stone, given to whoever carries it.',
  'subclassFeature|Potent Stone|AU|Wizard|Transmuter':
    'A benefit chosen for the stone, given to whoever carries it.',
}

describe.skipIf(!dataDir)('sense grants against the data', () => {
  it('cover every feature and option that gives a sense', () => {
    const rows = new Set(SENSE_RULES.map((r) => holderId(r.holder)))
    const found = findIds(
      dataDir ?? '',
      ['classFeature', 'subclassFeature', 'optionalfeature'],
      (text) => GIVES_SENSE.test(text),
    )
    const unknown = [...found].filter(
      (id) => !rows.has(id) && !(id in SENSES_NOT_APPLIED),
    )
    expect(unknown).toEqual([])
  })

  it('find each feat that gives a sense in the data fields the sheet reads', () => {
    const missing = records(dataDir ?? '')
      .filter(
        ({ collection, record }) =>
          collection === 'feat' && GIVES_SENSE.test(textOf(record)),
      )
      .filter(({ record }) => !record.senses && !record.bonusSenses)
      .map(({ collection, record }) => recordId(collection, record))
    expect(missing).toEqual([])
  })

  it('name only features that give a sense', () => {
    const found = findIds(
      dataDir ?? '',
      ['classFeature', 'subclassFeature', 'optionalfeature'],
      (text) => GIVES_SENSE.test(text),
    )
    expect(Object.keys(SENSES_NOT_APPLIED).filter((id) => !found.has(id))).toEqual([])
  })
})
