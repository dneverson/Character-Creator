// A data audit of where each spell stands for each caster (skips without `.local/data`):
// for every class of either edition, with and without each of its subclasses, no row
// whose other-edition printing the caster has may read "Not on" its list.

import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { dataDir } from '../test/dataAudit'
import { loadClasses, subclassesFor, type LoadedClass } from './class'
import { fetchData } from './dataClient'
import { matchesFilter, type FilterLists } from './grants'
import {
  isOnClassList,
  listStanding,
  loadSpells,
  standingProblem,
  type GrantedAccess,
  type Spell,
} from './spells'
import { createCharacter, type ClassRef } from '../character/model'
import { characterCasters } from '../character/spellcasting'
import {
  grantedSpell,
  resolveSpellGrants,
  spellsByName,
  type SpellGrant,
} from '../character/spellGrants'

vi.mock('./dataClient', () => ({ fetchData: vi.fn() }))

interface Caster {
  label: string
  ref: ClassRef
}

describe.skipIf(!dataDir)('spell standing against the data', () => {
  let spells: Spell[] = []
  let classes: LoadedClass[] = []

  beforeAll(async () => {
    // Answer the data client from the pulled data.
    vi.mocked(fetchData).mockImplementation(
      (path: string) =>
        Promise.resolve(
          JSON.parse(readFileSync(`${dataDir}/${path}`, 'utf8')),
        ) as Promise<never>,
    )
    spells = await loadSpells()
    classes = (await loadClasses()).filter((l) => l.entry.edition !== undefined)
  }, 120_000)

  /** Every caster to audit: each class at level 20, bare and with each subclass. */
  const castersOf = (l: LoadedClass): Caster[] => {
    const { name, source } = l.entry
    return [
      { label: `${name}|${source}`, ref: { name, source, level: 20 } },
      ...subclassesFor(l).map((s) => ({
        label: `${name}|${source} ${s.shortName}|${s.source}`,
        ref: {
          name,
          source,
          level: 20,
          subclass: { name: s.name, shortName: s.shortName, source: s.source },
        },
      })),
    ]
  }

  /** The reason each row of a caster's tables gives, as the Spells section words it. */
  function problems(caster: Caster) {
    const books = [
      ...new Set([...spells.map((s) => s.source), ...classes.map((l) => l.entry.source)]),
    ]
    const classByKey = new Map(
      classes.map((l) => [`${l.entry.name}|${l.entry.source}`, l]),
    )
    const character = createCharacter('Audit')
    character.selectedBooks = books
    character.classes = [caster.ref]
    let resolved = resolveSpellGrants(character, { featSlots: [], classByKey })
    // A source with named sets (Circle of the Land): take the first of each.
    for (const set of resolved.variants)
      character.spellGrants[set.id] = { picks: [], variant: set.names[0] }
    resolved = resolveSpellGrants(character, { featSlots: [], classByKey })
    const [cast] = characterCasters(character, classByKey)
    if (!cast) return []
    const edition = classByKey.get(cast.classKey)?.entry.edition
    const byName = spellsByName(spells)
    const lists: FilterLists = {
      classes: classes.map((l) => ({
        classKey: `${l.entry.name}|${l.entry.source}`,
        edition: l.entry.edition,
      })),
      selectedBooks: books,
    }
    const mine = (g: SpellGrant) => g.classKey === cast.classKey && !g.locked
    const always = new Map(
      resolved.grants
        .filter(
          (g) => mine(g) && (g.mode === 'known' || g.mode === 'prepared') && g.spell,
        )
        .flatMap((g) => {
          const spell = grantedSpell(g, byName)
          return spell ? [[spell.key, g.mode] as const] : []
        }),
    )
    const expanded = resolved.grants.filter((g) => g.mode === 'expanded' && !g.locked)
    const added = (spell: Spell) =>
      expanded.some((g) =>
        g.all
          ? matchesFilter(spell, g.all, g.edition, lists)
          : grantedSpell(g, byName)?.key === spell.key,
      )
    const granted = (spell: Spell): GrantedAccess | undefined => {
      const mode = always.get(spell.key)
      if (mode) return mode === 'known' ? 'always known' : 'always prepared'
      return added(spell) ? 'expanded list' : undefined
    }
    const listCaster = { ...cast, edition }
    const has = (s: Spell) => isOnClassList(s, listCaster, books) || !!granted(s)
    return spells.map((spell) => {
      const standing = listStanding(spell, listCaster, {
        selectedBooks: books,
        byName,
        granted,
      })
      const twinHad = (byName.get(spell.name.toLowerCase()) ?? []).some(
        (t) => t.edition !== spell.edition && has(t),
      )
      return {
        key: spell.key,
        twinHad,
        problem: standingProblem(standing, spell, { name: cast.name, edition }),
      }
    })
  }

  it('never says "Not on" for a spell whose other printing the caster has', () => {
    let audited = 0
    let printings = 0
    const wrong: string[] = []
    for (const l of classes)
      for (const caster of castersOf(l))
        for (const row of problems(caster)) {
          audited++
          if (row.problem?.includes('printing')) printings++
          if (row.twinHad && row.problem?.startsWith('Not on'))
            wrong.push(`${caster.label}: ${row.key} "${row.problem}"`)
        }
    expect(wrong).toEqual([])
    // The audit read the data: rows, and printings among them.
    expect(audited).toBeGreaterThan(1000)
    expect(printings).toBeGreaterThan(0)
  })

  it('reads the cases the investigation found as printings', () => {
    const of = (label: string, key: string) => {
      const [cls, sub] = label.split(' ')
      const l = classes.find((c) => `${c.entry.name}|${c.entry.source}` === cls)
      const caster = l && castersOf(l).find((c) => c.label === (sub ? label : cls))
      return caster && problems(caster).find((r) => r.key === key)?.problem
    }
    expect(of('Druid|PHB Stars|TCE', 'guiding bolt|xphb')).toBe(
      '2024 printing - your 2014 Druid has the 2014 one (always prepared)',
    )
    expect(of('Druid|XPHB', 'ice knife|xge')).toBe(
      '2014 printing - your 2024 Druid has the 2024 one (class list)',
    )
  })
})
