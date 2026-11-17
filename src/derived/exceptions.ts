// The rules exceptions of a character: every place where the build departs from the standard
// rules and is allowed anyway (with the DM's approval), gathered from the flags the creator
// already raises. This collects; it never judges again. Each exception names the rule and the
// creator section where it is set, so the sheet can link to it.

import { characterAbilityTotals } from '../character/derive'
import type { Character } from '../character/model'
import type { PickCard, PickKind } from '../character/picks'
import { appConfig } from '../config/app'
import { indexItems, resolveInventoryItem, unlistedItem } from '../character/inventory'
import { characterCasters } from '../character/spellcasting'
import { EMPTY_SELECTION, tiersOf } from '../character/spellTiers'
import { beastFit, wildShapeLimits } from '../rules/wildshape'
import { carriedWeight, carryingCapacity } from '../rules/equipment'
import { raceSize } from '../data/race'
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
import { MASTERY_MARK, masteryChange } from './weaponMastery'
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
      if (card.tag.endsWith(MASTERY_MARK)) {
        const { changed, over } = masteryChange(sources, card)
        if (changed > 0) {
          add(
            `mastery-change:${card.tag}`,
            'Weapon mastery change',
            `${card.label}: ${changed} changed since your last Long Rest${over ? ', more than the one allowed' : ''}; the rules make the change when you finish a Long Rest.`,
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

  out.push(...spellCountExceptions(sources, deps))
  out.push(...wildShapeExceptions(sources, deps))
  out.push(...itemExceptions(character, sources, deps))
  return out
}

/** Cantrips, spells known and spells prepared beyond what a class gets at its level. */
function spellCountExceptions(sources: Sources, deps: DeriveDeps): RuleException[] {
  const { character, summary } = sources
  const casters = characterCasters(character, deps.classByKey, summary.abilityBonus)
  return casters.flatMap((caster) =>
    tiersOf(caster, character.spells[caster.classKey] ?? EMPTY_SELECTION)
      .filter((t) => t.max !== undefined && t.count > t.max)
      .map((t) => ({
        id: `spell-count:${t.id}`,
        rule: 'More spells than allowed',
        detail: `${caster.name}: ${t.count} ${t.noun} chosen, ${t.max} allowed.`,
        section: 'spells' as const,
      })),
  )
}

/** Wild Shape forms outside the limits of the druid's level. */
function wildShapeExceptions(sources: Sources, deps: DeriveDeps): RuleException[] {
  const druids = sources.classes.filter((c) => c.row.name === 'Druid')
  if (druids.length === 0) return []
  const level = druids.reduce((n, c) => n + c.level, 0)
  const moon = druids.some((c) => c.row.subclass?.shortName === 'Moon')
  const limits = wildShapeLimits(level, moon, deps.editionOf?.(druids[0].row.source))
  const forms = sources.character.wildShapes
  // The 2024 druid knows a number of forms by level; the 2014 rule has no count.
  const count: RuleException[] =
    limits.knownForms !== undefined && forms.length > limits.knownForms
      ? [
          {
            id: 'wild-shape-count',
            rule: 'More Wild Shape forms than known',
            detail: `${forms.length} forms chosen, ${limits.knownForms} known at druid level ${limits.level}.`,
            section: 'wildshape',
          },
        ]
      : []
  if (!deps.beasts) return count
  const known = new Map(deps.beasts.map((b) => [`${b.name}|${b.source}`, b]))
  const flagged = forms.flatMap((ref) => {
    const beast = known.get(`${ref.name}|${ref.source}`)
    const fit = beast && beastFit(beast, limits)
    return beast && fit && !fit.standard
      ? [
          {
            id: `wild-shape:${ref.name}|${ref.source}`,
            rule: 'Wild Shape form',
            detail: `${beast.name}: ${fit.reason}.`,
            section: 'wildshape' as const,
          },
        ]
      : []
  })
  return [...count, ...flagged]
}

/** The items carried against the limits the rules set on them. */
function itemExceptions(
  character: Character,
  sources: Sources,
  deps: DeriveDeps,
): RuleException[] {
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
  }
  // Every stack carried, equipped or not: attuning has its class restriction either way.
  const catalog = indexItems(deps.items ?? [])
  const owned = character.equipment.items.map((stack) => ({
    stack,
    item: resolveInventoryItem(stack, catalog) ?? unlistedItem(stack),
  }))
  for (const { stack, item } of owned) {
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
  const carried = carriedWeight(
    owned.map(({ stack, item }) => ({ quantity: stack.quantity, weight: item.weight })),
    character.equipment.currency,
  ).pounds
  const capacity = strength > 0 ? carryingCapacity(strength, raceSize(sources.race)) : 0
  if (capacity > 0 && carried > capacity) {
    out.push({
      id: 'carrying-capacity',
      rule: 'Carrying capacity',
      detail: `Carrying ${Math.round(carried * 10) / 10} lb; the character can carry ${capacity} lb.`,
      section: 'equipment',
    })
  }
  return out
}
