// The damage resistances, immunities and vulnerabilities, and the condition immunities, a
// character has, each with every source that gives it. A species or a feat gives them in
// the data's lists (the type a player chooses is a pick); an item gives the lists it
// carries while equipped, and attuned when it needs attunement; a feature, an option or
// a gift gives the rest from the table in rules/defenseRules.ts. Two sources of one
// defense do not stack, so the first counts and the others show.

import { picksOf } from '../character/picks'
import {
  DEFENSE_RULES,
  ITEM_DEFENSE_NOT_STANDING,
  ITEM_DEFENSE_WHEN,
} from '../rules/defenseRules'
import type { DefenseKind } from '../rules/defenseRules'
import type { GrantBlock, GrantChoices } from './grantBlocks'
import { grantState } from './grantBlocks'
import { heldBy, type Sources } from './sources'
import { quantity, type Line, type Quantity, type SourceRef } from './types'

export interface DefenseRow {
  key: string
  kind: DefenseKind
  /** The type as the sheet shows it: "Fire", "Poisoned", "All damage except force". */
  label: string
  /** 1 when a source gives it outright; the lines name every source. */
  held: Quantity
  /** When no source gives it outright and one gives it under a condition. */
  conditional?: string
}

interface Given {
  kind: DefenseKind
  type: string
  source: SourceRef
  label: string
  text: string
  state?: Pick<Line, 'status' | 'when' | 'why'>
}

/** The order the sheet lists the kinds in. */
const KINDS: readonly DefenseKind[] = ['resist', 'immune', 'vulnerable', 'condition']

const SENTENCE: Record<DefenseKind, (type: string) => string> = {
  resist: (t) => `Resistance to ${phrase(t)}`,
  immune: (t) => `Immunity to ${phrase(t)}`,
  vulnerable: (t) => `Vulnerability to ${phrase(t)}`,
  condition: (t) => `Immunity to the ${t} condition`,
}

/** A damage type reads "fire damage"; a phrase for a set of them reads as it is. */
const phrase = (type: string) => (type.includes(' ') ? type : `${type} damage`)

export const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function givenDefenses(
  sources: Sources,
  blocks: GrantBlock[],
  choices: GrantChoices,
): Given[] {
  const given: Given[] = []
  const add = (
    kind: DefenseKind,
    type: string,
    source: SourceRef,
    state?: Given['state'],
    text = SENTENCE[kind](type),
  ) =>
    given.push({
      kind,
      type,
      source,
      label: source.label,
      text,
      ...(state ? { state } : {}),
    })

  // A type the player chooses of a feature that holds only under a condition shows with
  // it, as the type the feature's row names does.
  const choiceWhen = new Map<string, string>()
  for (const rule of DEFENSE_RULES) {
    const held = rule.choose && rule.when ? heldBy(sources, rule.holder) : undefined
    if (held && rule.when) choiceWhen.set(`${held.source.tag}|${rule.kind}`, rule.when)
  }
  const choiceState = (kind: DefenseKind, source: SourceRef): Given['state'] => {
    const when = choiceWhen.get(`${source.tag}|${kind}`)
    return when ? { status: 'conditional', when } : undefined
  }
  // What a species and a feat list, and the types the player picked for them.
  for (const { value, source } of grantState(blocks, choices).granted) {
    const kind = KINDS.find((k) => k === value.kind)
    if (kind) add(kind, value.key, source, choiceState(kind, source))
  }
  const sourceOf = new Map(blocks.map((b) => [b.card.tag, b.source]))
  for (const kind of KINDS) {
    for (const [type, tag] of Object.entries(picksOf(choices.picks, kind))) {
      const source = sourceOf.get(tag)
      if (source) add(kind, type, source, choiceState(kind, source))
    }
  }
  // An item gives what its data lists while it is worn, and attuned when it needs it.
  for (const held of sources.items) {
    const { item } = held
    if (item.key in ITEM_DEFENSE_NOT_STANDING) continue
    const when = item.defensesWhen ?? ITEM_DEFENSE_WHEN[item.key]
    const state: Given['state'] = !held.active
      ? { status: 'inactive', why: 'Needs attunement, and you are not attuned.' }
      : when
        ? { status: 'conditional', when }
        : undefined
    for (const kind of KINDS) {
      for (const type of item.defenses?.[kind] ?? []) add(kind, type, held.source, state)
    }
  }
  for (const rule of DEFENSE_RULES) {
    const held = heldBy(sources, rule.holder)
    if (!held) continue
    const state: Given['state'] =
      held.active === false
        ? { status: 'inactive', why: 'Needs attunement, and you are not attuned.' }
        : rule.when
          ? { status: 'conditional', when: rule.when }
          : undefined
    for (const type of rule.types) add(rule.kind, type, held.source, state)
  }
  return given
}

export function defenseRows(
  sources: Sources,
  blocks: GrantBlock[],
  choices: GrantChoices,
): DefenseRow[] {
  const given = givenDefenses(sources, blocks, choices)
  return KINDS.flatMap((kind) =>
    [...new Set(given.filter((g) => g.kind === kind).map((g) => g.type))]
      .sort()
      .flatMap((type): DefenseRow[] => {
        const ofType = given.filter((g) => g.kind === kind && g.type === type)
        let counted = false
        const lines = ofType.map((g, i): Line => {
          const base = {
            id: `defense|${kind}|${type}|${i}`,
            label: g.label,
            source: g.source,
            text: g.text,
          }
          if (g.state) return { ...base, op: 'note', ...g.state }
          if (counted) {
            return { ...base, op: 'note', status: 'applied', how: 'Does not stack' }
          }
          counted = true
          return { ...base, op: 'base', amount: 1, status: 'applied' }
        })
        const held = quantity(lines)
        const row = { key: `${kind}|${type}`, kind, label: capitalized(type), held }
        if (held.value > 0) return [row]
        // No source gives it outright: one under a condition shows as such, one of an
        // item not attuned does not show at all.
        const when = ofType.find((g) => g.state?.status === 'conditional')?.state?.when
        return when ? [{ ...row, conditional: when }] : []
      }),
  )
}
