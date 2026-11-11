// The picks of the grants as cards: for every source that lets the player choose a
// language, a tool, a weapon or armor, its whole list, how many picks it allows and
// which are made. Skills have their own cards (see character/skills); a Skilled pick
// is a skill or a tool, so its tool half is here and its budget is shared.

import {
  MANUAL_TAG,
  picksCharged,
  picksOf,
  type PickCard,
  type PickChip,
  type PickKind,
} from '../character/picks'
import type { PickSpec } from '../data/grants'
import {
  activeParts,
  grantBlocks,
  type GrantChoices,
  type GrantBlock,
} from './grantBlocks'
import { ownKinds, pickOptions, type PickCatalog, type PickOption } from './pickOptions'
import type { ProficiencyListing } from './proficiencies'
import type { Sources } from './sources'

const NOUNS: Partial<Record<PickKind, string>> = {
  language: 'languages',
  tool: 'tools',
  weapon: 'weapons',
  armor: 'kinds of armor',
}

/** Where a value already comes from, by lower-case label, for each kind the sheet lists. */
const LISTED: Partial<Record<PickKind, keyof ProficiencyListing>> = {
  language: 'language',
  tool: 'tool',
  weapon: 'weapon',
  armor: 'armor',
}

interface Pool {
  block: GrantBlock
  kinds: PickKind[]
  specs: PickSpec[]
}

/** The specs of what a block gives now that a card of its own shows. */
function poolsOf(blocks: GrantBlock[], choices: GrantChoices): Pool[] {
  const pools = new Map<string, Pool>()
  for (const block of blocks) {
    // Resilient's saving throw follows the ability placed in the feat: no card.
    if (block.field === 'savingThrowProficiencies') continue
    for (const part of activeParts(block, choices)) {
      for (const spec of part.picks) {
        const kinds = ownKinds(spec.kinds).filter(
          (k) => k !== 'expertise' && k !== 'save',
        )
        if (kinds.length === 0) continue
        const key = `${block.card.tag}|${kinds.join('-')}`
        const pool = pools.get(key) ?? { block, kinds, specs: [] }
        pool.specs.push(spec)
        pools.set(key, pool)
      }
    }
  }
  return [...pools.values()]
}

export function pickCards(
  sources: Sources,
  choices: GrantChoices,
  catalog: PickCatalog,
  listing: ProficiencyListing,
): PickCard[] {
  const blocks = grantBlocks(sources)
  const labelOf = new Map(blocks.map((b) => [b.card.tag, b.card.name]))
  return poolsOf(blocks, choices).map(({ block, kinds, specs }): PickCard => {
    const tag = block.card.tag
    // The budget of a source is spent across every kind of its pick (Skilled: skill or tool).
    const budgetKinds = [...new Set(specs.flatMap((s) => s.kinds))].filter(
      (k) => k !== 'mixed',
    )
    const count = specs.reduce((n, s) => n + s.count, 0)
    const used = picksCharged(choices.picks, tag, budgetKinds)
    const options = new Map<string, PickOption>()
    for (const spec of specs)
      for (const o of pickOptions(spec, catalog))
        if (kinds.includes(o.kind)) options.set(`${o.kind}|${o.value}`, o)
    const picks = kinds.flatMap((kind) =>
      Object.entries(picksOf(choices.picks, kind))
        .filter(([, t]) => t === tag)
        .map(([value]) => value),
    )
    const chips = [...options.values()].map((o): PickChip => {
      const base = { kind: o.kind, value: o.value, label: o.label }
      if (picksOf(choices.picks, o.kind)[o.value] === tag)
        return { ...base, state: 'picked' }
      const listed = LISTED[o.kind]
      const holder = listed
        ? listing[listed].find((l) => l.value.toLowerCase() === o.label.toLowerCase())
        : undefined
      if (holder) return { ...base, state: 'taken', takenBy: holder.sources[0].label }
      return { ...base, state: used >= count ? 'full' : 'available' }
    })
    return {
      tag,
      label: block.card.label,
      name: labelOf.get(tag) ?? block.card.name,
      kind: block.card.kind,
      noun: kinds.map((k) => NOUNS[k] ?? k).join(' or '),
      kinds,
      count,
      used,
      left: Math.max(0, count - used),
      over: used > count,
      picks,
      chips,
      note: budgetKinds.includes('skill')
        ? 'Shared with your skill picks, in Skills.'
        : undefined,
    }
  })
}

/** The kinds a player can pick outside every list, each with the category of all of it. */
export const OTHER_KINDS = {
  language: 'anyLanguage',
  tool: 'anyTool',
  weapon: 'anyWeapon',
  armor: 'anyArmor',
} as const
export type OtherKind = keyof typeof OTHER_KINDS

/** What can be taken outside every list, for the Other panel: all of one kind. */
export function otherOptions(kind: OtherKind, catalog: PickCatalog): PickOption[] {
  return pickOptions(
    {
      id: 'other',
      count: 1,
      kinds: [kind],
      from: [],
      any: [OTHER_KINDS[kind]],
      text: '',
    },
    catalog,
  )
}

/** Picks charged to no source of the character: the player's own, or from a source since removed. */
export function strayPicks(
  choices: GrantChoices,
  kind: PickKind,
  tags: ReadonlySet<string>,
): { value: string; tag: string; orphan: boolean }[] {
  return Object.entries(picksOf(choices.picks, kind))
    .filter(([, tag]) => tag === MANUAL_TAG || !tags.has(tag))
    .map(([value, tag]) => ({ value, tag, orphan: tag !== MANUAL_TAG }))
}
