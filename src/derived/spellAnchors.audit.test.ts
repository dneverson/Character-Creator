// The counters of the spells the books let a character cast a number of times per rest,
// against the book data in `.local/data` (skipped without it): the counter of every such
// spell of a species, a background, a class or a subclass shows on a row of the Features
// tab; no counter is excused.

import { describe, expect, it, vi } from 'vitest'
import { resolveSpellGrants } from '../character/spellGrants'
import { createCharacter, type Character } from '../character/model'
import { loadBackgrounds } from '../data/background'
import { loadClasses, subclassesFor } from '../data/class'
import { loadRaces } from '../data/race'
import { dataDir } from '../test/dataAudit'
import { deriveSheet } from '.'
import type { DeriveDeps } from './sources'

vi.mock('./../data/dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  return {
    fetchData: (path: string): Promise<unknown> =>
      Promise.resolve(JSON.parse(readFileSync(`.local/data/${path}`, 'utf8'))),
  }
})

describe.skipIf(!dataDir)('granted-spell counters against the data', async () => {
  const classes = dataDir ? await loadClasses() : []
  const races = dataDir ? await loadRaces() : []
  const backgrounds = dataDir ? await loadBackgrounds() : []
  const classByKey = new Map(classes.map((c) => [`${c.entry.name}|${c.entry.source}`, c]))

  let checked = 0

  /** The counters without a row, one build at a time, once for each named set of spells. */
  function unanchored(character: Character, deps: DeriveDeps, label: string): string[] {
    const sets = resolveSpellGrants(character, {
      race: deps.race,
      background: deps.background,
      featSlots: [],
      classByKey,
    }).variants
    const choices =
      sets.length === 0
        ? [{}]
        : sets.flatMap((set) =>
            set.names.map((name) => ({ [set.id]: { picks: [], variant: name } })),
          )
    return choices.flatMap((spellGrants) => {
      const sheet = deriveSheet({ ...character, spellGrants }, deps)
      const counters = sheet.resources.filter((r) => r.kind === 'spell')
      checked += counters.length
      return counters.filter((r) => !r.anchor).map((r) => `${label}|${r.label}`)
    })
  }

  it('shows the counter of a species spell on a row of the Features tab', () => {
    const found = races.flatMap((race) =>
      unanchored(createCharacter('Audit'), { classByKey, race }, `race|${race.key}`),
    )
    expect(found).toEqual([])
  })

  it('shows the counter of a background spell on a row of the Features tab', () => {
    const found = backgrounds.flatMap((background) =>
      unanchored(
        createCharacter('Audit'),
        { classByKey, background },
        `background|${background.key}`,
      ),
    )
    expect(found).toEqual([])
  })

  it('shows the counter of a class or subclass spell on a row of the Features tab', () => {
    const found = classes.flatMap((loaded) =>
      [undefined, ...subclassesFor(loaded)].flatMap((subclass) => {
        const { name, source } = loaded.entry
        const c = createCharacter('Audit')
        c.classes = [
          {
            name,
            source,
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
          },
        ]
        return unanchored(
          c,
          { classByKey },
          `class|${name}|${source}|${subclass?.name ?? ''}`,
        )
      }),
    )
    expect(found).toEqual([])
  })

  it('has counters to check', () => {
    // The three audits above run first, so the count is the sum of what they checked.
    expect(checked).toBeGreaterThan(40)
  })
})
