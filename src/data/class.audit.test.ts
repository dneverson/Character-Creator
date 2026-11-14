// The classes and subclasses against the book data in `.local/data` (skipped without it):
// every subclass a class offers is a whole record with its features, a character names
// each class and subclass by one key that finds exactly one record, and the sheet of every
// class with every one of its subclasses derives at the levels a subclass changes it.

import { describe, expect, it, vi } from 'vitest'
import { createCharacter, type Character, type ClassRef } from '../character/model'
import { deriveSheet } from '../derived'
import type { DeriveDeps } from '../derived/sources'
import { dataDir } from '../test/dataAudit'
import {
  featuresForClass,
  loadClasses,
  resolveSubclassFeatures,
  subclassesFor,
  type LoadedClass,
  type SubclassEntry,
} from './class'
import { loadClassOptions } from './classOptions'
import { loadBookEditions } from './edition'
import { loadFeats } from './feats'

vi.mock('./dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(readFileSync(`.local/data/${path}`, 'utf8'))),
  }
})

const classKey = (l: LoadedClass) => `${l.entry.name}|${l.entry.source}`

const pick = (s: SubclassEntry) => ({
  name: s.name,
  shortName: s.shortName,
  source: s.source,
})

describe.skipIf(!dataDir)('classes and subclasses against the data', async () => {
  const classes: LoadedClass[] = dataDir ? await loadClasses() : []
  const deps: DeriveDeps = {
    classByKey: new Map(classes.map((c) => [classKey(c), c])),
    optionCatalog: dataDir ? await loadClassOptions() : [],
    feats: dataDir ? await loadFeats() : [],
    editionOf: dataDir ? await loadBookEditions() : undefined,
  }
  const byKey = (key: string) => {
    const loaded = deps.classByKey.get(key)
    if (!loaded) throw new Error(`no class ${key}`)
    return loaded
  }
  const books = [
    ...new Set([
      ...classes.map((c) => c.entry.source),
      ...classes.flatMap((c) => subclassesFor(c).map((s) => s.source)),
    ]),
  ]
  const characterWith = (rows: ClassRef[]): Character => ({
    ...createCharacter('Audit'),
    selectedBooks: books,
    classes: rows,
  })

  it('gives every class a hit die and its features, a reprint included', () => {
    const wrong = classes
      .filter((c) => !c.entry.hd || !c.entry.classFeatures?.length || c.entry._copy)
      .map(classKey)
    // The sidekicks of Tasha's level by the creature's own hit dice, so have none.
    expect(wrong).toEqual([
      'Expert Sidekick|TCE',
      'Spellcaster Sidekick|TCE',
      'Warrior Sidekick|TCE',
    ])
  })

  it('offers only whole subclasses, each feature found in its class file', () => {
    const wrong: string[] = []
    let offered = 0
    for (const loaded of classes) {
      for (const s of subclassesFor(loaded)) {
        offered += 1
        const who = `${classKey(loaded)} ${s.name}|${s.source}`
        if (s._copy) wrong.push(`${who}: copy not resolved`)
        if (!Array.isArray(s.subclassFeatures) || s.subclassFeatures.length === 0) {
          wrong.push(`${who}: no features`)
          continue
        }
        const resolved = [...resolveSubclassFeatures(loaded.file, s).values()].flat()
        for (const f of resolved) {
          if (f.entries.length === 0) wrong.push(`${who}: ${f.name} ${f.level} not found`)
        }
      }
    }
    expect(wrong).toEqual([])
    expect(offered).toBeGreaterThan(150)
  })

  it('finds exactly one record for every class and subclass key', () => {
    const counts = new Map<string, number>()
    const count = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1)
    for (const loaded of classes) {
      count(classKey(loaded))
      for (const s of subclassesFor(loaded)) {
        count(`${classKey(loaded)} ${s.shortName}|${s.source}`)
      }
    }
    expect([...counts].filter(([, n]) => n > 1)).toEqual([])
  })

  it('offers the 2024 Artificer its own subclasses', () => {
    expect(subclassesFor(byKey('Artificer|EFA')).map((s) => s.shortName)).toContain(
      'Alchemist',
    )
  })

  // The owner's report: Druid (Circle of the Moon), Barbarian and Bard, which crashed
  // the sheet with "subclass.subclassFeatures is not iterable".
  it.each([
    ['2014', 'PHB', 'PHB', 'PHB'],
    ['2024', 'XPHB', 'XPHB', 'XPHB'],
    ['mixed', 'XPHB', 'PHB', 'XPHB'],
    ['the WoW Druid', 'WoW', 'XPHB', 'PHB'],
  ])('derives the %s Druid (Moon), Barbarian and Bard', (_, druid, barbarian, bard) => {
    const moon = subclassesFor(byKey(`Druid|${druid}`)).find(
      (s) => s.shortName === 'Moon',
    )
    if (!moon) throw new Error(`no Circle of the Moon for Druid|${druid}`)
    const rows: ClassRef[] = [
      { name: 'Druid', source: druid, level: 6, subclass: pick(moon) },
      { name: 'Barbarian', source: barbarian, level: 3 },
      { name: 'Bard', source: bard, level: 3 },
    ]
    for (const order of [
      rows,
      [rows[2], rows[0], rows[1]],
      [rows[1], rows[2], rows[0]],
    ]) {
      const sheet = deriveSheet(characterWith(order), deps)
      expect(sheet.checklist).toBeDefined()
    }
    const moonFeature = featuresForClass(byKey(`Druid|${druid}`), rows[0]).find(
      (f) => f.name === 'Circle of the Moon',
    )
    expect(moonFeature?.entries.length).toBeGreaterThan(0)
  })

  it('derives the sheet of every class with every subclass at levels 1, 3, 10 and 20', () => {
    const failed: string[] = []
    let sheets = 0
    for (const loaded of classes) {
      const { name, source } = loaded.entry
      for (const s of [undefined, ...subclassesFor(loaded)]) {
        for (const level of [1, 3, 10, 20]) {
          sheets += 1
          const row: ClassRef = { name, source, level, ...(s && { subclass: pick(s) }) }
          try {
            deriveSheet(characterWith([row]), deps)
          } catch (e) {
            failed.push(`${name}|${source} ${s?.shortName ?? '-'} ${level}: ${String(e)}`)
          }
        }
      }
    }
    expect(failed).toEqual([])
    expect(sheets).toBeGreaterThan(600)
    // Over 600 whole sheets: seconds of work, more under coverage, so not the default 5.
  }, 60_000)
})
