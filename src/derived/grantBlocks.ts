// Every grant of proficiency a character's sources make, read once with `readGrant`:
// the class lists, the species, the background and the feats taken. Each grant keeps
// the source it comes from, which alternative the player took, what it gives outright
// and what is the player's to choose. The sheet's proficiencies, the pick cards and the
// open choices are all read from here, so the words in a table, the state of the
// sheet and the picks cannot disagree.

import { picksCharged, type GrantPicks } from '../character/picks'
import type { SkillSourceKind } from '../character/skills'
import {
  readGrant,
  valueText,
  type GrantAlt,
  type GrantKind,
  type GrantRead,
  type PickSpec,
} from '../data/grants'
import type { ClassEntry } from '../data/class'
import type { GrantValue } from '../data/grants'
import type { Sources } from './sources'
import type { SourceRef } from './types'

/** The fields of a source that grant proficiencies other than skills. */
export const GRANT_FIELDS = [
  'languageProficiencies',
  'toolProficiencies',
  'weaponProficiencies',
  'armorProficiencies',
  'skillToolLanguageProficiencies',
  'expertise',
  'savingThrowProficiencies',
] as const
export type GrantField = (typeof GRANT_FIELDS)[number]

const FIELD_KIND: Record<GrantField, GrantKind> = {
  languageProficiencies: 'language',
  toolProficiencies: 'tool',
  weaponProficiencies: 'weapon',
  armorProficiencies: 'armor',
  skillToolLanguageProficiencies: 'mixed',
  expertise: 'expertise',
  savingThrowProficiencies: 'save',
}

/** What the player decided about the alternatives of grants. */
export interface GrantChoices {
  picks?: GrantPicks
  /** Block id -> the alternative taken; `<id>|optional<n>` -> 1 when an optional block is on. */
  alt?: Record<string, number>
}

/** How a source is named on its card. */
export interface CardSource {
  tag: string
  /** "Background · Acolyte": the card's heading. */
  label: string
  /** "Background", or the class or feat: the short name. */
  name: string
  kind: SkillSourceKind
}

/** One field of one source, read. */
export interface GrantBlock {
  /** `<tag>|<field>`: the key the chosen alternative is stored under. */
  id: string
  source: SourceRef
  card: CardSource
  field: GrantField
  kind: GrantKind
  read: GrantRead
  /** Resilient: the saving throw is of the ability placed in the feat. */
  increases?: Partial<Record<string, number>>
}

/** The lists of a class: the first class gives its starting lists, the others what a multiclass gains. */
export function classGrantBlocks(entry: ClassEntry, first: boolean) {
  const list = first
    ? entry.startingProficiencies
    : entry.multiclassing?.proficienciesGained
  return {
    armor: list?.armorProficiencies ?? list?.armor ?? [],
    weapons: list?.weaponProficiencies ?? list?.weapons ?? [],
    tools: list?.toolProficiencies ?? [],
    // Multiclassing never grants saving throws.
    saves: first ? (entry.proficiency ?? []) : [],
  }
}

export function grantBlocks(sources: Sources): GrantBlock[] {
  const out: GrantBlock[] = []
  const add = (
    source: SourceRef,
    card: CardSource,
    field: GrantField,
    blocks: readonly unknown[] | undefined,
    increases?: GrantBlock['increases'],
  ) => {
    if (!blocks || blocks.length === 0) return
    const kind = FIELD_KIND[field]
    const read = readGrant(blocks, kind)
    if (read.alternatives.length === 0 && read.optional.length === 0) return
    out.push({ id: `${card.tag}|${field}`, source, card, field, kind, read, increases })
  }
  const addAll = (
    source: SourceRef,
    card: CardSource,
    record: Partial<Record<GrantField, readonly unknown[]>>,
    increases?: GrantBlock['increases'],
  ) => {
    for (const field of GRANT_FIELDS) add(source, card, field, record[field], increases)
  }

  sources.classes.forEach((c, i) => {
    if (!c.loaded) return
    const tag = `class:${c.row.name}|${c.row.source}`
    const source: SourceRef = { kind: 'class', tag, label: c.row.name }
    const card: CardSource = {
      tag,
      label: `${i === 0 ? 'Class' : 'Multiclass'} · ${c.row.name}`,
      name: c.row.name,
      kind: i === 0 ? 'class' : 'multiclass',
    }
    const lists = classGrantBlocks(c.loaded.entry, i === 0)
    add(source, card, 'armorProficiencies', lists.armor)
    add(source, card, 'weaponProficiencies', lists.weapons)
    add(source, card, 'toolProficiencies', lists.tools)
    add(source, card, 'savingThrowProficiencies', lists.saves)
  })
  if (sources.race) {
    const source: SourceRef = { kind: 'race', tag: 'race', label: sources.race.name }
    addAll(
      source,
      { tag: 'race', label: `Race · ${sources.race.name}`, name: 'Race', kind: 'race' },
      sources.race,
    )
  }
  if (sources.background) {
    const source: SourceRef = {
      kind: 'background',
      tag: 'bg',
      label: sources.background.name,
    }
    addAll(
      source,
      {
        tag: 'bg',
        label: `Background · ${sources.background.name}`,
        name: 'Background',
        kind: 'background',
      },
      sources.background,
    )
  }
  for (const { feat, source, increases } of sources.feats) {
    addAll(
      source,
      { tag: source.tag, label: `Feat · ${feat.label}`, name: feat.label, kind: 'feat' },
      feat,
      increases,
    )
  }
  return out
}

/** The alternative of a block the player took (the first until they choose). */
export function chosenAlt(block: GrantBlock, choices: GrantChoices) {
  const last = block.read.alternatives.length - 1
  const index = Math.min(Math.max(0, choices.alt?.[block.id] ?? 0), last)
  return block.read.alternatives[index]
}

/** The optional blocks the player switched on. */
export function optionalOn(block: GrantBlock, choices: GrantChoices) {
  return block.read.optional.filter(
    (_, i) => choices.alt?.[`${block.id}|optional${i}`] === 1,
  )
}

/** What a block gives now: its chosen alternative and the optional blocks switched on. */
export function activeParts(block: GrantBlock, choices: GrantChoices) {
  const alt = chosenAlt(block, choices)
  return [...(alt ? [alt] : []), ...optionalOn(block, choices)]
}

export interface Granted {
  value: GrantValue
  source: SourceRef
}

export interface OpenPick {
  spec: PickSpec
  block: GrantBlock
  /** How many picks of this choice the player has not made. */
  left: number
}

export interface GrantState {
  granted: Granted[]
  open: OpenPick[]
}

/** What the grants give outright, and the picks still to make, for the choices made. */
export function grantState(blocks: GrantBlock[], choices: GrantChoices): GrantState {
  const state: GrantState = { granted: [], open: [] }
  for (const block of blocks) {
    for (const part of activeParts(block, choices)) {
      for (const value of part.fixed) state.granted.push({ value, source: block.source })
      for (const spec of part.picks) {
        // Resilient: the saving throw is the one of the ability the feat raises.
        if (block.field === 'savingThrowProficiencies' && block.increases) {
          const placed = Object.keys(block.increases)
          for (const key of placed) {
            state.granted.push({ value: { kind: 'save', key }, source: block.source })
          }
          if (placed.length >= spec.count) continue
        }
        const left = Math.max(
          0,
          spec.count - picksCharged(choices.picks, block.card.tag, spec.kinds),
        )
        if (left > 0) state.open.push({ spec, block, left })
      }
    }
  }
  return state
}

/** An alternative in words: "Smith's Tools" or "1 set of artisan's tools of your choice". */
export function altText(alt: GrantAlt): string {
  return [...alt.fixed.map(valueText), ...alt.picks.map((p) => p.text)].join(', ')
}

/** A grant with several alternatives: the player takes one. */
export interface AltChoice {
  /** The key the chosen index is stored under. */
  id: string
  card: CardSource
  field: GrantField
  options: string[]
  chosen: number
  /** Every kind the alternatives let the player pick: a change of alternative clears them. */
  kinds: GrantKind[]
}

/** A grant that only applies when the player says so (and their DM agrees). */
export interface OptionalSwitch {
  /** The key the switch is stored under. */
  id: string
  card: CardSource
  text: string
  on: boolean
}

export function altChoices(blocks: GrantBlock[], choices: GrantChoices): AltChoice[] {
  return blocks
    .filter((b) => b.read.alternatives.length > 1)
    .map((block) => ({
      id: block.id,
      card: block.card,
      field: block.field,
      options: block.read.alternatives.map(altText),
      chosen: block.read.alternatives.indexOf(chosenAlt(block, choices)),
      kinds: [
        ...new Set(
          block.read.alternatives.flatMap((a) => a.picks.flatMap((p) => p.kinds)),
        ),
      ],
    }))
}

export function optionalSwitches(
  blocks: GrantBlock[],
  choices: GrantChoices,
): OptionalSwitch[] {
  return blocks.flatMap((block) =>
    block.read.optional.map((alt, i) => ({
      id: `${block.id}|optional${i}`,
      card: block.card,
      text: altText(alt),
      on: choices.alt?.[`${block.id}|optional${i}`] === 1,
    })),
  )
}
