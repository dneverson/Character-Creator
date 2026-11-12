// The 18 standard D&D 5e skills and their governing ability. Skill keys match
// the lowercase identifiers used throughout 5etools data (e.g. background
// `skillProficiencies`), so they can be compared directly without translation.

import { memoizeContent } from '../content/epoch'
import type { AbilityKey } from '../dice/dice'
import type { Entry } from '../text/Entries'
import { fetchData } from './dataClient'
import { loadBookEditions, type Edition } from './edition'

export interface SkillDef {
  /** Lowercase key as used in 5etools data (e.g. "animal handling"). */
  key: string
  /** Display label. */
  label: string
  /** Governing ability. */
  ability: AbilityKey
}

export const SKILLS: SkillDef[] = [
  { key: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
  { key: 'animal handling', label: 'Animal Handling', ability: 'wis' },
  { key: 'arcana', label: 'Arcana', ability: 'int' },
  { key: 'athletics', label: 'Athletics', ability: 'str' },
  { key: 'deception', label: 'Deception', ability: 'cha' },
  { key: 'history', label: 'History', ability: 'int' },
  { key: 'insight', label: 'Insight', ability: 'wis' },
  { key: 'intimidation', label: 'Intimidation', ability: 'cha' },
  { key: 'investigation', label: 'Investigation', ability: 'int' },
  { key: 'medicine', label: 'Medicine', ability: 'wis' },
  { key: 'nature', label: 'Nature', ability: 'int' },
  { key: 'perception', label: 'Perception', ability: 'wis' },
  { key: 'performance', label: 'Performance', ability: 'cha' },
  { key: 'persuasion', label: 'Persuasion', ability: 'cha' },
  { key: 'religion', label: 'Religion', ability: 'int' },
  { key: 'sleight of hand', label: 'Sleight of Hand', ability: 'dex' },
  { key: 'stealth', label: 'Stealth', ability: 'dex' },
  { key: 'survival', label: 'Survival', ability: 'wis' },
]

export const SKILL_KEYS: string[] = SKILLS.map((s) => s.key)

const SKILL_SET = new Set(SKILL_KEYS)

/** A "choose N from a list" skill grant, normalized across data shapes. */
export interface SkillChoice {
  count: number
  from: string[]
}

/** What a source (background/class/race) grants: fixed skills and/or choices. */
export interface SkillGrants {
  fixed: string[]
  choices: SkillChoice[]
}

/**
 * Normalize a 5etools skill-proficiency array. Handles the three shapes seen in
 * the data: `{ skill: true }` (fixed), `{ choose: { from, count } }`, and
 * `{ any: N }` (choose N from all skills).
 */
export function parseSkillGrants(blocks: unknown[] | undefined): SkillGrants {
  const fixed: string[] = []
  const choices: SkillChoice[] = []
  for (const block of blocks ?? []) {
    if (!block || typeof block !== 'object') continue
    for (const [k, v] of Object.entries(block as Record<string, unknown>)) {
      if (k === 'choose' && v && typeof v === 'object') {
        const c = v as { from?: string[]; count?: number }
        choices.push({
          count: c.count ?? 1,
          from: (c.from ?? []).filter((s) => SKILL_SET.has(s)),
        })
      } else if (k === 'any' && typeof v === 'number') {
        choices.push({ count: v, from: [...SKILL_KEYS] })
      } else if (SKILL_SET.has(k) && v === true) {
        if (!fixed.includes(k)) fixed.push(k)
      }
    }
  }
  return { fixed, choices }
}

/**
 * D&D proficiency bonus for a character level. Uses the RAW progression
 * (+2 at 1, +1 every 4 levels) and extends past 20 for off-standard builds.
 */
export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4)
}

const SKILL_BY_KEY = new Map(SKILLS.map((s) => [s.key, s]))

/** Look up a skill definition by its data key. */
export function skillByKey(key: string): SkillDef | undefined {
  return SKILL_BY_KEY.get(key)
}

/** Human label for a skill key, falling back to a title-cased key. */
export function skillLabel(key: string): string {
  return SKILL_BY_KEY.get(key)?.label ?? key.replace(/\b\w/g, (c) => c.toUpperCase())
}

/** What the books say a skill covers, one block per rules edition that prints it. */
export type SkillTexts = ReadonlyMap<string, { edition: Edition; entries: Entry[] }[]>

interface SkillsFile {
  skill: { name: string; source: string; entries?: Entry[] }[]
}

/** The text of every skill, by skill key. */
export const loadSkillTexts = memoizeContent(async (): Promise<SkillTexts> => {
  const [data, editionOf] = await Promise.all([
    fetchData<SkillsFile>('skills.json'),
    loadBookEditions(),
  ])
  const texts = new Map<string, { edition: Edition; entries: Entry[] }[]>()
  for (const row of data.skill) {
    const key = row.name.toLowerCase()
    texts.set(key, [
      ...(texts.get(key) ?? []),
      { edition: editionOf(row.source), entries: row.entries ?? [] },
    ])
  }
  return texts
})
