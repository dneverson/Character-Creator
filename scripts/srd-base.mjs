// The free rules this site hosts.
//
// The full 5etools data marks every entry that a System Reference Document (SRD)
// covers. These rules reduce the full data to those entries, so that what is
// published under `public/data` is only material released under CC-BY-4.0:
//
//   1. keep the entries that carry an SRD flag, and the vocabulary they point at;
//   2. take out references to entries that were not kept, and the pointers to
//      art, sound and lore, none of which an SRD includes;
//   3. use the SRD's own name wherever the book's name is not in the SRD;
//   4. cut the files that describe other files (the book list, the indexes, the
//      spell lookup) down to what was kept.
//
// Everything here is a pure function of the parsed files. Reading and writing is
// done by `scripts/build-base.mjs`.

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const lower = (text) => String(text).toLowerCase()

// ---- What the data looks like ---------------------------------------------

// A magic item variant ("+1 Weapon") describes the items made from it under
// `inherits`: its source and its SRD flag are there, not on the variant itself.
const flagHolder = (entry, flag) =>
  entry[flag] === undefined && isObject(entry.inherits) ? entry.inherits : entry
const sourceOf = (entry) => entry.source ?? entry.inherits?.source
/** How an entry is named in the report. */
const labelOf = (entry) =>
  `${entry.name ?? entry.abbreviation ?? '(unnamed)'}|${sourceOf(entry)}`

// How an entry of each kind is identified, by the entry itself and by the text
// (`uid`) other entries use to point at it. A kind is named after the top-level
// array that holds its entries.
const named = (defaultSource) => ({
  ofEntry: (entry) => lower(`${entry.name}|${sourceOf(entry)}`),
  ofUid: (uid) => {
    const [name, source] = uid.split('|')
    return lower(`${name}|${source || defaultSource}`)
  },
})
const coded = (defaultSource) => ({
  ofEntry: (entry) => lower(`${entry.abbreviation}|${entry.source}`),
  ofUid: named(defaultSource).ofUid,
})

export const KINDS = {
  spell: named('PHB'),
  feat: named('PHB'),
  optionalfeature: named('PHB'),
  class: named('PHB'),
  // A subclass: short name, class, class source, own source.
  subclass: {
    ofEntry: (entry) =>
      lower(
        [entry.shortName, entry.className, entry.classSource, entry.source].join('|'),
      ),
    ofUid: lower,
  },
  // "Rage|Barbarian||1": name, class, class source, level, own source.
  classFeature: {
    ofEntry: (entry) =>
      lower(
        [entry.name, entry.className, entry.classSource, entry.level, entry.source].join(
          '|',
        ),
      ),
    ofUid: (uid) => {
      const [name, className, classSource, level, source] = uid.split('|')
      const from = classSource || 'PHB'
      return lower([name, className, from, level, source || from].join('|'))
    },
  },
  // "Frenzy|Barbarian||Berserker||3": as above, with the subclass in the middle.
  subclassFeature: {
    ofEntry: (entry) =>
      lower(
        [
          entry.name,
          entry.className,
          entry.classSource,
          entry.subclassShortName,
          entry.subclassSource,
          entry.level,
          entry.source,
        ].join('|'),
      ),
    ofUid: (uid) => {
      const [name, className, classSource, subclass, subclassSource, level, source] =
        uid.split('|')
      const from = subclassSource || 'PHB'
      return lower(
        [
          name,
          className,
          classSource || 'PHB',
          subclass,
          from,
          level,
          source || from,
        ].join('|'),
      )
    },
  },
  itemProperty: coded('PHB'),
  itemType: coded('PHB'),
  itemEntry: named('DMG'),
}

/** The feature lists of a class and of a subclass, which name features by uid. */
const FEATURE_LISTS = [
  { key: 'class', list: 'classFeatures', kind: 'classFeature' },
  { key: 'subclass', list: 'subclassFeatures', kind: 'subclassFeature' },
]

/** Entries inside a description that stand for another entry: `{ type, [prop]: uid }`. */
const REFERENCE_ENTRIES = {
  refClassFeature: { prop: 'classFeature', kind: 'classFeature' },
  refSubclassFeature: { prop: 'subclassFeature', kind: 'subclassFeature' },
  refOptionalfeature: { prop: 'optionalfeature', kind: 'optionalfeature' },
  refFeat: { prop: 'feat', kind: 'feat' },
}

const ITEM_KEYS = ['baseitem', 'item', 'itemGroup', 'magicvariant']
const ITEM_ENTRY_TAG = /\{#itemEntry ([^}]+)\}/g

/**
 * Vocabulary: entries that carry no SRD flag of their own and are kept when a
 * kept item uses them.
 *   - A weapon's properties: the SRDs describe the properties of the weapons they list.
 *   - An item's type: kept as a name only (`fields`), because the description of
 *     a type is the book's own text.
 *   - The text a family of items shares ("Potion of Resistance"): it is the
 *     description of the kept items that use it.
 */
const VOCABULARIES = [
  {
    file: 'items-base.json',
    kind: 'itemProperty',
    from: ITEM_KEYS,
    uids: (entry) =>
      [...(entry.property ?? []), ...(entry.inherits?.property ?? [])].map((property) =>
        typeof property === 'string' ? property : property.uid,
      ),
  },
  {
    file: 'items-base.json',
    kind: 'itemType',
    from: ITEM_KEYS,
    uids: (entry) => [entry.type, entry.typeAlt],
    fields: ['name', 'abbreviation', 'source', 'page'],
  },
  {
    file: 'items-base.json',
    kind: 'itemEntry',
    from: ITEM_KEYS,
    uids: (entry) =>
      [...JSON.stringify(entry).matchAll(ITEM_ENTRY_TAG)].map((match) => match[1]),
  },
]

/** Properties that list other entries by uid, written out in full. */
const UID_LISTS = ['reprintedAs']

/** Keys that point at art, tokens, sound and lore. */
const MEDIA_KEYS = new Set([
  'hasFluff',
  'hasFluffImages',
  'hasToken',
  'hasCardArt',
  'tokenCredit',
  'foundryTokenScale',
  'soundClip',
  'altArt',
])
/** Entry types that show a picture. */
const MEDIA_TYPES = new Set(['image', 'gallery'])

/** The book list: a book is listed when an SRD covers part of it. */
const BOOKS = {
  file: 'books.json',
  key: 'book',
  // The chapter list is the book's own; the cover is art on someone else's server.
  drop: ['contents', 'cover', 'coverCredit'],
}

/** Which classes and subclasses have each spell on their list. */
const SPELL_LOOKUP = 'generated/gendata-spell-source-lookup.json'

const INDEX_FILE = /(^|\/)(?:[\w-]+-)?index\.json$/

// ---- 1. Keep the SRD entries ----------------------------------------------

/** The SRD flag an entry carries, or undefined when no SRD covers it. */
export function srdFlag(entry, flags) {
  if (!isObject(entry)) return undefined
  return flags.find((flag) => Boolean(flagHolder(entry, flag)[flag]))
}

/**
 * The flagged entries of every file, as `path -> { key: entries }`. Only the
 * top-level arrays of a file hold entries; anything else in it is left out.
 */
export function selectEntries(files, flags) {
  const base = new Map()
  for (const [path, json] of files) {
    if (!isObject(json)) continue
    const kept = {}
    for (const [key, value] of Object.entries(json)) {
      if (!Array.isArray(value)) continue
      const entries = value.filter((entry) => srdFlag(entry, flags))
      if (entries.length > 0) kept[key] = structuredClone(entries)
    }
    if (Object.keys(kept).length > 0) base.set(path, kept)
  }
  return base
}

function* entriesOf(base, keys) {
  for (const kept of base.values()) {
    for (const [key, entries] of Object.entries(kept)) {
      if (!keys || keys.includes(key)) yield* entries
    }
  }
}

/** Add the vocabulary entries that kept entries use. */
export function addVocabulary(base, files) {
  for (const { file, kind, from, uids, fields } of VOCABULARIES) {
    const wanted = new Set()
    for (const entry of entriesOf(base, from)) {
      for (const uid of uids(entry)) if (uid) wanted.add(KINDS[kind].ofUid(uid))
    }
    const used = (files.get(file)?.[kind] ?? []).filter((entry) =>
      wanted.has(KINDS[kind].ofEntry(entry)),
    )
    if (used.length === 0) continue
    const kept = base.get(file) ?? {}
    kept[kind] = structuredClone(used).map((entry) =>
      fields
        ? Object.fromEntries(
            Object.entries(entry).filter(([key]) => fields.includes(key)),
          )
        : entry,
    )
    base.set(file, kept)
  }
}

// ---- 2. Take out what points nowhere --------------------------------------

/**
 * A test for "is the entry this uid names kept?". Ask for a kind when the uid
 * may leave parts out ("Rage|Barbarian||1"); ask without one (`ANY_KIND`) when
 * the uid is written out in full and could name an entry of any kind.
 */
export const ANY_KIND = undefined
export function keptIndex(base) {
  const sets = new Map()
  const add = (kind, identity) =>
    sets.set(kind, (sets.get(kind) ?? new Set()).add(identity))
  for (const kept of base.values()) {
    for (const [key, entries] of Object.entries(kept)) {
      const kind = KINDS[key] ?? named()
      for (const entry of entries) {
        add(key, kind.ofEntry(entry))
        add(ANY_KIND, kind.ofEntry(entry))
      }
    }
  }
  return (kind, uid) => {
    if (typeof uid !== 'string') return false
    const identity = kind === ANY_KIND ? lower(uid) : KINDS[kind].ofUid(uid)
    return sets.get(kind)?.has(identity) ?? false
  }
}

/** Copy a value without the array items and properties that `drop` picks out. */
export function strip(value, drop) {
  if (Array.isArray(value)) {
    return value.filter((item) => !drop(item)).map((item) => strip(item, drop))
  }
  if (!isObject(value)) return value
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (!drop(item, key)) out[key] = strip(item, drop)
  }
  return out
}

/**
 * Remove the references whose target was not kept (in feature lists, in uid
 * lists and in descriptions), and every pointer to media. A class keeps the
 * references that mark the level a subclass feature is gained at, whatever they
 * name: the level matters, not the feature. Returns the references taken out.
 */
export function removeDangling(base) {
  const has = keptIndex(base)
  const removed = []

  for (const kept of base.values()) {
    for (const { key, list, kind } of FEATURE_LISTS) {
      for (const entry of kept[key] ?? []) {
        if (!Array.isArray(entry[list])) continue
        entry[list] = entry[list].filter((reference) => {
          if (isObject(reference) && reference.gainSubclassFeature === true) return true
          const uid = typeof reference === 'string' ? reference : reference[kind]
          if (has(kind, uid)) return true
          removed.push(`${labelOf(entry)}: ${uid}`)
          return false
        })
      }
    }
  }

  for (const entry of entriesOf(base)) {
    for (const holder of [entry, entry.inherits]) {
      for (const list of UID_LISTS) {
        if (!Array.isArray(holder?.[list])) continue
        const kept = holder[list].filter((reference) => {
          const uid = isObject(reference) ? reference.uid : reference
          if (has(ANY_KIND, uid)) return true
          removed.push(`${labelOf(entry)}: ${list} ${uid}`)
          return false
        })
        if (kept.length > 0) holder[list] = kept
        else delete holder[list]
      }
    }
  }

  const drop = (owner) => (value, key) => {
    if (key !== undefined && MEDIA_KEYS.has(key)) return true
    if (!isObject(value)) return false
    if (MEDIA_TYPES.has(value.type)) return true
    const reference = REFERENCE_ENTRIES[value.type]
    if (!reference || has(reference.kind, value[reference.prop])) return false
    removed.push(`${labelOf(owner)}: ${value[reference.prop]}`)
    return true
  }
  for (const kept of base.values()) {
    for (const [key, entries] of Object.entries(kept)) {
      kept[key] = entries.map((entry) => strip(entry, drop(entry)))
    }
  }
  return removed
}

// ---- 3. Use the SRD's names -----------------------------------------------

/**
 * Where a flag holds a name instead of `true`, the SRD calls the entry by that
 * name ("Tasha's Hideous Laughter" is "Hideous Laughter" in the SRD). Collect
 * those as aliases, once each (an item and its deck share a name), and leave a
 * plain `true` behind: after renaming, the entry's name is the SRD's name.
 */
export function collectAliases(base, flags) {
  const aliases = []
  for (const entry of entriesOf(base)) {
    for (const flag of flags) {
      const holder = flagHolder(entry, flag)
      const to = holder[flag]
      if (typeof to !== 'string') continue
      holder[flag] = true
      const alias = { name: entry.name, source: sourceOf(entry), flag, to }
      const known = aliases.some((other) =>
        Object.keys(alias).every((key) => other[key] === alias[key]),
      )
      if (to !== entry.name && !known) aliases.push(alias)
    }
  }
  return aliases
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Text after a name up to the source that follows it: "…|XPHB" in a tag or a uid.
const SOURCE_AFTER = /^[^|{}]*\|([\w-]+)/

/**
 * Build the function that rewrites one piece of text to the SRD's names.
 *
 * A name is renamed wherever it appears: as an entry's own name, in a tag
 * (`{@spell Melf's Acid Arrow|XPHB}`), in a uid, in a caption. Which SRD name
 * applies depends on the source, because a name can differ between the SRDs:
 *   - a source written after the name decides, when one is;
 *   - otherwise the SRD of the entry holding the text (`flag`) does.
 * A name the SRD in question does not rename is left as it is.
 */
export function renamer(aliases) {
  const byName = new Map()
  for (const alias of aliases) {
    const key = lower(alias.name)
    byName.set(key, [...(byName.get(key) ?? []), alias])
  }
  if (byName.size === 0) return Object.assign((text) => text, { names: undefined })

  // Longest first, so "Quaal's Feather Token, Anchor" wins over "Quaal's Feather Token".
  const names = [...byName.keys()].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(names.map(escapeRegExp).join('|'), 'gi')

  const rename = (text, flag) =>
    text.replace(pattern, (found, offset) => {
      const source = SOURCE_AFTER.exec(text.slice(offset + found.length))?.[1]
      const candidates = byName
        .get(lower(found))
        .filter((alias) =>
          source ? lower(alias.source) === lower(source) : !flag || alias.flag === flag,
        )
      const targets = new Set(candidates.map((alias) => alias.to))
      if (targets.size !== 1) return found
      const [to] = targets
      // A lower-case mention ("melf's acid arrow|xphb") stays lower-case.
      return found === lower(found) ? lower(to) : to
    })
  return Object.assign(rename, { names: pattern })
}

/** Copy a value with every piece of text in it, keys included, passed through `change`. */
export function mapText(value, change) {
  if (typeof value === 'string') return change(value)
  if (Array.isArray(value)) return value.map((item) => mapText(item, change))
  if (!isObject(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [change(key), mapText(item, change)]),
  )
}

/** Rename everything in the base to the SRD's names. */
export function applyRenames(base, rename, flags) {
  for (const kept of base.values()) {
    for (const [key, entries] of Object.entries(kept)) {
      kept[key] = entries.map((entry) => {
        const flag = srdFlag(entry, flags)
        return mapText(entry, (text) => rename(text, flag))
      })
    }
  }
}

// ---- 4. Files that describe other files -----------------------------------

/** The books an SRD covers part of, without their chapter list and cover. */
export function reduceBooks(books, sources) {
  return books
    .filter((book) => sources.has(book.source))
    .map((book) =>
      Object.fromEntries(
        Object.entries(book).filter(([key]) => !BOOKS.drop.includes(key)),
      ),
    )
}

// Copy `group` (nested objects, `depth` levels of keys) keeping the leaves that
// `keep` accepts; a branch left empty is dropped. Returns undefined when nothing is kept.
function pick(group, depth, keep, path = []) {
  if (!isObject(group)) return undefined
  const out = {}
  for (const [key, value] of Object.entries(group)) {
    const here = [...path, key]
    const kept =
      depth === 1
        ? keep(here, value)
          ? value
          : undefined
        : pick(value, depth - 1, keep, here)
    if (kept !== undefined) out[key] = kept
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * The spell lookup, `source -> spell name -> who has the spell`, cut down to
 * the kept spells and to the kept classes and subclasses that have them. The
 * other groups in the lookup (feats, species, backgrounds and so on) name their
 * entries in ways that cannot be matched to what was kept, and are left out.
 */
export function reduceSpellLookup(lookup, { has, rename, sources }) {
  const out = {}
  for (const [source, spells] of Object.entries(lookup)) {
    for (const [name, groups] of Object.entries(spells)) {
      const [srdName] = rename(`${name}|${source}`).split('|')
      if (!has('spell', `${srdName}|${source}`)) continue
      const entry = {}
      // class source -> class -> true, or the other books that add the spell to its list.
      const classes = pick(
        groups.class,
        2,
        ([classSource, className], value) =>
          has('class', `${className}|${classSource}`) &&
          (!isObject(value) ||
            !Array.isArray(value.definedInSources) ||
            value.definedInSources.some((definer) => sources.has(definer))),
      )
      if (classes) entry.class = classes
      // class source -> class -> subclass source -> subclass short name.
      const subclasses = pick(
        groups.subclass,
        4,
        ([classSource, className, subclassSource, shortName]) =>
          has('subclass', [shortName, className, classSource, subclassSource].join('|')),
      )
      if (subclasses) entry.subclass = subclasses
      if (Object.keys(entry).length > 0) (out[source] ??= {})[srdName] = entry
    }
  }
  return out
}

/** An index names the files of its folder: keep the names of the kept files. */
export function reduceIndex(path, index, keptPaths) {
  const folder = path.slice(0, path.lastIndexOf('/') + 1)
  return Object.fromEntries(
    Object.entries(index).filter(
      ([, file]) => typeof file === 'string' && keptPaths.has(folder + file),
    ),
  )
}

// ---- Checks ---------------------------------------------------------------

function walkText(value, visit) {
  if (typeof value === 'string') return visit(value)
  if (Array.isArray(value)) return value.forEach((item) => walkText(item, visit))
  if (!isObject(value)) return
  for (const [key, item] of Object.entries(value)) {
    visit(key)
    walkText(item, visit)
  }
}

/**
 * What must never be published: an entry built on another entry (`_copy`),
 * which would arrive incomplete, and a name the SRD replaced that is still
 * written somewhere and is not the SRD name of another kept entry.
 */
export function findProblems(base, rename) {
  const problems = []
  const keptNames = new Set()
  for (const entry of entriesOf(base)) {
    if (typeof entry.name === 'string') keptNames.add(lower(entry.name))
  }
  for (const [path, kept] of base) {
    for (const [key, entries] of Object.entries(kept)) {
      for (const entry of entries) {
        const where = `${path} ${key} ${labelOf(entry)}`
        if (JSON.stringify(entry).includes('"_copy"')) {
          problems.push(`${where}: is built on another entry (_copy)`)
        }
        if (!rename.names) continue
        walkText(entry, (text) => {
          for (const [found] of text.matchAll(rename.names)) {
            if (!keptNames.has(lower(found))) {
              problems.push(`${where}: still says "${found}" in "${text.slice(0, 120)}"`)
            }
          }
        })
      }
    }
  }
  return problems
}

// ---- The whole build ------------------------------------------------------

/**
 * Reduce the full data to the free rules.
 *
 * @param files  `path -> parsed JSON` of the full data folder
 * @param flags  the entry flags that mark SRD content, e.g. ['srd', 'srd52']
 * @returns `files`: `path -> JSON` to publish; `report`: what was done, and the
 *          `problems` that must stop the result from being published
 */
export function buildBase(files, flags) {
  const base = selectEntries(files, flags)
  const sources = new Set([...entriesOf(base)].map(sourceOf).filter(Boolean))
  addVocabulary(base, files)
  const removed = removeDangling(base)
  const aliases = collectAliases(base, flags)
  const rename = renamer(aliases)
  applyRenames(base, rename, flags)

  const out = new Map()
  for (const [path, kept] of base) {
    // Keys in the order the full file has them.
    const ordered = Object.keys(files.get(path)).filter((key) => kept[key])
    out.set(path, Object.fromEntries(ordered.map((key) => [key, kept[key]])))
  }

  const books = reduceBooks(files.get(BOOKS.file)?.[BOOKS.key] ?? [], sources)
  if (books.length > 0) out.set(BOOKS.file, { [BOOKS.key]: books })

  const lookup = reduceSpellLookup(files.get(SPELL_LOOKUP) ?? {}, {
    has: keptIndex(base),
    rename,
    sources,
  })
  if (Object.keys(lookup).length > 0) out.set(SPELL_LOOKUP, lookup)

  const keptPaths = new Set(out.keys())
  for (const [path, json] of files) {
    if (!INDEX_FILE.test(path) || !isObject(json)) continue
    const index = reduceIndex(path, json, keptPaths)
    if (Object.keys(index).length > 0) out.set(path, index)
  }

  return {
    files: new Map([...out].sort(([a], [b]) => a.localeCompare(b))),
    report: {
      sources: [...sources].sort(),
      renamed: aliases.map(
        ({ name, source, to }) => `${name}|${source} is "${to}" in the SRD`,
      ),
      removed,
      problems: findProblems(base, rename),
    },
  }
}

/** The notice published beside the data: which documents it comes from, and their license. */
export function licenseNotice(srd) {
  return [
    '# Free rules',
    'The files in this folder hold material from the documents below. Each entry carries the flag of the document it comes from.',
    ...srd.documents.flatMap((document) => [
      `## ${document.name} (flag: ${document.flag})`,
      document.attribution,
    ]),
    '## Changes',
    srd.changes,
  ]
    .join('\n\n')
    .concat('\n')
}
