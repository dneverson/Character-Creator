// The grants of the features table (rules/featureGrants.ts) as the sheet reads every grant:
// the languages, tools and expertise as grant blocks, the skills as skill sources. A row
// is had while its feature is (an optional feature not taken, or the one it replaced, is
// not), from the class level it names.

import type { SkillSource, SkillSourceKind } from '../character/skills'
import { parseSkillGrants } from '../data/skills'
import { sharedKinds } from '../data/grants'
import { FEATURE_GRANTS, type FeatureGrant } from '../rules/featureGrants'
import { holderId } from '../rules/holder'
import type { GrantField } from './grantBlocks'
import { heldBy, type Sources } from './sources'
import type { SourceRef } from './types'

/** A row of the table the character has, with where it comes from. */
export interface HeldFeatureGrant {
  row: FeatureGrant
  source: SourceRef
  /** `<class tag>|<card>`: the tag its picks are stored under, shared by its skills. */
  tag: string
  label: string
  kind: SkillSourceKind
  /** The class's own list of skills at 1st level, for a pick of it. */
  classSkills: string[]
}

/** The skills a class lets its 1st-level character choose from. */
function classSkillList(sources: Sources, tag: string): string[] {
  const c = sources.classes.find((x) => `class:${x.row.name}|${x.row.source}` === tag)
  const raw = c?.loaded?.entry.startingProficiencies?.skills
  return parseSkillGrants(raw as unknown[] | undefined).choices.flatMap((x) => x.from)
}

export function heldFeatureGrants(sources: Sources): HeldFeatureGrant[] {
  return FEATURE_GRANTS.flatMap((row): HeldFeatureGrant[] => {
    const held = heldBy(sources, row.holder)
    if (!held || (row.level !== undefined && (held.classLevel ?? 0) < row.level))
      return []
    if (row.needs && !heldBy(sources, row.needs)) return []
    const index = sources.classes.findIndex(
      (c) => `class:${c.row.name}|${c.row.source}` === held.source.tag,
    )
    return [
      {
        row,
        source: held.source,
        tag: `${held.source.tag}|${row.card}`,
        label: `${index > 0 ? 'Multiclass' : 'Class'} · ${held.source.label} ${row.card}`,
        kind: index > 0 ? 'multiclass' : 'class',
        classSkills: row.classSkills ? classSkillList(sources, held.source.tag) : [],
      },
    ]
  })
}

/** The fields of a row that are grant blocks, with the id each is stored under. */
export function featureGrantFields(held: HeldFeatureGrant): {
  id: string
  fields: Partial<Record<GrantField, readonly unknown[]>>
} {
  const { row } = held
  const id = `${held.tag}|${holderId(row.holder)}|${row.level ?? ''}`
  return {
    id,
    fields: {
      languageProficiencies: row.languageProficiencies,
      toolProficiencies: row.toolProficiencies,
      skillToolLanguageProficiencies: row.skillToolLanguageProficiencies,
      expertise: row.expertise,
    },
  }
}

/** The skills of the rows had, one source per card, as the skill cards read them. */
export function featureSkillSources(sources: Sources): SkillSource[] {
  const byTag = new Map<string, SkillSource>()
  for (const held of heldFeatureGrants(sources)) {
    const { row } = held
    const { fixed, choices } = parseSkillGrants(row.skillProficiencies)
    if (row.classSkills) {
      const from = [...new Set([...held.classSkills, ...(row.classSkills.plus ?? [])])]
      choices.push({ count: row.classSkills.count, from })
    }
    if (fixed.length === 0 && choices.length === 0) continue
    const shares = sharedKinds(row.skillToolLanguageProficiencies)
    const into = byTag.get(held.tag)
    if (into) {
      into.fixed.push(...fixed.filter((s) => !into.fixed.includes(s)))
      into.choices.push(...choices)
      continue
    }
    byTag.set(held.tag, {
      tag: held.tag,
      label: held.label,
      kind: held.kind,
      fixed,
      choices,
      ...(shares.length > 0 ? { shares } : {}),
    })
  }
  return [...byTag.values()]
}
