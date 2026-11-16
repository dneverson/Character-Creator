// The 2024 weapon masteries a character has: for each feature or feat of the table in
// rules/weaponMastery.ts it holds, a pick card of the kinds of weapons it qualifies for,
// as many as the class's Weapon Mastery column (or the feature's text) gives at its level.
// Picks are stored in `classOptions` under `<owner tag>|mastery` as the weapon's name in
// lower case, the same kind in either book. An attack shows its mastery property only for
// a kind picked. A change since the last long rest is flagged, never refused.

import type { PickCard, PickChip } from '../character/picks'
import { featuresForClass } from '../data/class'
import type { Item } from '../data/itemTypes'
import { holderId } from '../rules/holder'
import { MASTERY_COLUMN, MASTERY_GRANTS, type MasteryGrant } from '../rules/weaponMastery'
import { columnCell } from './classTable'
import { grantCovers, proficiencies, type Proficiencies } from './proficiencies'
import { heldBy, type Sources } from './sources'
import type { SourceRef } from './types'

export const MASTERY_MARK = '|mastery'

/** A feature or feat of the table the character has, and how many kinds it gives. */
export interface MasteryOwner {
  /** `<owner tag>|mastery`: the key the picks are stored under. */
  tag: string
  /** "Class - Fighter", "Feat - Weapon Master". */
  label: string
  name: string
  kind: PickCard['kind']
  count: number
  grant: MasteryGrant
  /** What an attack's mastery line names as its source. */
  source: SourceRef
}

const byId = new Map(MASTERY_GRANTS.map((g) => [holderId(g.holder), g]))

export function masteryOwners(sources: Sources): MasteryOwner[] {
  const out: MasteryOwner[] = []
  sources.classes.forEach((c, index) => {
    if (!c.loaded || c.level < 1) return
    // A class of another book that takes the feature in (by its data reference) has it too.
    for (const f of featuresForClass(c.loaded, { ...c.row, level: c.level })) {
      const grant = f.id ? byId.get(f.id) : undefined
      if (!grant) continue
      const cell = columnCell(
        c.loaded.entry.classTableGroups ?? [],
        MASTERY_COLUMN,
        c.level,
      )
      const prefix = index > 0 ? 'Multiclass' : 'Class'
      out.push({
        tag: `class:${c.row.name}|${c.row.source}${MASTERY_MARK}`,
        label: `${prefix} - ${c.row.name} weapon mastery`,
        name: c.row.name,
        kind: index > 0 ? 'multiclass' : 'class',
        count: Number.parseInt(cell, 10) || grant.count,
        grant,
        source: {
          kind: 'class',
          tag: `class:${c.row.name}|${c.row.source}`,
          label: c.row.name,
        },
      })
    }
  })
  for (const grant of MASTERY_GRANTS) {
    if (!('feat' in grant.holder)) continue
    const held = heldBy(sources, grant.holder)
    if (!held) continue
    out.push({
      tag: `${held.source.tag}${MASTERY_MARK}`,
      label: `Feat - ${held.source.label} weapon mastery`,
      name: held.source.label,
      kind: 'feat',
      count: grant.count,
      grant,
      source: held.source,
    })
  }
  return out
}

/** One kind of weapon with a mastery property: the 2024 book's item, the first of a name. */
function weaponKinds(items: readonly Item[]): Item[] {
  const byName = new Map<string, Item>()
  for (const item of items) {
    const w = item.weapon
    if (item.kind !== 'weapon' || item.magic || !w?.category || w.mastery.length === 0)
      continue
    const key = item.name.toLowerCase()
    const had = byName.get(key)
    if (!had || (had.edition !== 'one' && item.edition === 'one')) byName.set(key, item)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Why a kind of weapon does not qualify for a grant, or undefined when it does. */
function unmetFor(
  grant: MasteryGrant,
  item: Item,
  known: Proficiencies,
): string | undefined {
  if (grant.melee && !item.weapon?.melee) return 'Not a melee weapon'
  if (
    grant.proficient &&
    !item.grantsProficiency &&
    !known.weapons.some((w) => grantCovers(w.grant, item, item.name))
  )
    return 'Not proficient with it'
  return undefined
}

/** How many of the kinds picked at the last long rest are no longer picked. */
function changedSinceRest(sources: Sources, tag: string, picks: readonly string[]) {
  const before = sources.character.play.masteryAtRest?.[tag]
  return before ? before.filter((k) => !picks.includes(k)).length : 0
}

/** The kinds of a card's picks changed since the last long rest, and whether more than allowed. */
export function masteryChange(
  sources: Sources,
  card: Pick<PickCard, 'tag' | 'picks'>,
): { changed: number; over: boolean } {
  const changed = changedSinceRest(sources, card.tag, card.picks)
  const owner = masteryOwners(sources).find((o) => o.tag === card.tag)
  return { changed, over: owner?.grant.changes === 'one' && changed > 1 }
}

function restNote(owner: MasteryOwner, changed: number): string {
  const may = owner.grant.changes === 'one' ? 'change one of them' : 'change them'
  const rule = `Whenever you finish a Long Rest, you can ${may}.`
  if (changed === 0) return rule
  const over = owner.grant.changes === 'one' && changed > 1
  return `${rule} ${changed} changed since your last Long Rest${over ? ', more than the one allowed' : ''}: the rules make the change when you finish a Long Rest - allowed with DM approval.`
}

/** The pick card of every mastery the character has. */
export function masteryCards(sources: Sources, items: readonly Item[] = []): PickCard[] {
  const owners = masteryOwners(sources)
  if (owners.length === 0) return []
  const { character } = sources
  const known = proficiencies(sources, {
    picks: character.grantPicks,
    alt: character.grantAlt,
  })
  const kinds = weaponKinds(items)
  return owners.map((owner): PickCard => {
    const picks = character.classOptions[owner.tag] ?? []
    const full = picks.length >= owner.count
    const takenBy = new Map(
      owners
        .filter((o) => o.tag !== owner.tag)
        .flatMap((o) => (character.classOptions[o.tag] ?? []).map((k) => [k, o.name])),
    )
    const chips = kinds.flatMap((item): PickChip[] => {
      const value = item.name.toLowerCase()
      const unmet = unmetFor(owner.grant, item, known)
      const picked = picks.includes(value)
      // Only the kinds the character qualifies for, and any picked that no longer does.
      if (unmet && !picked) return []
      const weapon = item.weapon
      const mastery = weapon?.mastery[0]
      const category = weapon?.category === 'martial' ? 'Martial' : 'Simple'
      const by = takenBy.get(value)
      return [
        {
          kind: 'option',
          value,
          label: item.name,
          state: picked ? 'picked' : by ? 'taken' : full ? 'full' : 'available',
          ...(by && !picked ? { takenBy: by } : {}),
          ...(unmet ? { unmet: `${unmet} - allowed with DM approval` } : {}),
          detail: {
            facts: [
              {
                label: 'Weapon',
                value: `${category} ${weapon?.melee ? 'Melee' : 'Ranged'}`,
              },
              { label: 'Mastery', value: mastery?.name ?? '' },
            ],
            entries: mastery ? [mastery.rule] : [],
          },
        },
      ]
    })
    return {
      tag: owner.tag,
      label: owner.label,
      name: owner.name,
      kind: owner.kind,
      noun: 'weapon masteries',
      kinds: ['option'],
      count: owner.count,
      used: picks.length,
      left: Math.max(0, owner.count - picks.length),
      over: picks.length > owner.count,
      picks,
      chips,
      note: `${owner.grant.text.split(';')[0]}: the mastery property of ${owner.count} kind${owner.count === 1 ? '' : 's'} of weapon. ${restNote(owner, changedSinceRest(sources, owner.tag, picks))}`,
    }
  })
}

/**
 * The kinds of weapons whose mastery property the character can use, by name in lower
 * case, each with the feature or feat it was picked for.
 */
export function masteredKinds(sources: Sources): Map<string, SourceRef> {
  return new Map(
    masteryOwners(sources).flatMap((o) =>
      (sources.character.classOptions[o.tag] ?? []).map((k) => [k, o.source] as const),
    ),
  )
}

/** What the mastery picks are now, to compare with after the next long rest. */
export function masterySnapshot(cards: readonly PickCard[]): Record<string, string[]> {
  return Object.fromEntries(
    cards.filter((c) => c.tag.endsWith(MASTERY_MARK)).map((c) => [c.tag, [...c.picks]]),
  )
}
