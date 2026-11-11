// Expertise: the proficiency bonus counted twice for a skill the character is proficient in.
// A class feature gives it as a pick (the rules table), a feat gives it in its data; both
// are picks charged to their source, as every other pick is, and the skill table counts
// the doubled bonus. The skill table and its expertise are worked out together here, so
// the Skills section and the PDF read one result.

import type { Character } from '../character/model'
import {
  MANUAL_TAG,
  picksCharged,
  picksOf,
  type PickCard,
  type PickChip,
} from '../character/picks'
import { skillRows, type SkillRow, type SkillSource } from '../character/skills'
import { SKILLS } from '../data/skills'
import { EXPERTISE_GRANTS } from '../rules/expertiseGrants'
import { activeParts, grantBlocks, type GrantChoices } from './grantBlocks'
import { proficiencies } from './proficiencies'
import { heldBy, type Sources } from './sources'
import type { SourceRef } from './types'

const THIEVES_TOOLS = "thieves' tools"

/** One source of expertise: how many it gives, and the list it is picked from. */
interface Pool {
  source: SourceRef
  label: string
  name: string
  kind: PickCard['kind']
  count: number
  /** The skills it is limited to; any proficient skill when absent. */
  skills?: string[]
  thievesTools: boolean
}

export interface ExpertiseState {
  /** The skills (or tools) the character has expertise in, each with its source. */
  held: Map<string, SourceRef>
  cards: PickCard[]
}

const NON_STANDARD: SourceRef = {
  kind: 'manual',
  tag: MANUAL_TAG,
  label: 'Non-standard (DM approval)',
}

/** The pools of expertise a character's classes and feats give. */
function poolsOf(sources: Sources, choices: GrantChoices) {
  const pools = new Map<string, Pool>()
  const fixed = new Map<string, SourceRef>()
  const add = (pool: Pool) => {
    const found = pools.get(pool.source.tag)
    if (!found) return void pools.set(pool.source.tag, pool)
    found.count += pool.count
    found.thievesTools ||= pool.thievesTools
    if (pool.skills === undefined) found.skills = undefined
    else if (found.skills) found.skills = [...new Set([...found.skills, ...pool.skills])]
  }

  for (const row of EXPERTISE_GRANTS) {
    const held = heldBy(sources, row.holder)
    if (!held || (row.level !== undefined && (held.classLevel ?? 0) < row.level)) continue
    const index = sources.classes.findIndex(
      (c) => `class:${c.row.name}|${c.row.source}` === held.source.tag,
    )
    add({
      source: held.source,
      label: `${index > 0 ? 'Multiclass' : 'Class'} · ${held.source.label}`,
      name: held.source.label,
      kind: index > 0 ? 'multiclass' : 'class',
      count: row.count,
      skills: row.skills,
      thievesTools: row.thievesTools === true,
    })
  }

  for (const block of grantBlocks(sources)) {
    if (block.field !== 'expertise') continue
    for (const part of activeParts(block, choices)) {
      for (const value of part.fixed) fixed.set(value.key, block.source)
      for (const spec of part.picks) {
        add({
          source: block.source,
          label: block.card.label,
          name: block.card.name,
          kind: block.card.kind,
          count: spec.count,
          thievesTools: false,
        })
      }
    }
  }
  return { pools, fixed }
}

export function expertise(
  sources: Sources,
  choices: GrantChoices,
  proficient: { skills: ReadonlySet<string>; tools: ReadonlySet<string> },
): ExpertiseState {
  const { pools, fixed } = poolsOf(sources, choices)
  const tagSource = new Map([...pools.values()].map((p) => [p.source.tag, p.source]))
  const has = (value: string) =>
    proficient.skills.has(value) || proficient.tools.has(value)

  // What counts: the fixed grants and the picks, of what the character is proficient in.
  const held = new Map<string, SourceRef>()
  for (const [value, source] of fixed) if (has(value)) held.set(value, source)
  for (const [value, tag] of Object.entries(picksOf(choices.picks, 'expertise'))) {
    if (has(value)) held.set(value, tagSource.get(tag) ?? NON_STANDARD)
  }

  const cards = [...pools.values()].map((pool): PickCard => {
    const tag = pool.source.tag
    const used = picksCharged(choices.picks, tag, ['expertise'])
    const picks = Object.entries(picksOf(choices.picks, 'expertise'))
      .filter(([, t]) => t === tag)
      .map(([value]) => value)
    const options = [
      ...SKILLS.filter(
        (s) =>
          proficient.skills.has(s.key) && (!pool.skills || pool.skills.includes(s.key)),
      ).map((s) => ({ value: s.key, label: s.label })),
      ...(pool.thievesTools && proficient.tools.has(THIEVES_TOOLS)
        ? [{ value: THIEVES_TOOLS, label: "Thieves' Tools" }]
        : []),
    ]
    const chips = options.map((o): PickChip => {
      const base = { kind: 'expertise' as const, ...o }
      if (picksOf(choices.picks, 'expertise')[o.value] === tag) {
        return { ...base, state: 'picked' }
      }
      const by = held.get(o.value)
      if (by) return { ...base, state: 'taken', takenBy: by.label }
      return { ...base, state: used >= pool.count ? 'full' : 'available' }
    })
    return {
      tag,
      label: `${pool.label} expertise`,
      name: `${pool.name} expertise`,
      kind: pool.kind,
      noun: 'skills',
      kinds: ['expertise'],
      count: pool.count,
      used,
      left: Math.max(0, pool.count - used),
      over: used > pool.count,
      picks,
      chips,
      note: 'Pick from the skills you are proficient in. Expertise counts your proficiency bonus twice.',
    }
  })
  return { held, cards }
}

/** The skill table with the expertise the character has, and the cards to pick it with. */
export function skillTable(
  character: Character,
  sources: Sources,
  skillSources: SkillSource[],
  featBonus: Parameters<typeof skillRows>[2],
): { rows: SkillRow[]; expertise: ExpertiseState } {
  const choices: GrantChoices = { picks: character.grantPicks, alt: character.grantAlt }
  const plain = skillRows(character, skillSources, featBonus)
  const tools = proficiencies(sources, choices).listing.tool.map((t) =>
    t.value.toLowerCase(),
  )
  const state = expertise(sources, choices, {
    skills: new Set(plain.filter((r) => r.proficient).map((r) => r.key)),
    tools: new Set(tools),
  })
  const doubled = new Map(
    [...state.held].map(([value, source]) => [value, source.label] as const),
  )
  return {
    rows: skillRows(character, skillSources, featBonus, doubled),
    expertise: state,
  }
}
