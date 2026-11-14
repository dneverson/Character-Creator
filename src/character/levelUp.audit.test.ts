// Level up against the book data in `.local/data` (skipped without it): a character of every
// class of both editions gains each level from 1 to 20, choosing the first subclass of the
// books when the level asks, and at every level the steps are the ones the data gives:
// the subclass at the level that grants it, a feat step for each feature that grants a
// feat, the class options whose count grows, a spell step when what the class casts grows,
// and every feature of the level read out.

import { describe, expect, it, vi } from 'vitest'
import {
  loadClasses,
  resolveClassFeatures,
  resolveSubclassFeatures,
  subclassesFor,
  type LoadedClass,
  type ResolvedFeature,
} from '../data/class'
import { loadClassOptions, type ClassOption } from '../data/classOptions'
import { loadBookEditions } from '../data/edition'
import { loadFeats } from '../data/feats'
import type { DeriveDeps } from '../derived/sources'
import { dataDir } from '../test/dataAudit'
import { applyLevel, levelUpSteps } from './levelUp'
import { createCharacter, type Character } from './model'

vi.mock('./../data/dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(readFileSync(`.local/data/${path}`, 'utf8'))),
  }
})

/** The count a progression gives at a level, read the way the books' tables print it. */
function bookCount(
  progression: number[] | Record<string, number>,
  level: number,
): number {
  if (level < 1) return 0
  if (Array.isArray(progression))
    return progression[Math.min(level, progression.length) - 1]
  if ('*' in progression) return progression['*']
  const reached = Object.keys(progression)
    .map(Number)
    .filter((at) => at <= level)
  return reached.length === 0 ? 0 : progression[String(Math.max(...reached))]
}

/** Whether a feature grants a feat: an improvement, an epic boon, or a link to feats. */
const grantsFeat = (f: ResolvedFeature) =>
  f.name === 'Ability Score Improvement' ||
  f.name === 'Epic Boon' ||
  /\{@filter [^}]*\|feats\|[^}]*category=/.test(JSON.stringify(f.entries))

/** The class's casting numbers at a level, as its table prints them. */
const castingAt = (loaded: LoadedClass, level: number) =>
  level < 1
    ? ''
    : [
        loaded.entry.cantripProgression?.[level - 1],
        loaded.entry.spellsKnownProgression?.[level - 1],
        loaded.entry.preparedSpellsProgression?.[level - 1],
      ].join('/')

describe.skipIf(!dataDir)('level up against the data', async () => {
  const classes: LoadedClass[] = dataDir ? await loadClasses() : []
  const catalog: ClassOption[] = dataDir ? await loadClassOptions() : []
  const feats = dataDir ? await loadFeats() : []
  const editionOf = dataDir ? await loadBookEditions() : undefined
  const deps: DeriveDeps = {
    classByKey: new Map(classes.map((c) => [`${c.entry.name}|${c.entry.source}`, c])),
    optionCatalog: catalog,
    feats,
    editionOf,
  }
  const books = [
    ...new Set([
      ...classes.map((c) => c.entry.source),
      ...classes.flatMap((c) => subclassesFor(c).map((s) => s.source)),
      ...catalog.map((o) => o.source),
    ]),
  ]
  const playable = classes.filter((c) => c.entry.hd && subclassesFor(c).length > 0)

  it('asks at every level of every class for what the level gives', () => {
    const wrong: string[] = []
    let levels = 0
    for (const loaded of playable) {
      const { name, source } = loaded.entry
      const target = { name, source }
      const subclass = subclassesFor(loaded)[0]
      const classFeatures = resolveClassFeatures(loaded)
      const subclassFeatures = resolveSubclassFeatures(loaded.file, subclass)
      const progressions = [
        ...(loaded.entry.optionalfeatureProgression ?? []),
        ...(subclass.optionalfeatureProgression ?? []),
      ]
      const base = createCharacter('Audit')
      let character: Character = {
        ...base,
        selectedBooks: books,
        completedAt: 1,
        abilities: {
          str: { base: 15, other: 0 },
          dex: { base: 15, other: 0 },
          con: { base: 15, other: 0 },
          int: { base: 15, other: 0 },
          wis: { base: 15, other: 0 },
          cha: { base: 15, other: 0 },
        },
      }
      let unlocked = false
      for (let to = 1; to <= 20; to++) {
        levels += 1
        const who = `${name} ${source} ${to - 1} to ${to}`
        const level = applyLevel(character, target, deps.classByKey)
        let steps = levelUpSteps(character, level.draft, level, deps)
        let draft = level.draft

        const unlocksHere = classFeatures.get(to)?.some((f) => f.isSubclassSlot === true)
        if (steps.subclass !== (!!unlocksHere && !unlocked))
          wrong.push(`${who}: subclass step ${steps.subclass}`)
        if (steps.subclass) {
          // The player chooses the first subclass; its features join the level.
          unlocked = true
          draft = {
            ...draft,
            classes: draft.classes.map((c) => ({
              ...c,
              subclass: {
                name: subclass.name,
                shortName: subclass.shortName,
                source: subclass.source,
              },
            })),
          }
          steps = levelUpSteps(character, draft, level, deps)
        }
        if (unlocksHere) unlocked = true

        const features = [
          ...(classFeatures.get(to) ?? []).filter((f) => !f.isSubclassSlot),
          ...(unlocked ? (subclassFeatures.get(to) ?? []) : []),
        ]
        const featsWanted = features.filter(grantsFeat).length
        if (steps.featSlots.length !== featsWanted)
          wrong.push(`${who}: ${steps.featSlots.length} feat steps, not ${featsWanted}`)

        const shown = new Set(steps.features.map((f) => f.name))
        // A feature with no text of its own (a subclass's heading) has nothing to read.
        for (const f of features.filter((x) => x.entries.length > 0)) {
          if (!shown.has(f.name)) wrong.push(`${who}: feature ${f.name} not read out`)
        }

        const grown = new Set<string>()
        const total = new Map<string, [number, number]>()
        for (const p of progressions) {
          const key = p.featureType.join(',')
          const [was, is] = total.get(key) ?? [0, 0]
          total.set(key, [
            was + bookCount(p.progression, to - 1),
            is + bookCount(p.progression, to),
          ])
        }
        for (const [key, [was, is]] of total) {
          if (is > was) grown.add(`class:${name}|${source}|${key}`)
        }
        // A feature of the level that asks to choose between options it lists (Divine
        // Order) brings its own choice.
        for (const f of features) {
          const tag = `class:${name}|${source}|feature:${f.name}|${to}`
          if (steps.options.includes(tag)) grown.add(tag)
        }
        const offered = new Set(steps.options.filter((t) => t.startsWith('class:')))
        for (const tag of grown) {
          if (!offered.has(tag)) wrong.push(`${who}: option ${tag} not offered`)
        }
        for (const tag of offered) {
          if (!grown.has(tag)) wrong.push(`${who}: option ${tag} offered, not grown`)
        }

        if (
          loaded.entry.casterProgression &&
          castingAt(loaded, to) !== castingAt(loaded, to - 1) &&
          !steps.spells?.classKey
        )
          wrong.push(`${who}: no spell step though the class casts more`)

        character = { ...draft }
      }
    }
    expect(wrong).toEqual([])
    expect(playable.length).toBeGreaterThanOrEqual(24)
    expect(levels).toBe(playable.length * 20)
  })
})
