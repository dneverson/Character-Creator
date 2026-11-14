// Whether the character meets what an optional feature (an invocation, an infusion, an
// elemental discipline) asks before it can be chosen, read from the data's
// `prerequisite`. A prerequisite the data only states in words, or one about the spell a
// choice applies to, cannot be checked: it is shown, and the option is not greyed for it.
// An option whose prerequisite is not met is never blocked: it is greyed with the reason,
// and can still be chosen with the DM's approval.

import type { Character } from '../character/model'
import type { OptionPrerequisite } from '../data/classOptions'
import { stripTags } from '../text/tags'

export type OptionPrereqStatus = 'met' | 'unmet' | 'unknown'

/** What the check needs to know of the character. */
export interface OptionPrereqContext {
  character: Character
  /** The options the character holds, by "Name|Source". */
  held: ReadonlySet<string>
  /** The class and subclass feature names the character has, lower case. */
  features: ReadonlySet<string>
}

export interface OptionPrereqResult {
  status: OptionPrereqStatus
  /** The prerequisite in words: "Level 5 Warlock, Pact of the Blade". */
  text: string
  /** The part that is not met, in words, when unmet. */
  missing?: string
  /** The class level the prerequisite names, for the Level column. */
  level?: number
}

const lower = (s: string) => s.toLowerCase()

/** "pact of the blade|xphb" as the option's name in title case: "Pact of the Blade". */
function optionName(key: string, held: ReadonlySet<string>): string {
  const found = [...held].find((k) => lower(k) === lower(key))
  if (found) return found.split('|')[0]
  return key
    .split('|')[0]
    .split(' ')
    .map((w, i) =>
      i > 0 && ['of', 'the', 'and'].includes(w)
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ')
}

/** The spell names the character knows or has from a grant, lower case. */
function knownSpells(character: Character): Set<string> {
  const names = new Set<string>()
  for (const selection of Object.values(character.spells)) {
    for (const s of [
      ...selection.cantrips,
      ...selection.spells,
      ...(selection.spellbook ?? []),
    ])
      names.add(lower(s.name))
  }
  for (const choice of Object.values(character.spellGrants))
    for (const s of choice.picks) names.add(lower(s.name))
  return names
}

interface Part {
  status: OptionPrereqStatus
  text: string
}

function levelPart(
  level: NonNullable<OptionPrerequisite['level']>,
  ctx: OptionPrereqContext,
): Part {
  const { character } = ctx
  if (typeof level === 'number') {
    const total = character.classes.reduce((n, c) => n + c.level, 0)
    return { status: total >= level ? 'met' : 'unmet', text: `Level ${level}` }
  }
  const className = level.class?.name
  const subclass = level.subclass?.name
  const text = [`Level ${level.level}`, className ?? '', subclass ? `(${subclass})` : '']
    .filter(Boolean)
    .join(' ')
  if (!className) {
    const total = character.classes.reduce((n, c) => n + c.level, 0)
    return { status: total >= level.level ? 'met' : 'unmet', text }
  }
  // The class's book is not checked: a 2024 option for a 2014 class is flagged for its
  // edition instead, so the reason says what is really wrong.
  const met = character.classes.some(
    (c) =>
      lower(c.name) === lower(className) &&
      (subclass === undefined ||
        lower(c.subclass?.shortName ?? '') === lower(subclass) ||
        lower(c.subclass?.name ?? '') === lower(subclass)) &&
      c.level >= level.level,
  )
  return { status: met ? 'met' : 'unmet', text }
}

function spellPart(
  spell: NonNullable<OptionPrerequisite['spell']>[number],
  ctx: OptionPrereqContext,
): Part {
  if (typeof spell !== 'string') {
    // "a Warlock cantrip that deals damage": the choice the option applies to.
    return {
      status: 'unknown',
      text: stripTags(spell.entrySummary ?? spell.entry ?? spell.choose),
    }
  }
  // "eldritch blast#c" is a cantrip; "hex/curse#x" is the hex spell or a curse feature.
  const [names, tag] = spell.split('#')
  const [name, alternative] = names.split('/')
  const spellName = name.replace(/\|.*$/, '')
  const known = knownSpells(ctx.character)
  const title = spellName.replace(/\b\w/g, (c) => c.toUpperCase())
  if (tag === 'x' && alternative) {
    const met =
      known.has(lower(spellName)) ||
      [...ctx.features].some((f) => f.includes(lower(alternative)))
    return {
      status: met ? 'met' : 'unmet',
      text: `The ${title} spell or a warlock feature that curses`,
    }
  }
  return {
    status: known.has(lower(spellName)) ? 'met' : 'unmet',
    text: tag === 'c' ? `The ${title} cantrip` : `The ${title} spell`,
  }
}

/** The parts of one prerequisite block, every one of which must hold. */
function partsOf(block: OptionPrerequisite, ctx: OptionPrereqContext): Part[] {
  const parts: Part[] = []
  if (block.level !== undefined) parts.push(levelPart(block.level, ctx))
  if (block.pact) {
    const name = `Pact of the ${block.pact}`
    const met = [...ctx.held].some((k) => lower(k.split('|')[0]) === lower(name))
    parts.push({ status: met ? 'met' : 'unmet', text: name })
  }
  for (const key of block.optionalfeature ?? []) {
    const met = [...ctx.held].some((k) => lower(k) === lower(key))
    parts.push({ status: met ? 'met' : 'unmet', text: optionName(key, ctx.held) })
  }
  for (const spell of block.spell ?? []) parts.push(spellPart(spell, ctx))
  if (block.otherSummary) {
    parts.push({
      status: 'unknown',
      text: stripTags(block.otherSummary.entrySummary ?? block.otherSummary.entry),
    })
  }
  return parts
}

const levelOf = (block: OptionPrerequisite) =>
  typeof block.level === 'number' ? block.level : block.level?.level

/**
 * Whether a prerequisite list is met. The blocks are alternatives (any one will do);
 * the parts of a block all must hold. An item an infusion goes on is not a
 * prerequisite of the character and is left to the Item fact.
 */
export function optionPrereqs(
  prerequisite: readonly OptionPrerequisite[] | undefined,
  ctx: OptionPrereqContext,
): OptionPrereqResult {
  const blocks = (prerequisite ?? [])
    .map((block) => ({ block, parts: partsOf(block, ctx) }))
    .filter((b) => b.parts.length > 0)
  if (blocks.length === 0) return { status: 'met', text: '' }
  const text = blocks.map((b) => b.parts.map((p) => p.text).join(', ')).join('; or ')
  const level = blocks.map((b) => levelOf(b.block)).find((l) => l !== undefined)
  const statusOf = (parts: Part[]): OptionPrereqStatus =>
    parts.some((p) => p.status === 'unmet')
      ? 'unmet'
      : parts.some((p) => p.status === 'unknown')
        ? 'unknown'
        : 'met'
  const statuses = blocks.map((b) => statusOf(b.parts))
  if (statuses.includes('met')) return { status: 'met', text, level }
  if (statuses.includes('unknown')) return { status: 'unknown', text, level }
  const missing = blocks[0].parts
    .filter((p) => p.status === 'unmet')
    .map((p) => p.text)
    .join(', ')
  return { status: 'unmet', text, missing, level }
}
