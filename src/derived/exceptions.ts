// The rules exceptions of a character: every place where the build departs from the standard
// rules and is allowed anyway (with the DM's approval), gathered from the flags the creator
// already raises. This collects; it never judges again. Each exception names the rule and the
// creator section where it is set, so the sheet can link to it.

import { characterAbilityTotals } from '../character/derive'
import type { Character } from '../character/model'
import type { PickCard, PickKind } from '../character/picks'
import { appConfig } from '../config/app'
import { checkLevelCap, checkMulticlass, checkOriginIncreases } from '../rules/compliance'
import { canCustomizeOrigin } from '../rules/customOrigin'
import { attunedCount, lacksClass, strengthNeeded } from '../rules/equipment'
import { editionMix, editionMixReason } from '../rules/originMix'
import { multiclassRequirements } from '../data/class'
import { classEntryScores } from '../character/feats'
import { unassignedAbilities } from '../character/stats'
import type { ChecklistTarget } from './checklist'
import { isFightingStyleCard } from './classOptions'
import type { OptionalSwitch } from './grantBlocks'
import { OTHER_KINDS, strayPicks, type OtherKind } from './pickCards'
import type { DeriveDeps, Sources } from './sources'

/** One departure from the standard rules, and where it is set. */
export interface RuleException {
  /** Stable key. */
  id: string
  /** The rule departed from, short: "Multiclass prerequisite". */
  rule: string
  /** What is non-standard here, in words. */
  detail: string
  /** The creator section the choice is made in. */
  section: ChecklistTarget
}

/** What the sheet has worked out that the exceptions read. */
export interface ExceptionInputs {
  sources: Sources
  deps: DeriveDeps
  /** The cards of every source of picks, by the section that shows them. */
  classOptions: PickCard[]
  picks: PickCard[]
  skills: PickCard[]
  expertise: PickCard[]
  optionals: OptionalSwitch[]
  /** The tag of every source that grants something. */
  grantTags: string[]
}

const FEAT_FLAG_RULES: Partial<Record<string, string>> = {
  prerequisite: 'Feat prerequisite',
  repeat: 'Feat taken twice',
  category: 'Feat category',
  cap: 'Ability score cap',
}

const ORIGIN_SECTION: Record<string, ChecklistTarget> = {
  'origin-increase:race': 'race',
  'origin-increase:background': 'background',
  'ability-cap:background': 'background',
}

const COMPLIANCE_RULES = {
  'multiclass-req': 'Multiclass prerequisite',
  'level-cap': 'Level cap',
  'origin-increase': 'Origin ability increases',
  'ability-cap': 'Ability score cap',
  'off-list': 'Choice off the list',
} as const

export function collectExceptions({
  sources,
  deps,
  classOptions,
  picks,
  skills,
  expertise,
  optionals,
  grantTags,
}: ExceptionInputs): RuleException[] {
  const { character, summary } = sources
  const out: RuleException[] = []
  const add = (id: string, rule: string, detail: string, section: ChecklistTarget) =>
    out.push({ id, rule, detail, section })

  // Compliance: the multiclass prerequisites, the level cap and the origin increases.
  const requirements = new Map(
    [...deps.classByKey].map(([key, loaded]) => [
      key,
      multiclassRequirements(loaded.entry),
    ]),
  )
  const unset = unassignedAbilities(character.abilities, character.statMethod)
  const level = character.classes.reduce((sum, c) => sum + (c.level || 0), 0)
  for (const d of [
    ...checkMulticlass(
      character.classes,
      requirements,
      classEntryScores(character, summary),
      unset,
    ),
    ...checkLevelCap(level),
    ...checkOriginIncreases(character, sources.race, sources.background),
  ]) {
    add(d.id, COMPLIANCE_RULES[d.category], d.message, ORIGIN_SECTION[d.id] ?? 'class')
  }

  // Optional rules switched on, and origins mixed.
  if (character.race?.customOrigin && sources.race && canCustomizeOrigin(sources.race)) {
    add(
      'optional:custom-origin',
      'Customizing Your Origin (optional rule)',
      "The race's ability increases are placed freely, from Tasha's Cauldron of Everything.",
      'race',
    )
  }
  for (const o of optionals.filter((s) => s.on)) {
    add(
      `optional:${o.id}`,
      'Optional rule',
      `${o.card.label}: ${o.text}`,
      'proficiencies',
    )
  }
  if (sources.background && editionMix(character)) {
    add(
      'edition-mix',
      'Origin increases from both',
      editionMixReason(sources.race, sources.background),
      'background',
    )
  }

  // Feats: the slot flags that say a rule is broken (not the ones that say a choice is open).
  for (const r of summary.slots) {
    for (const flag of r.flags) {
      const rule = FEAT_FLAG_RULES[flag.kind]
      if (rule)
        add(
          `feat:${r.slot.id}:${flag.kind}`,
          rule,
          `${r.slot.label}: ${flag.message}`,
          'feats',
        )
    }
  }

  // Picks: an option whose prerequisite is not met, and more picks than a source allows.
  const cards: { cards: PickCard[]; section: (card: PickCard) => ChecklistTarget }[] = [
    {
      cards: classOptions,
      section: (c) => (isFightingStyleCard(c) ? 'combat' : 'class'),
    },
    { cards: picks, section: () => 'proficiencies' },
    { cards: skills, section: () => 'skills' },
    { cards: expertise, section: () => 'skills' },
  ]
  for (const { cards: list, section } of cards) {
    for (const card of list) {
      for (const chip of card.chips) {
        if (chip.state === 'picked' && chip.unmet) {
          add(
            `unmet:${card.tag}:${chip.value}`,
            'Option prerequisite',
            `${card.label}: ${chip.label}: ${chip.unmet}`,
            section(card),
          )
        }
      }
      if (card.over) {
        add(
          `over:${card.tag}`,
          'More choices than allowed',
          `${card.label}: ${card.used} ${card.noun} chosen, ${card.count} allowed`,
          section(card),
        )
      }
    }
  }

  // Picks no source of the character gives: skills, languages, tools, weapons and armor.
  const tags = new Set(grantTags)
  const choices = { picks: character.grantPicks, alt: character.grantAlt }
  const kinds: PickKind[] = ['skill', ...(Object.keys(OTHER_KINDS) as OtherKind[])]
  for (const kind of kinds) {
    for (const stray of strayPicks(choices, kind, tags)) {
      add(
        `stray:${kind}:${stray.value}`,
        'Choice off the list',
        `${stray.value} (${kind}) is ${stray.orphan ? 'no longer offered by' : 'not offered by'} your class, background, race or feats.`,
        kind === 'skill' ? 'skills' : 'proficiencies',
      )
    }
  }

  out.push(...itemExceptions(character, sources))
  return out
}

/** The items carried against the limits the rules set on them. */
function itemExceptions(character: Character, sources: Sources): RuleException[] {
  const out: RuleException[] = []
  const limit = appConfig.rules.attunementLimit
  const attuned = attunedCount(character.equipment.items)
  if (attuned > limit) {
    out.push({
      id: 'attunement-limit',
      rule: 'Attunement limit',
      detail: `Attuned to ${attuned} items; the limit is ${limit}.`,
      section: 'equipment',
    })
  }
  const strength = characterAbilityTotals(character, sources.summary.abilityBonus).str
  const classNames = character.classes.map((c) => c.name.toLowerCase())
  for (const { stack, item } of sources.items) {
    const needed = stack.equipped
      ? strengthNeeded(item.armor?.strength, strength)
      : undefined
    if (needed !== undefined) {
      out.push({
        id: `strength:${item.key}`,
        rule: 'Armor Strength requirement',
        detail: `${item.name} needs Strength ${needed}; the character has ${strength}.`,
        section: 'equipment',
      })
    }
    const classes = item.attunement?.classes ?? []
    if (stack.attuned && lacksClass(classes, classNames)) {
      out.push({
        id: `attune-class:${item.key}`,
        rule: 'Attunement class requirement',
        detail: `${item.name} is attuned to by ${classes.join(' or ')}.`,
        section: 'equipment',
      })
    }
  }
  return out
}
