import { describe, expect, it } from 'vitest'
import { dataDir, findIds, records, recordId, textOf, type Rec } from '../test/dataAudit'
import { holderId } from './holder'
import { SENSE_RULES } from './senseRules'
import {
  ARMOR_STRENGTH_EXEMPT,
  ITEM_SPEED_WHEN,
  MOVE_RULES,
  RACE_MOVE_LIMITS,
  SPEED_RULES,
  type MoveMode,
} from './speedRules'

describe('speed and sense rules', () => {
  it('name each holder once, with a rule in words', () => {
    // A feature may give two senses (Power of Shadow), one row each.
    const keys = [
      ...SPEED_RULES.map((r) => holderId(r.holder)),
      ...SENSE_RULES.map((r) => `${holderId(r.holder)}|${r.sense}`),
      ...MOVE_RULES.map((r) => `${holderId(r.holder)}|${r.mode}|${r.label}`),
      ...RACE_MOVE_LIMITS.map((r) => `${holderId(r.holder)}|${r.mode}|limit`),
    ]
    expect(new Set(keys).size).toBe(keys.length)
    for (const rule of [...SPEED_RULES, ...SENSE_RULES, ...MOVE_RULES])
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
    const missing = [
      ...SPEED_RULES,
      ...SENSE_RULES,
      ...MOVE_RULES,
      ...RACE_MOVE_LIMITS,
      ...ARMOR_STRENGTH_EXEMPT,
    ]
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

/** What the books say about a speed of another way of moving, and which way it is. */
const GIVES_MOVE = /\b(fly|flying|swim|swimming|climb|climbing|burrow|burrowing) speed/gi
const MODE_OF: Readonly<Record<string, MoveMode>> = {
  fly: 'fly',
  flying: 'fly',
  swim: 'swim',
  swimming: 'swim',
  climb: 'climb',
  climbing: 'climb',
  burrow: 'burrow',
  burrowing: 'burrow',
}
const modesIn = (text: string): Set<MoveMode> =>
  new Set([...text.matchAll(GIVES_MOVE)].map((m) => MODE_OF[m[1].toLowerCase()]))

/** What the books say to switch a species' speed off in some armor. */
const ARMOR_STOPS_MOVE =
  /can't use (this|your) (flying|climbing) speed|speed of \d+ feet (while you aren't|as long as you are not)[^.]*armor/i

/** Records that name another way of moving the sheet deliberately does not count. */
const MOVES_NOT_APPLIED: Readonly<Record<string, string>> = {
  'subclassFeature|Macabre Modifications|RHW|Artificer|Reanimator':
    "The speeds are the companion's, not the character's.",
  'subclassFeature|Bestial Soul|TCE|Barbarian|Beast':
    'One of three benefits, chosen again at each short or long rest.',
  'subclassFeature|Aspect of the Wilds|XPHB|Barbarian|Wild Heart':
    'One of three options, chosen again at each long rest.',
  'classFeature|Wild Shape|PHB|Druid': 'It limits the beast forms, by their speeds.',
  'classFeature|Wild Shape|XPHB|Druid': 'It limits the beast forms, by their speeds.',
  'subclassFeature|Circle Forms|PHB|Druid|Moon':
    'It limits the beast forms, by their speeds.',
  'classFeature|Deft Explorer Improvement|TCE|Ranger':
    'An optional class feature (TCE) the sheet does not track as taken.',
  'subclassFeature|Bond of Fang and Scale|FTD|Ranger|Drakewarden':
    "The fly speed is the drake's.",
  'subclassFeature|Perfected Bond|FTD|Ranger|Drakewarden':
    "The fly speed is the drake's.",
  'optionalfeature|Investment of the Chain Master|TCE': "The speed is the familiar's.",
  'optionalfeature|Investment of the Chain Master|XPHB': "The speed is the familiar's.",
  'subclassFeature|Dragon|XPHB|Druid|Stars':
    "A Foundry VTT record of the Dragon form; its fly speed is Twinkling Constellations'.",
  'race|Dhampir|VRGR':
    "Ancestral Legacy keeps a replaced race's swimming speed; the replaced race is not tracked.",
  'race|Hexblood|VRGR':
    "Ancestral Legacy keeps a replaced race's swimming speed; the replaced race is not tracked.",
  'race|Reborn|VRGR':
    "Ancestral Legacy keeps a replaced race's swimming speed; the replaced race is not tracked.",
}

describe.skipIf(!dataDir)('speeds of other ways of moving against the data', () => {
  const all = records(dataDir ?? '').filter(({ collection }) =>
    [
      'classFeature',
      'subclassFeature',
      'optionalfeature',
      'reward',
      'feat',
      'race',
      'subrace',
    ].includes(collection),
  )
  const ruled = new Map<string, Set<MoveMode>>()
  for (const rule of MOVE_RULES) {
    const id = holderId(rule.holder)
    ruled.set(id, new Set([...(ruled.get(id) ?? []), rule.mode]))
  }
  const found = all.flatMap(({ collection, record }) => {
    const modes = modesIn(textOf(record))
    return modes.size > 0 ? [{ id: recordId(collection, record), record, modes }] : []
  })

  it('give every speed the books name, from the data or a rule', () => {
    const unknown = found
      .filter(({ id, record, modes }) => {
        const speed = isRec(record.speed) ? record.speed : {}
        const covered = [...modes].every((m) => m in speed || ruled.get(id)?.has(m))
        return !covered && !(id in MOVES_NOT_APPLIED)
      })
      .map(({ id, modes }) => `${id} (${[...modes].join(', ')})`)
    expect(unknown).toEqual([])
  })

  it('name only records that name such a speed', () => {
    const ids = new Set(found.map((f) => f.id))
    const named = [...ruled.keys(), ...Object.keys(MOVES_NOT_APPLIED)]
    expect(named.filter((id) => !ids.has(id))).toEqual([])
  })

  it("switch off every species' speed its text says some armor stops", () => {
    const limited = new Set([
      ...RACE_MOVE_LIMITS.map((l) => holderId(l.holder)),
      ...MOVE_RULES.filter((r) => r.without).map((r) => holderId(r.holder)),
    ])
    const missing = all
      .filter(({ collection, record }) => {
        return (
          (collection === 'race' || collection === 'subrace') &&
          ARMOR_STOPS_MOVE.test(textOf(record))
        )
      })
      .map(({ collection, record }) => recordId(collection, record))
      .filter((id) => !limited.has(id))
    expect(missing).toEqual([])
  })
})

/** What the books say to spare a character armor's Strength requirement. */
const SPARES_STRENGTH =
  /speed (is not|isn't) reduced[^.]{0,90}heavy armor|lacks this requirement/i

/** Records that say so of something else, each with the reason: none so far. */
const STRENGTH_NOT_EXEMPT: Readonly<Record<string, string>> = {}

describe.skipIf(!dataDir)('armor Strength exemptions against the data', () => {
  const found = findIds(
    dataDir ?? '',
    [
      'race',
      'subrace',
      'item',
      'classFeature',
      'subclassFeature',
      'optionalfeature',
      'feat',
    ],
    (text) => SPARES_STRENGTH.test(text),
  )
  // Mithral says so too, and its data clears the requirement (`strength: null`).
  const cleared = new Set(
    records(dataDir ?? '')
      .filter(({ record }) => isRec(record) && record.strength === null)
      .map(({ collection, record }) => recordId(collection, record)),
  )

  it('spare the character for every record that says so', () => {
    const rows = new Set(ARMOR_STRENGTH_EXEMPT.map((r) => holderId(r.holder)))
    const unknown = [...found].filter(
      (id) => !rows.has(id) && !(id in STRENGTH_NOT_EXEMPT) && !cleared.has(id),
    )
    expect(unknown).toEqual([])
  })

  it('name only records that say so, each in the data', () => {
    const named = [
      ...ARMOR_STRENGTH_EXEMPT.map((r) => holderId(r.holder)),
      ...Object.keys(STRENGTH_NOT_EXEMPT),
    ]
    expect(named.filter((id) => !found.has(id))).toEqual([])
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

const SENTIENT = "The sense is the sentient item's own, not its wielder's."

/** Items whose text names a sense that is not the character's to keep, with the reason. */
const ITEM_SENSES_NOT_APPLIED: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [
      'Ashbringer|WoW',
      'Ashbringer (True State)|WoW',
      'Corrupted Ashbringer|WoW',
      'Azuredge|WDH',
      'Blackrazor|DMG',
      'Blackstaff|WDH',
      'Blade of Broken Mirrors (Dormant)|EGW',
      "Constantori's Portrait|KftGV",
      'Crown of Horns|FRAiF',
      'Dawnbringer|OotA',
      'Ebonbane|RHW',
      'Grovelthrash (Dormant)|EGW',
      'Harp of Gilded Plenty|BGG',
      'Heretic|QftIS',
      'Lash of Shadows (Dormant)|EGW',
      'Mace of the Black Crown (Dormant)|EGW',
      'Moonblade|DMG',
      "Murgaxor's Orb|SCC",
      'Nepenthe|VRGR',
      "Ruin's Wake (Dormant)|EGW",
      'Ruinblade|IMR',
      'Shield of the Hidden Lord|BGDIA',
      'Silken Spite (Dormant)|EGW',
      'Snicker-Snack|WBtW',
      'Stone of Golorr|WDH',
      'Sword of Kas|DMG',
      'Sword of Kas|XDMG',
      'Tearulai|WDMM',
      'The Bloody End (Dormant)|EGW',
      'Wand of Orcus|DMG',
      'Wand of Orcus|XDMG',
      'Wave|DMG',
      'Wave|XDMG',
      'Waythe|TftYP',
      'Whelm|DMG',
      'Whelm|XDMG',
      'Will of the Talon (Dormant)|EGW',
    ].map((key) => [`item|${key}`, SENTIENT]),
  ),
  'item|Crystal Ball of True Seeing|DMG': 'Truesight only while scrying, at the sensor.',
  'item|Crystal Ball of True Seeing|XDMG': 'Truesight only while scrying, at the sensor.',
  'item|Deck of Wonder|BMT': 'One card drawn from the deck, not a lasting sense.',
  'item|Figurine of Wondrous Power, Onyx Dog|DMG': "The sense is the summoned dog's.",
  'item|Figurine of Wondrous Power, Onyx Dog|XDMG': "The sense is the summoned dog's.",
  'item|Gem of Seeing|DMG':
    'Truesight for 10 minutes after an action that spends a charge.',
  'item|Gem of Seeing|XDMG':
    'Truesight for 10 minutes after an action that spends a charge.',
  'item|Glowrune Pigment|BGG': 'A pigment painted on a creature, for a time.',
  'item|Hag Eye|MM': "The sense is the hag eye's own.",
  'item|Powered Armor|LLK': 'Darkvision for up to 1 hour, bought with a charge.',
  'item|Shield of Far Sight|VGM': "The sense is the shield's eye's, for its creator.",
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

  it('cover every item that gives its wearer or wielder a sense', () => {
    const rows = new Set(SENSE_RULES.map((r) => holderId(r.holder)))
    const found = findIds(dataDir ?? '', ['item'], (text) => GIVES_SENSE.test(text))
    const unknown = [...found].filter(
      (id) => !rows.has(id) && !(id in ITEM_SENSES_NOT_APPLIED),
    )
    expect(unknown).toEqual([])
    expect(Object.keys(ITEM_SENSES_NOT_APPLIED).filter((id) => !found.has(id))).toEqual(
      [],
    )
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
