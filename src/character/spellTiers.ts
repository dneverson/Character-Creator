// The tables a spellcaster chooses in and how full each is: cantrips, spells known or
// prepared, a spellbook, and the spells a grant lets the player choose. The Spells
// section opens the first with room; the build checklist counts what is still missing.

import {
  spellbookFreeCount,
  usesSpellbook,
  type ClassCaster,
} from '../rules/spellcasting'
import type { Character, ClassSpellSelection } from './model'
import type { SpellGrant } from './spellGrants'

export const EMPTY_SELECTION: ClassSpellSelection = { cantrips: [], spells: [] }

export type TierKind = 'cantrips' | 'spells' | 'book' | 'prepared'

/** One table a class chooses in, and how full it is. */
export interface TierSpec {
  id: string
  kind: TierKind
  /** What is chosen, plural, lower case: it heads the count. */
  noun: string
  count: number
  /** The most the rules allow, when they state one. */
  max?: number
  /** How many picks make the tier done: the cap, else something chosen. */
  target: number
}

/** Spells a class always has, by where they are shown: the cantrip tier, or the spell tier. */
export interface Hosted {
  cantrips: number
  leveled: number
}
export const NOTHING_HOSTED: Hosted = { cantrips: 0, leveled: 0 }

/** The tiers of a caster, in the order they are chosen. A tier with no room is left out. */
export function tiersOf(
  caster: ClassCaster,
  selection: ClassSpellSelection,
  hosted: Hosted = NOTHING_HOSTED,
): TierSpec[] {
  const tier = (
    kind: TierKind,
    noun: string,
    count: number,
    max: number | undefined,
    target = max ?? 1,
  ): TierSpec => ({ id: `${caster.classKey}:${kind}`, kind, noun, count, max, target })
  const out: TierSpec[] = [
    tier('cantrips', 'cantrips', selection.cantrips.length, caster.cantripsKnown),
  ]
  if (usesSpellbook(caster.name)) {
    const book = selection.spellbook ?? selection.spells
    out.push(
      tier(
        'book',
        'spellbook spells',
        book.length,
        undefined,
        caster.spellbookFree ?? spellbookFreeCount(caster.level),
      ),
      tier('prepared', 'spells prepared', selection.spells.length, caster.preparedMax),
    )
  } else if (caster.kind === 'known') {
    out.push(tier('spells', 'spells known', selection.spells.length, caster.spellsKnown))
  } else {
    out.push(
      tier('spells', 'spells prepared', selection.spells.length, caster.preparedMax),
    )
  }
  const hosts = (t: TierSpec) =>
    t.kind === 'cantrips' ? hosted.cantrips : t.kind === 'book' ? 0 : hosted.leveled
  return out.filter((t) => t.max !== 0 || t.count > 0 || hosts(t) > 0)
}

export const hasRoom = (t: { count: number; target: number }) => t.count < t.target

/** Whether a class's own grant of a named spell is shown in that class's tier. */
export const isPlaced = (grant: SpellGrant, casters: ClassCaster[]) =>
  (grant.origin === 'class' || grant.origin === 'subclass') &&
  grant.spell !== undefined &&
  (grant.mode === 'known' || grant.mode === 'prepared') &&
  casters.some((c) => c.classKey === grant.classKey)

/** The grants that have a card of their own (not a class's tier, not a whole added list). */
export const cardGrantsOf = (grants: SpellGrant[], casters: ClassCaster[]) =>
  grants.filter((g) => g.mode !== 'expanded' && !isPlaced(g, casters))

/** The id of the table in which a grant's choices are made. */
export const pickTierId = (grant: SpellGrant) => `grant:${grant.id}`

/** How full a table the player chooses in is. */
export interface Room {
  id: string
  count: number
  target: number
}

/**
 * Every table the player chooses in, with how full it is: the tiers of each caster, then
 * the choices a grant offers. `hostedOf` says what a class always has, which only decides
 * whether a tier with no picks to make is listed.
 */
export function spellRooms(
  character: Pick<Character, 'spells' | 'spellGrants'>,
  casters: ClassCaster[],
  cardGrants: SpellGrant[],
  hostedOf: (classKey: string) => Hosted = () => NOTHING_HOSTED,
): Room[] {
  return [
    ...casters.flatMap((c) =>
      tiersOf(c, character.spells[c.classKey] ?? EMPTY_SELECTION, hostedOf(c.classKey)),
    ),
    ...cardGrants.flatMap((g) =>
      g.pick && !g.locked
        ? [
            {
              id: pickTierId(g),
              count: (character.spellGrants[g.id]?.picks ?? []).length,
              target: g.pick.count,
            },
          ]
        : [],
    ),
  ]
}
