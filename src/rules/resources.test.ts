import { describe, expect, it } from 'vitest'
import { stripTags } from '../text/tags'
import { dataDir, records, recordId, textOf, type Rec } from '../test/dataAudit'
import { holderId, type Holder } from './holder'
import { RESOURCE_CHANGES, RESOURCE_EXCUSED, RESOURCE_RULES } from './resources'

// A use limit in a book's words: "a number of times equal to", "you regain all expended
// uses", "you can't use it again until you finish a long rest". A limit per turn, round
// or rage is not a count a counter keeps and is not matched.
const USE_LIMIT =
  /once per (?!turn|round|rage|active|roll|combat|creature)|a number of times equal to|you can use (this|it|the)[^.]{0,60}\b(times|twice)\b|regains? [^.]{0,80}(short|long) rest|expended uses|until you (finish|complete) a (short|long)|(short|long) rest before|replenish|unavailable until/i

const COLLECTIONS = [
  'classFeature',
  'subclassFeature',
  'race',
  'subrace',
  'feat',
  'optionalfeature',
  'background',
]

/** Free casts of a spell the data counts in `additionalSpells` (daily or per rest). */
const countsSpells = (r: Rec) =>
  /"(daily|rest)"/.test(JSON.stringify(r.additionalSpells ?? ''))

/** Every name of a named entry in a record, at any depth. */
function entryNames(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) entryNames(v, out)
  else if (value && typeof value === 'object') {
    const e = value as Rec
    if (typeof e.name === 'string') out.add(e.name)
    entryNames(e.entries, out)
    entryNames(e.items, out)
  }
  return out
}

/** The column labels of the level tables of a holder's class or subclass. */
function columnsOf(all: { collection: string; record: Rec }[], holder: Holder): string[] {
  const groups = all.flatMap(({ collection, record }) => {
    if ('classFeature' in holder) {
      return collection === 'class' && record.name === holder.classFeature.className
        ? [record.classTableGroups]
        : []
    }
    if ('subclassFeature' in holder) {
      const s = holder.subclassFeature
      return collection === 'subclass' &&
        record.className === s.className &&
        record.shortName === s.shortName
        ? [record.subclassTableGroups]
        : []
    }
    return []
  })
  return groups.flatMap((list) =>
    Array.isArray(list)
      ? list.flatMap((g: Rec) =>
          Array.isArray(g.colLabels) ? g.colLabels.map((l) => stripTags(String(l))) : [],
        )
      : [],
  )
}

describe('resource rules', () => {
  it('names each counter once per holder', () => {
    const keys = RESOURCE_RULES.map(
      (r) => `${holderId(r.holder)}#${r.label ?? r.feature ?? ''}`,
    )
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([])
  })

  it('changes only counters a rule gives', () => {
    const labels = new Set(
      RESOURCE_RULES.map((r) => r.label ?? r.feature ?? holderLabel(r.holder)),
    )
    expect(RESOURCE_CHANGES.filter((c) => !labels.has(c.target))).toEqual([])
  })

  it('never both counts and excuses a record', () => {
    const ruled = new Set(RESOURCE_RULES.map((r) => holderId(r.holder)))
    expect(Object.keys(RESOURCE_EXCUSED).filter((id) => ruled.has(id))).toEqual([])
  })
})

/** The name a holder's counter shows without a label: the feature, feat or option. */
function holderLabel(holder: Holder): string {
  if ('feat' in holder) return holder.feat.split('|')[0]
  if ('option' in holder) return holder.option.split('|')[0]
  if ('item' in holder) return holder.item.split('|')[0]
  if ('race' in holder) return holder.race.subraceName ?? holder.race.baseName
  return 'classFeature' in holder ? holder.classFeature.name : holder.subclassFeature.name
}

describe.skipIf(!dataDir)('resource rules against the data', () => {
  const all = records(dataDir ?? '')
  const byId = new Map(
    all.map(({ collection, record }) => [recordId(collection, record), record]),
  )
  const ruled = new Set([
    ...RESOURCE_RULES.map((r) => holderId(r.holder)),
    ...RESOURCE_CHANGES.map((c) => holderId(c.holder)),
  ])

  it('counts or excuses every feature whose text limits its uses', () => {
    const found = all.filter(
      ({ collection, record }) =>
        COLLECTIONS.includes(collection) &&
        typeof record.name === 'string' &&
        USE_LIMIT.test(textOf(record)),
    )
    const ids = [
      ...new Set(found.map(({ collection, record }) => recordId(collection, record))),
    ]
    const bySpellData = found.filter(({ record }) => countsSpells(record))
    const open = ids.filter(
      (id) =>
        !ruled.has(id) && !(id in RESOURCE_EXCUSED) && !countsSpells(byId.get(id) ?? {}),
    )
    expect(open).toEqual([])
    // The audit's reach, so a change in the data that empties it shows.
    expect(ids.length).toBeGreaterThan(600)
    expect(bySpellData.length).toBeGreaterThan(50)
  })

  it('has every holder, trait and excused record in the data', () => {
    expect([...ruled].filter((id) => !byId.has(id))).toEqual([])
    expect(Object.keys(RESOURCE_EXCUSED).filter((id) => !byId.has(id))).toEqual([])
    // An address can name several records (a reprint inside another book's file).
    const names = new Map<string, Set<string>>()
    for (const { collection, record } of all) {
      const id = recordId(collection, record)
      names.set(id, entryNames(record.entries, names.get(id)))
    }
    const missing = RESOURCE_RULES.filter(
      (r) => r.feature && !names.get(holderId(r.holder))?.has(r.feature),
    )
    expect(missing.map((r) => `${holderId(r.holder)}#${r.feature}`)).toEqual([])
  })

  it('reads every column from the level table of the holder', () => {
    const missing = RESOURCE_RULES.filter(
      (r) =>
        r.count.kind === 'column' && !columnsOf(all, r.holder).includes(r.count.column),
    )
    expect(missing.map((r) => holderId(r.holder))).toEqual([])
  })
})
