// The rows of Quick lookup: every collection the loaded content holds, each read by
// its own dataset's loader, plus the collections that have no dataset of their own
// (conditions, actions, senses, variant rules...), read here as a name, a few facts
// and the text. Nothing is searched here; see search.ts.

import { rowKey, type ClassRow } from '../components/editor/classRows'
import { memoizeContent } from '../content/epoch'
import { loadBackgrounds } from '../data/background'
import { loadClasses, subclassesFor } from '../data/class'
import { loadClassOptions } from '../data/classOptions'
import { loadCreatures } from '../data/beasts'
import { fetchData } from '../data/dataClient'
import { loadBookEditions, type Edition } from '../data/edition'
import { loadFeats, loadVersionedFeats } from '../data/feats'
import { loadItems } from '../data/items'
import { loadParentRaces, loadRaces } from '../data/race'
import { loadRewards } from '../data/rewards'
import { classNames } from '../data/spells'
import { loadSpells } from '../data/spells'
import type { Entry } from '../text/Entries'
import { stripTags } from '../text/tags'
import {
  factText,
  readCard,
  readDeck,
  readItemGroup,
  readItemMastery,
  readItemProperty,
  readItemType,
  readObject,
  readRecipe,
  readVehicle,
  type Raw,
  type Read,
} from './readers'
import type { LookupKind, LookupRow, Subject } from './types'

/** A collection of the data that has no dataset of its own. */
interface TextCollection {
  file: string
  /** The lists in the file, the kind the rows of each are, and how a list is read. */
  lists: { key: string; kind: LookupKind; read?: (raw: Raw, file: DataFile) => Read }[]
  /** Fields of a row worth a line of their own: label and field name. */
  facts?: [label: string, field: string][]
}

type DataFile = Record<string, unknown>

const TEXT_COLLECTIONS: TextCollection[] = [
  {
    file: 'conditionsdiseases.json',
    lists: [
      { key: 'condition', kind: 'condition' },
      { key: 'disease', kind: 'disease' },
      { key: 'status', kind: 'status' },
    ],
  },
  { file: 'actions.json', lists: [{ key: 'action', kind: 'action' }] },
  { file: 'senses.json', lists: [{ key: 'sense', kind: 'sense' }] },
  { file: 'skills.json', lists: [{ key: 'skill', kind: 'skill' }] },
  {
    file: 'languages.json',
    lists: [{ key: 'language', kind: 'language' }],
    facts: [
      ['Type', 'type'],
      ['Script', 'script'],
      ['Typical speakers', 'typicalSpeakers'],
    ],
  },
  { file: 'variantrules.json', lists: [{ key: 'variantrule', kind: 'variantRule' }] },
  {
    file: 'deities.json',
    lists: [{ key: 'deity', kind: 'deity' }],
    facts: [
      ['Title', 'title'],
      ['Pantheon', 'pantheon'],
      ['Domains', 'domains'],
      ['Symbol', 'symbol'],
    ],
  },
  {
    file: 'trapshazards.json',
    lists: [
      { key: 'trap', kind: 'trap' },
      { key: 'hazard', kind: 'hazard' },
    ],
  },
  {
    file: 'cultsboons.json',
    lists: [
      { key: 'cult', kind: 'cult' },
      { key: 'boon', kind: 'boon' },
    ],
  },
  {
    file: 'charcreationoptions.json',
    lists: [{ key: 'charoption', kind: 'characterOption' }],
  },
  { file: 'psionics.json', lists: [{ key: 'psionic', kind: 'psionic' }] },
  {
    file: 'bastions.json',
    lists: [{ key: 'facility', kind: 'facility' }],
    facts: [['Facility type', 'facilityType']],
  },
  {
    file: 'vehicles.json',
    lists: [
      { key: 'vehicleUpgrade', kind: 'vehicleUpgrade' },
      { key: 'vehicle', kind: 'vehicle', read: readVehicle },
    ],
    facts: [['Upgrade type', 'upgradeType']],
  },
  { file: 'tables.json', lists: [{ key: 'table', kind: 'table' }] },
  { file: 'objects.json', lists: [{ key: 'object', kind: 'object', read: readObject }] },
  { file: 'recipes.json', lists: [{ key: 'recipe', kind: 'recipe', read: readRecipe }] },
  {
    file: 'decks.json',
    lists: [
      { key: 'deck', kind: 'deck', read: readDeck },
      { key: 'card', kind: 'card', read: readCard },
    ],
  },
  {
    file: 'items.json',
    lists: [{ key: 'itemGroup', kind: 'itemGroup', read: readItemGroup }],
  },
  {
    file: 'items-base.json',
    lists: [
      { key: 'itemProperty', kind: 'itemProperty', read: readItemProperty },
      { key: 'itemMastery', kind: 'itemMastery', read: readItemMastery },
      { key: 'itemType', kind: 'itemType', read: readItemType },
    ],
  },
]

interface RawText extends Raw {
  name: string
  caption?: string
  colLabels?: string[]
  rows?: Entry[][]
  [field: string]: unknown
}

type EditionOf = (source: string) => Edition

/** A row's text: its entries, or, for a table of the data, the table itself. */
function entriesOf(raw: RawText): Entry[] {
  if (raw.entries) return raw.entries
  if (raw.rows) {
    return [
      { type: 'table', caption: raw.caption, colLabels: raw.colLabels, rows: raw.rows },
    ]
  }
  return []
}

function row(
  kind: LookupKind,
  key: string,
  name: string,
  source: string,
  edition: Edition | undefined,
  subject: Subject,
  context?: string,
  aliases?: string[],
): LookupRow {
  return {
    id: `${kind}:${key}`,
    kind,
    name,
    ...(context !== undefined && { context }),
    ...(aliases?.length && { aliases }),
    source,
    edition,
    subject,
  }
}

/** A row of a collection that has no dataset: its name, facts and text. */
function textRow(
  kind: LookupKind,
  raw: { name: string; source: string; page?: number },
  edition: Edition,
  facts: { label: string; value: string }[],
  entries: Entry[],
  context?: string,
  aliases?: string[],
): LookupRow {
  const key = `${raw.name}|${raw.source}${context ? `|${context}` : ''}`.toLowerCase()
  return row(
    kind,
    key,
    raw.name,
    raw.source,
    edition,
    {
      type: 'text',
      value: {
        name: raw.name,
        source: raw.source,
        edition,
        page: raw.page,
        facts,
        entries,
      },
    },
    context,
    aliases,
  )
}

async function textRows(editionOf: EditionOf): Promise<LookupRow[]> {
  const out: LookupRow[] = []
  const files = await Promise.all(
    TEXT_COLLECTIONS.map((collection) =>
      fetchData<Record<string, RawText[] | undefined>>(collection.file).catch(
        (): Record<string, RawText[] | undefined> => ({}),
      ),
    ),
  )
  TEXT_COLLECTIONS.forEach((collection, i) => {
    for (const { key, kind, read } of collection.lists) {
      for (const raw of files[i][key] ?? []) {
        // A list with a reader of its own says what its entries are called and hold.
        const own = read?.(raw, files[i])
        const facts =
          own?.facts ??
          (collection.facts ?? [])
            .map(([label, field]) => ({ label, value: factText(raw[field]) }))
            .filter((fact) => fact.value !== '')
        out.push(
          textRow(
            kind,
            { ...raw, name: own?.name ?? raw.name },
            editionOf(raw.source),
            facts,
            own?.entries ?? entriesOf(raw),
            own?.context,
            own?.aliases,
          ),
        )
      }
    }
  })
  return out
}

/** The rows of the classes, their subclasses and the features of both. */
async function classRows(editionOf: EditionOf): Promise<LookupRow[]> {
  const out: LookupRow[] = []
  const loaded = await loadClasses()
  const files = new Set<(typeof loaded)[number]['file']>()
  const classRow = (r: ClassRow): LookupRow => {
    const entry = r.subclass ?? r.loaded.entry
    return row(
      r.subclass ? 'subclass' : 'class',
      rowKey(r).toLowerCase(),
      entry.name,
      entry.source,
      entry.edition ?? r.loaded.entry.edition,
      { type: 'class', value: r },
      r.subclass ? r.loaded.entry.name : undefined,
    )
  }
  for (const l of loaded) {
    out.push(classRow({ loaded: l }))
    for (const subclass of subclassesFor(l)) out.push(classRow({ loaded: l, subclass }))
    files.add(l.file)
  }
  for (const file of files) {
    for (const f of file.classFeature ?? []) {
      const where = `${f.className} ${f.level}`
      const facts = [{ label: 'Gained', value: where }]
      out.push(textRow('classFeature', f, editionOf(f.source), facts, f.entries, where))
    }
    for (const f of file.subclassFeature ?? []) {
      const where = `${f.className}, ${f.subclassShortName} ${f.level}`
      const facts = [{ label: 'Gained', value: where }]
      out.push(
        textRow('subclassFeature', f, editionOf(f.source), facts, f.entries, where),
      )
    }
  }
  return out
}

/** The rows of every creature of the bestiary: the largest collection of the lookup. */
async function creatureRows(): Promise<LookupRow[]> {
  const index = await fetchData<Record<string, string>>('bestiary/index.json').catch(
    (): Record<string, string> => ({}),
  )
  const creatures = await loadCreatures(Object.keys(index))
  return creatures.map((c) =>
    row('creature', `${c.name}|${c.source}`.toLowerCase(), c.name, c.source, c.edition, {
      type: 'creature',
      value: c,
    }),
  )
}

/** Gives a row that shares its id with an earlier one an id of its own. */
export function uniqueIds(rows: LookupRow[]): LookupRow[] {
  const seen = new Map<string, number>()
  return rows.map((r) => {
    const n = (seen.get(r.id) ?? 0) + 1
    seen.set(r.id, n)
    return n === 1 ? r : { ...r, id: `${r.id}#${n}` }
  })
}

/** Every entry of the loaded content, kind by kind. Loaded once per content. */
export const loadLookupRows = memoizeContent(async (): Promise<LookupRow[]> => {
  const editionOf = await loadBookEditions().catch((): EditionOf => () => 'classic')
  const [
    spells,
    items,
    races,
    parentRaces,
    backgrounds,
    feats,
    versionedFeats,
    rewards,
    options,
    classes,
    texts,
    creatures,
  ] = await Promise.all([
    loadSpells(),
    loadItems(),
    loadRaces(),
    loadParentRaces(),
    loadBackgrounds(),
    loadFeats(),
    loadVersionedFeats(),
    loadRewards(),
    loadClassOptions(),
    classRows(editionOf),
    textRows(editionOf),
    creatureRows(),
  ])
  const rows: LookupRow[] = [
    ...spells.map((s) =>
      row('spell', s.key, s.name, s.source, s.edition, { type: 'spell', value: s }),
    ),
    ...items.map((i) =>
      row('item', i.key, i.name, i.source, i.edition, { type: 'item', value: i }),
    ),
    ...[...races, ...parentRaces].map((r) =>
      row('race', r.key, r.name, r.source, r.edition, { type: 'race', value: r }),
    ),
    ...backgrounds.map((b) =>
      row('background', b.key, b.name, b.source, b.edition, {
        type: 'background',
        value: b,
      }),
    ),
    ...[...feats, ...versionedFeats].map((f) =>
      row('feat', f.key, f.label, f.source, f.edition, { type: 'feat', value: f }),
    ),
    ...rewards.map((r) =>
      row('reward', r.key, r.name, r.source, r.edition, { type: 'reward', value: r }),
    ),
    ...classes,
    ...options.map((o) =>
      textRow(
        'optionalFeature',
        o,
        editionOf(o.source),
        [{ label: 'Offered as', value: o.types.join(', ') }],
        o.entries,
      ),
    ),
    ...texts,
    ...creatures,
  ]
  return uniqueIds(rows)
})

const textOf = new WeakMap<LookupRow, string>()

/** The keys of an entry whose value is more text. */
const TEXT_KEYS = ['name', 'entries', 'items', 'entry', 'caption', 'colLabels', 'rows']

/** The words of entries: what they say, with the markup gone, in reading order. */
function wordsOf(entries: unknown): string {
  if (typeof entries === 'string') return stripTags(entries)
  if (typeof entries === 'number') return String(entries)
  if (Array.isArray(entries)) return entries.map(wordsOf).filter(Boolean).join(' ')
  if (entries !== null && typeof entries === 'object')
    return TEXT_KEYS.map((key) => wordsOf((entries as Record<string, unknown>)[key]))
      .filter(Boolean)
      .join(' ')
  return ''
}

/** The entries a row's text is read from. */
function bodyOf(subject: Subject): unknown {
  switch (subject.type) {
    case 'spell':
      return [
        subject.value.entries,
        subject.value.entriesHigherLevel,
        classNames(subject.value),
      ]
    case 'text':
      return [subject.value.entries, subject.value.facts.map((f) => f.value)]
    case 'class':
      return []
    case 'creature': {
      const c = subject.value
      return [
        c.type,
        c.tags,
        c.traits,
        c.spellcasting,
        c.actions,
        c.bonusActions,
        c.reactions,
        c.legendary,
        c.mythic,
        c.lair,
      ]
    }
    default:
      return subject.value.entries
  }
}

/** A row's text as plain words: what the text search looks through. Worked out once. */
export function rowText(r: LookupRow): string {
  let text = textOf.get(r)
  if (text === undefined) {
    text = wordsOf(bodyOf(r.subject))
    textOf.set(r, text)
  }
  return text
}

/** The captions of the tables written inside a row's text. */
export function tableCaptions(r: LookupRow): string[] {
  const found: string[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk)
    else if (node !== null && typeof node === 'object') {
      const entry = node as Record<string, unknown>
      if (entry.type === 'table' && typeof entry.caption === 'string')
        found.push(entry.caption)
      TEXT_KEYS.forEach((key) => walk(entry[key]))
    }
  }
  walk(bodyOf(r.subject))
  return found
}
