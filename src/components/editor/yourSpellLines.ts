// The character's whole spell list, one line per spell: what a class picked, what a
// source always gives, and what a grant let the player choose. A spell several
// sources give is one line naming every source.

import type { Spell } from '../../data/spells'
import type { Character, SpellRef } from '../../character/model'
import { grantedSpell, type SpellGrant } from '../../character/spellGrants'
import { refKey } from '../../character/spellRefs'
import { usesSpellbook, type ClassCaster } from '../../rules/spellcasting'
import { MODE_CAST } from './grantedCast'
import type { SpellLine } from './SpellLines'

export interface YourSpellsInputs {
  casters: ClassCaster[]
  character: Pick<Character, 'spells' | 'spellGrants'>
  /** Every grant that gives a named spell or a choice, from any source. */
  grants: SpellGrant[]
  byKey: Map<string, Spell>
  byName: Map<string, Spell[]>
  removeClassPick: (classKey: string, spell: Spell) => void
  removeGrantPick: (grantId: string, spell: Spell) => void
}

interface Entry {
  spell: Spell
  from: string[]
  cast: string[]
  /** Set by a source that gives the spell, not the player choosing it. */
  granted: boolean
  /** How many sources give it. */
  sources: number
  remove?: () => void
}

/** The character's whole spell list, one line per spell. */
export function yourSpellLines({
  casters,
  character,
  grants,
  byKey,
  byName,
  removeClassPick,
  removeGrantPick,
}: YourSpellsInputs): { lines: SpellLine[]; granted: number } {
  const entries = new Map<string, Entry>()
  const add = (
    spell: Spell,
    from: string,
    cast: string,
    granted: boolean,
    remove?: () => void,
  ) => {
    const entry = entries.get(spell.key) ?? {
      spell,
      from: [],
      cast: [],
      granted: false,
      sources: 0,
      remove,
    }
    if (!entry.from.includes(from)) entry.from.push(from)
    if (cast && !entry.cast.includes(cast)) entry.cast.push(cast)
    entry.granted ||= granted
    entry.sources += 1
    entries.set(spell.key, entry)
  }
  const spellsOf = (refs: SpellRef[]) => refs.flatMap((r) => byKey.get(refKey(r)) ?? [])

  for (const caster of casters) {
    const selection = character.spells[caster.classKey]
    if (!selection) continue
    const prepared = new Set(selection.spells.map(refKey))
    const book = selection.spellbook ?? []
    const leveledWord = usesSpellbook(caster.name)
      ? 'Prepared'
      : caster.kind === 'known'
        ? 'Known'
        : 'Prepared'
    const pick = (spell: Spell, cast: string) =>
      add(spell, caster.name, cast, false, () => removeClassPick(caster.classKey, spell))
    for (const spell of spellsOf(selection.cantrips)) pick(spell, 'Cantrip')
    for (const spell of spellsOf(selection.spells)) pick(spell, leveledWord)
    for (const spell of spellsOf(book))
      if (!prepared.has(spell.key)) pick(spell, 'In spellbook')
  }

  for (const grant of grants) {
    if (grant.locked) continue
    const cast = grant.uses || MODE_CAST[grant.mode]
    const named = grantedSpell(grant, byName)
    if (named) add(named, grant.from, cast, true)
    const chosen = character.spellGrants[grant.id]?.picks ?? []
    for (const spell of grant.pick ? spellsOf(chosen) : [])
      add(spell, grant.from, cast, true, () => removeGrantPick(grant.id, spell))
  }

  const sorted = [...entries.values()].sort(
    (a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name),
  )
  return {
    lines: sorted.map((e) => ({
      id: e.spell.key,
      spell: e.spell,
      from: e.from,
      cast: e.cast.join('; '),
      // A spell two sources give is not one pick to take away.
      remove: e.sources === 1 ? e.remove : undefined,
    })),
    granted: sorted.filter((e) => e.granted).length,
  }
}
