// The class options against the book data in `.local/data` (skipped without it): every
// progression of optional features of every class, subclass, feat and option, in both
// editions, is offered at the right count at every level, every kind of option is
// reachable, and every list of options in a feature's text is offered or explained.

import { describe, expect, it, vi } from 'vitest'
import { createCharacter } from '../character/model'
import { loadClasses, subclassesFor, type LoadedClass } from '../data/class'
import {
  loadClassOptions,
  readProgressions,
  type ClassOption,
} from '../data/classOptions'
import { loadBookEditions } from '../data/edition'
import { loadFeats } from '../data/feats'
import {
  FEATURE_CHOICE_FOLLOWS,
  FEATURE_OPTIONS_NOT_CHOSEN,
} from '../rules/featureChoices'
import { dataDir, records, type Rec } from '../test/dataAudit'
import { featureChoiceSlots, optionCards, optionSlots } from './classOptions'
import { collectSources, type DeriveDeps, type HeldFeat } from './sources'

vi.mock('./../data/dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(readFileSync(`.local/data/${path}`, 'utf8'))),
  }
})

/**
 * Kinds of option no class, subclass or feat of the books offers, with why. The audit
 * fails when one of them becomes offered, so the list stays true.
 */
const TYPES_NOT_OFFERED: Record<string, string> = {
  RP: 'Dragonmarked House renown (EFA): the DM awards it in play; no class, subclass or feat grants it',
}

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1)

/** The count a progression gives at a level, read the way the books' tables print it. */
function bookCount(
  progression: number[] | Record<string, number>,
  level: number,
): number {
  if (Array.isArray(progression))
    return progression[Math.min(level, progression.length) - 1]
  if ('*' in progression) return progression['*']
  const reached = Object.keys(progression)
    .map(Number)
    .filter((at) => at <= level)
  return reached.length === 0 ? 0 : progression[String(Math.max(...reached))]
}

const isRec = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Every options block in a record's own text (not through the features it references). */
function optionBlocks(entries: unknown): Rec[][] {
  const out: Rec[][] = []
  const walk = (e: unknown) => {
    if (Array.isArray(e)) return e.forEach(walk)
    if (!isRec(e)) return
    if (e.type === 'options' && Array.isArray(e.entries))
      out.push(e.entries.filter(isRec))
    walk(e.entries)
  }
  walk(entries)
  return out
}

/** A feature record's identity as the holder table writes it. */
function featureId(collection: string, r: Rec): string {
  const s = (v: unknown, fallback = 'PHB') => (typeof v === 'string' && v ? v : fallback)
  return collection === 'classFeature'
    ? `classFeature|${s(r.name)}|${s(r.classSource)}|${s(r.className)}`
    : `subclassFeature|${s(r.name)}|${s(r.subclassSource)}|${s(r.className)}|${s(r.subclassShortName)}`
}

describe.skipIf(!dataDir)('class options against the data', async () => {
  const classes: LoadedClass[] = dataDir ? await loadClasses() : []
  const catalog: ClassOption[] = dataDir ? await loadClassOptions() : []
  const feats = dataDir ? await loadFeats() : []
  const editionOf = dataDir ? await loadBookEditions() : undefined
  const deps: DeriveDeps = {
    classByKey: new Map(classes.map((c) => [`${c.entry.name}|${c.entry.source}`, c])),
    optionCatalog: catalog,
    editionOf,
  }
  const books = [...new Set(catalog.map((o) => o.source))]

  /** Each class alone, and with each of the subclasses it offers. */
  const builds = classes.flatMap((loaded) => [
    { loaded, subclass: undefined },
    ...subclassesFor(loaded).map((subclass) => ({ loaded, subclass })),
  ])

  it('offers every class and subclass progression at its count at every level', () => {
    const wrong: string[] = []
    let checked = 0
    for (const { loaded, subclass } of builds) {
      const progressions = [
        ...(loaded.entry.optionalfeatureProgression ?? []),
        ...(subclass?.optionalfeatureProgression ?? []),
      ]
      if (progressions.length === 0) continue
      const { name, source } = loaded.entry
      for (const level of LEVELS) {
        const c = createCharacter('Audit')
        c.selectedBooks = books
        c.classes = [
          {
            name,
            source,
            level,
            ...(subclass
              ? {
                  subclass: {
                    name: subclass.name,
                    shortName: subclass.shortName,
                    source: subclass.source,
                  },
                }
              : {}),
          },
        ]
        const sources = collectSources(c, deps)
        const cards = optionCards(sources, deps)
        const want = new Map<string, number>()
        for (const p of progressions) {
          const key = p.featureType.join(',')
          want.set(key, (want.get(key) ?? 0) + bookCount(p.progression, level))
        }
        for (const [key, count] of want) {
          checked += 1
          const tag = `class:${name}|${source}|${key}`
          const slot = sources.optionSlots.find((s) => s.tag === tag)
          const who = `${name} ${source}${subclass ? ` (${subclass.shortName})` : ''} ${level}`
          if ((slot?.count ?? 0) !== count)
            wrong.push(`${who} ${key}: ${slot?.count} not ${count}`)
          const card = cards.find((x) => x.tag === tag)
          if (count > 0 && !card?.chips.length)
            wrong.push(`${who} ${key}: no options offered`)
        }
      }
    }
    expect(wrong).toEqual([])
    expect(checked).toBeGreaterThan(300)
  })

  it('offers every feat progression at its count at every level', () => {
    const wrong: string[] = []
    const withOptions = feats.filter(
      (f) => readProgressions(f.optionalfeatureProgression).length,
    )
    expect(withOptions.map((f) => f.name).sort()).toEqual(
      expect.arrayContaining(['Eldritch Adept', 'Fighting Initiate', 'Martial Adept']),
    )
    for (const feat of withOptions) {
      const held: HeldFeat = {
        feat,
        source: { kind: 'feat', tag: 'feat:audit', label: feat.label },
      }
      for (const level of LEVELS) {
        const c = createCharacter('Audit')
        c.classes = [{ name: 'Fighter', source: 'PHB', level }]
        const sources = collectSources(c, deps)
        const slots = optionSlots(c, sources.classes, [held], catalog)
        for (const p of readProgressions(feat.optionalfeatureProgression)) {
          const slot = slots.find(
            (s) => s.tag === `feat:audit|${p.featureType.join(',')}`,
          )
          const count = bookCount(p.progression, level)
          if (slot?.count !== count)
            wrong.push(`${feat.name} ${level}: ${slot?.count} not ${count}`)
        }
      }
    }
    expect(wrong).toEqual([])
  })

  it('counts what an option teaches into the slot of its owner', () => {
    const teaching = catalog.filter((o) => o.optionalfeatureProgression)
    expect(teaching.map((o) => o.key)).toContain('Superior Technique|TCE')
    for (const option of teaching) {
      const c = createCharacter('Audit')
      c.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
      c.classOptions = { 'class:Fighter|PHB|FS:F': [option.key] }
      const sources = collectSources(c, deps)
      for (const p of option.optionalfeatureProgression ?? []) {
        const slot = sources.optionSlots.find(
          (s) => s.tag === `class:Fighter|PHB|${p.featureType.join(',')}`,
        )
        expect(slot?.count).toBe(bookCount(p.progression, 1))
      }
    }
  })

  it('reaches every kind of option, but the ones listed with why', () => {
    const offered = new Set(
      [
        ...classes.flatMap((l) => [
          ...(l.entry.optionalfeatureProgression ?? []),
          ...(l.file.subclass ?? []).flatMap((s) => s.optionalfeatureProgression ?? []),
        ]),
        ...feats.flatMap((f) => readProgressions(f.optionalfeatureProgression)),
        ...catalog.flatMap((o) => o.optionalfeatureProgression ?? []),
      ].flatMap((p) => p.featureType),
    )
    const types = new Set(catalog.flatMap((o) => o.types))
    expect(
      [...types].filter((t) => !offered.has(t) && !(t in TYPES_NOT_OFFERED)),
    ).toEqual([])
    expect(Object.keys(TYPES_NOT_OFFERED).filter((t) => offered.has(t))).toEqual([])
  })

  it('covers every list of optional features in a feature by a progression of its class', () => {
    const typesOf = new Map(catalog.map((o) => [o.key.toLowerCase(), o.types]))
    const classTypes = (className: string) =>
      new Set(
        classes
          .filter((l) => l.entry.name === className)
          .flatMap((l) => [
            ...(l.entry.optionalfeatureProgression ?? []),
            ...(l.file.subclass ?? []).flatMap((s) => s.optionalfeatureProgression ?? []),
          ])
          .flatMap((p) => p.featureType),
      )
    const missing: string[] = []
    for (const { collection, record } of records(dataDir ?? '')) {
      if (collection !== 'classFeature' && collection !== 'subclassFeature') continue
      for (const block of optionBlocks(record.entries)) {
        for (const e of block) {
          if (e.type !== 'refOptionalfeature' || typeof e.optionalfeature !== 'string')
            continue
          const [name, source = 'PHB'] = e.optionalfeature.split('|')
          const types = typesOf.get(`${name}|${source}`.toLowerCase()) ?? []
          const have = classTypes(String(record.className))
          if (!types.some((t) => have.has(t)))
            missing.push(`${featureId(collection, record)}: ${e.optionalfeature}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('offers every list of features to choose from, or says why it is not a build choice', () => {
    const lists = new Set<string>()
    for (const { collection, record } of records(dataDir ?? '')) {
      if (collection !== 'classFeature' && collection !== 'subclassFeature') continue
      const blocks = optionBlocks(record.entries).filter(
        (b) => b.length > 0 && !b.some((e) => e.type === 'refOptionalfeature'),
      )
      if (blocks.length > 0) lists.add(featureId(collection, record))
    }
    const offered = new Set<string>()
    for (const { loaded, subclass } of builds) {
      const row = {
        name: loaded.entry.name,
        source: loaded.entry.source,
        level: 20,
        ...(subclass
          ? {
              subclass: {
                name: subclass.name,
                shortName: subclass.shortName,
                source: subclass.source,
              },
            }
          : {}),
      }
      for (const slot of featureChoiceSlots([{ row, loaded, level: 20 }])) {
        offered.add(slot.id)
        expect(slot.options.length, slot.id).toBeGreaterThan(1)
      }
    }
    const explained = new Set([
      ...Object.keys(FEATURE_OPTIONS_NOT_CHOSEN),
      ...Object.keys(FEATURE_CHOICE_FOLLOWS),
    ])
    // A list of plain text (The Third Eye) is never a card: it must be explained.
    expect(
      [...lists].filter((id) => !offered.has(id) && !explained.has(id)).sort(),
    ).toEqual([])
    // Every explanation names a list that is in the books and not offered as a card.
    expect([...explained].filter((id) => !lists.has(id))).toEqual([])
    expect(
      Object.keys(FEATURE_OPTIONS_NOT_CHOSEN).filter((id) => offered.has(id)),
    ).toEqual([])
    expect(offered.size).toBeGreaterThan(5)
  })
})
