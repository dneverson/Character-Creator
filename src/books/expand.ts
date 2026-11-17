// The stat blocks of a book that stand for a whole chapter of text. The text of a book
// only names a class or a subclass (`{"type":"statblock","tag":"class","name":"Barbarian"}`)
// where the printed book has pages: the class's introduction, its table, every feature in
// level order and its subclasses. This writes that text in place of the name, from the
// class data the app already loads (`loadClasses`) and the descriptions it already reads
// (`loadFluff`), so its headings reach the book's contents and the search, which both read
// the text. A name the data does not hold stays as it is and is drawn like any stat block.

import {
  loadClasses,
  resolveClassFeatures,
  resolveSubclassFeatures,
  subclassesFor,
  type LoadedClass,
  type ResolvedFeature,
  type SubclassEntry,
} from '../data/class'
import { loadClassOptions, type ClassOption } from '../data/classOptions'
import { buildLevelTable, type LevelTableModel } from '../derived/classLevelTable'
import type { Entry } from '../text/Entries'
import { slugOf } from './outline'
import { loadFluff, type Fluff } from './statblock'

type Json = Record<string, unknown>

const isJson = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/** Whether a stat block stands for a class or a subclass (a book names one either way). */
const isClassBlock = (node: Json) => node.type === 'statblock' && node.tag === 'class'
const isSubclassBlock = (node: Json) =>
  node.type === 'statblock' && (node.tag === 'subclass' || node.prop === 'subclass')

/** The blocks of a text that are to be written out, in the order the text has them. */
function blocksOf(node: unknown, found: Json[] = []): Json[] {
  if (Array.isArray(node)) node.forEach((child) => blocksOf(child, found))
  else if (isJson(node)) {
    if (isClassBlock(node) || isSubclassBlock(node)) found.push(node)
    else Object.values(node).forEach((child) => blocksOf(child, found))
  }
  return found
}

/** The records a feature of the class data may point at, by the text of the pointer. */
interface Pool {
  loaded: LoadedClass
  options: readonly ClassOption[]
}

const optionOf = (pool: Pool, ref: string): ClassOption | undefined => {
  const [name = '', source] = ref.split('|')
  const same = pool.options.filter((o) => o.name.toLowerCase() === name.toLowerCase())
  return (
    same.find((o) => o.source === source) ??
    same.find((o) => o.source === 'PHB') ??
    same.find((o) => o.source === 'XPHB') ??
    same[0]
  )
}

/** The feature record a class or subclass feature pointer names. */
function featureOf(
  pool: Pool,
  entry: Json,
): { name: string; entries: Entry[] } | undefined {
  const { file } = pool.loaded
  const classRef = text(entry.classFeature)
  if (entry.type === 'refClassFeature' && classRef) {
    const [name = '', className = '', , level = ''] = classRef.split('|')
    return file.classFeature?.find(
      (f) => f.name === name && f.className === className && String(f.level) === level,
    )
  }
  const subRef = text(entry.subclassFeature)
  if (entry.type === 'refSubclassFeature' && subRef) {
    const [name = '', className = '', , short = '', , level = ''] = subRef.split('|')
    return file.subclassFeature?.find(
      (f) =>
        f.name === name &&
        f.className === className &&
        f.subclassShortName === short &&
        String(f.level) === level,
    )
  }
  const optionRef = text(entry.optionalfeature)
  if (entry.type === 'refOptionalfeature' && optionRef) return optionOf(pool, optionRef)
  return undefined
}

/**
 * The text of a feature with what it points at written in: an option of a feature
 * (a fighting style, a totem), and the `options` wrapper (a list of choices) as plain
 * entries. A pointer that is not found is dropped.
 */
function written(
  entries: readonly Entry[],
  pool: Pool,
  seen: readonly object[] = [],
): Entry[] {
  return entries.flatMap((entry): Entry[] => {
    if (!isJson(entry)) return [entry]
    const record = featureOf(pool, entry)
    if (/^ref/.test(String(entry.type))) {
      if (!record || seen.includes(record)) return []
      const inner = written(record.entries, pool, [...seen, record])
      return [{ type: 'entries', name: record.name, entries: inner }]
    }
    const children = Array.isArray(entry.entries) ? (entry.entries as Entry[]) : undefined
    if (!children) return [entry]
    const inner = written(children, pool, seen)
    return [
      entry.type === 'options'
        ? { type: 'entries', entries: inner }
        : { ...entry, entries: inner },
    ]
  })
}

/** A header cell of a table of the book's text, spanning `width` columns. */
const head = (entry: string, width = 1): Entry =>
  width > 1 ? { type: 'cellHeader', entry, width } : { type: 'cellHeader', entry }

/** A class's level table as a table of the book's text. */
function tableOf(model: LevelTableModel, caption: string): Entry {
  const runs: { group: string; width: number }[] = []
  for (const column of model.columns) {
    const last = runs[runs.length - 1]
    if (column.group !== undefined && last?.group === column.group) last.width++
    else runs.push({ group: column.group ?? '', width: 1 })
  }
  const grouped = model.columns.some((column) => column.group !== undefined)
  return {
    type: 'table',
    caption,
    ...(grouped
      ? {
          // The heading of the spell slots over their columns, nothing over the others.
          colLabelRows: [
            runs.map((run) => head(run.group, run.width)),
            model.columns.map((column) => head(column.label)),
          ],
        }
      : { colLabels: model.columns.map((column) => column.label) }),
    colStyles: model.columns.map((column) => (column.features ? '' : 'text-center')),
    rows: model.rows.map((row) => row.cells),
  }
}

/** The features of a class or subclass in level order, each as a named part. */
function featureParts(
  byLevel: Map<number, ResolvedFeature[]>,
  pool: Pool,
  source: string,
  intro?: string,
): { lead: Entry[]; parts: Entry[] } {
  const lead: Entry[] = []
  const parts: Entry[] = []
  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    for (const feature of byLevel.get(level) ?? []) {
      if (feature.isSubclassSlot) continue
      const body = written(feature.entries, pool)
      // A feature that bears its subclass's name is that subclass's own introduction.
      if (intro && slugOf(feature.name) === slugOf(intro)) lead.push(...body)
      else
        parts.push({
          type: 'entries',
          name: feature.name,
          // The page the feature is printed on, in the book the data's record is of.
          ...(feature.page !== undefined &&
            feature.source === source && { page: feature.page }),
          entries: body,
        })
    }
  }
  return { lead, parts }
}

/** The introduction a description holds: its section of the thing's own name, unwrapped. */
function introOf(
  fluff: Fluff | undefined,
  name: string,
): { entries: Entry[]; page?: number } {
  const first = fluff?.entries?.[0]
  if (
    isJson(first) &&
    first.type === 'section' &&
    slugOf(text(first.name) ?? '') === slugOf(name)
  ) {
    const page = typeof first.page === 'number' ? first.page : undefined
    return {
      entries: [
        ...((first.entries as Entry[]) ?? []),
        ...(fluff?.entries?.slice(1) ?? []),
      ],
      page,
    }
  }
  return { entries: fluff?.entries ?? [] }
}

function subclassNode(
  pool: Pool,
  subclass: SubclassEntry,
  name: string,
  page?: number,
): Entry {
  const features = resolveSubclassFeatures(pool.loaded.file, subclass)
  const { lead, parts } = featureParts(features, pool, subclass.source, subclass.name)
  const model = subclass.subclassTableGroups
    ? buildLevelTable(subclass.subclassTableGroups, features)
    : undefined
  return {
    type: 'entries',
    name,
    ...((page ?? subclass.page) !== undefined && { page: page ?? subclass.page }),
    entries: [
      ...lead,
      ...(model ? [tableOf(model, `The ${subclass.name}`)] : []),
      ...parts,
    ],
  }
}

/** The class's subclasses of the source the book is of, less the ones the book names itself. */
function ownSubclasses(loaded: LoadedClass, source: string, named: Set<string>) {
  return subclassesFor(loaded).filter(
    (s) =>
      s.source === source && !named.has(`${s.className}|${s.shortName}`.toLowerCase()),
  )
}

async function classNodeOf(
  block: Json,
  docId: string,
  classes: readonly LoadedClass[],
  options: readonly ClassOption[],
  named: Set<string>,
  withFluff: boolean,
): Promise<Entry | undefined> {
  const name = text(block.name) ?? ''
  const source = text(block.source) ?? docId
  const loaded =
    classes.find((c) => c.entry.name === name && c.entry.source === source) ??
    classes.find(
      (c) =>
        c.entry.name.toLowerCase() === name.toLowerCase() && c.entry.source === source,
    )
  if (!loaded) return undefined
  const pool: Pool = { loaded, options }
  const features = resolveClassFeatures(loaded)
  const { parts } = featureParts(features, pool, source)
  const fluff = withFluff
    ? await loadFluff('classFluff', name, source).catch(() => undefined)
    : undefined
  const intro = introOf(fluff, name)
  const subclasses = ownSubclasses(loaded, source, named).map((s) =>
    subclassNode(pool, s, s.name),
  )
  return {
    type: 'entries',
    name: text(block.displayName) ?? name,
    ...((intro.page ?? loaded.entry.page) !== undefined && {
      page: intro.page ?? loaded.entry.page,
    }),
    entries: [
      ...intro.entries,
      tableOf(buildLevelTable(loaded.entry.classTableGroups, features), `The ${name}`),
      { type: 'entries', name: 'Class Features', entries: parts },
      ...subclasses,
    ],
  }
}

async function subclassNodeOf(
  block: Json,
  classes: readonly LoadedClass[],
  options: readonly ClassOption[],
): Promise<Entry | undefined> {
  const className = text(block.className) ?? ''
  const classSource = text(block.classSource) ?? ''
  const loaded = classes.find(
    (c) => c.entry.name === className && c.entry.source === classSource,
  )
  const short = text(block.shortName) ?? text(block.name)
  const subclass = loaded?.file.subclass?.find(
    (s) =>
      s.shortName === short &&
      s.source === text(block.source) &&
      s.className === className,
  )
  if (!loaded || !subclass) return undefined
  const name = text(block.displayName) ?? text(block.name) ?? subclass.name
  return subclassNode(
    { loaded, options },
    subclass,
    name,
    typeof block.page === 'number' ? block.page : undefined,
  )
}

/** The same value with each of `replaced` swapped in; only what holds one is copied. */
export function replace(node: unknown, replaced: Map<object, Entry>): unknown {
  if (Array.isArray(node)) {
    const next = node.map((child) => replace(child, replaced))
    return next.some((child, i) => child !== node[i]) ? next : node
  }
  if (!isJson(node)) return node
  const swapped = replaced.get(node)
  if (swapped) return swapped
  let copy: Json | undefined
  for (const [key, child] of Object.entries(node)) {
    const next = replace(child, replaced)
    if (next !== child) (copy ??= { ...node })[key] = next
  }
  return copy ?? node
}

/**
 * The sections of a book with its class and subclass stat blocks written out. A book
 * with none, or whose class data cannot be read, is returned as it is.
 */
export async function expandBook(sections: Entry[], docId: string): Promise<Entry[]> {
  const blocks = blocksOf(sections)
  if (blocks.length === 0) return sections
  try {
    const [classes, options] = await Promise.all([loadClasses(), loadClassOptions()])
    // The subclasses the book lists by themselves are not also written under their class.
    const named = new Set(
      blocks
        .filter(isSubclassBlock)
        .map((b) =>
          `${text(b.className)}|${text(b.shortName) ?? text(b.name)}`.toLowerCase(),
        ),
    )
    // A description of the class the book prints itself is not written a second time.
    const described = new Set(
      JSON.stringify(sections).includes('"prop":"classFluff"')
        ? blocksOfProp(sections, 'classFluff').map((b) => text(b.name)?.toLowerCase())
        : [],
    )
    const replaced = new Map<object, Entry>()
    await Promise.all(
      blocks.map(async (block) => {
        const entry = isClassBlock(block)
          ? await classNodeOf(
              block,
              docId,
              classes,
              options,
              named,
              !described.has(text(block.name)?.toLowerCase()),
            )
          : await subclassNodeOf(block, classes, options)
        if (entry) replaced.set(block, entry)
      }),
    )
    return replaced.size > 0 ? (replace(sections, replaced) as Entry[]) : sections
  } catch {
    return sections
  }
}

/** The stat blocks of a text that stand for the description `prop` names. */
function blocksOfProp(node: unknown, prop: string, found: Json[] = []): Json[] {
  if (Array.isArray(node)) node.forEach((child) => blocksOfProp(child, prop, found))
  else if (isJson(node)) {
    if (node.type === 'statblock' && node.prop === prop) found.push(node)
    else Object.values(node).forEach((child) => blocksOfProp(child, prop, found))
  }
  return found
}
