// The derived sheet: every number the sheet shows, worked out once from the character
// and the loaded data, each with the lines it adds up from. Sections and the PDF read
// this and never work a number out for themselves.

import type { AbilityKey } from '../dice/dice'
import { characterAbilityTotals, totalLevel } from '../character/derive'
import { hpBreakdown } from '../character/hp'
import { proficiencyBonus } from '../data/skills'
import { buildSkillSources, skillCards } from '../character/skills'
import type { BeastRef, Character } from '../character/model'
import type { PickCard } from '../character/picks'
import { armorClass, type AbilityTotals } from './armorClass'
import { attackRows, type AttackRow } from './attacks'
import {
  altChoices,
  grantBlocks,
  optionalSwitches,
  type AltChoice,
  type GrantChoices,
  type OptionalSwitch,
} from './grantBlocks'
import { skillTable, type ExpertiseState } from './expertise'
import { hpQuantity } from './hp'
import { itemBonus } from './itemBonus'
import { pickCards } from './pickCards'
import { proficiencies, type Proficiencies } from './proficiencies'
import type { Edition } from '../data/edition'
import { characterEdition } from './edition'
import { hitDice, type HitDie } from './hitDice'
import { senseRows, type SenseRow } from './senses'
import { deriveSlots, type DerivedSlots } from './slots'
import { speedQuantity } from './speed'
import { abilityQuantities } from './abilities'
import { saveRows, type SaveRow } from './saves'
import { skillTotals, type DerivedSkill } from './skillTotals'
import { buildChecklist, type Checklist } from './checklist'
import { combatNumbers, type CombatNumbers } from './combat'
import { classOptionCards } from './classOptions'
import { featureRows, type FeatureRow } from './features'
import { collectSources, type DeriveDeps } from './sources'
import { spellStats, type SpellStatRow } from './spellStats'
import { BASE_SOURCE, quantity, type Quantity } from './types'

export interface DerivedSheet {
  prof: Quantity
  totals: AbilityTotals
  /** Each ability score with the lines it adds up from. */
  abilities: Record<AbilityKey, Quantity>
  /** The six saving throws. */
  saves: Record<AbilityKey, SaveRow>
  ac: Quantity
  /** Walking speed, with the other ways of moving as notes. */
  speed: Quantity
  /** The senses, each with its range in feet. */
  senses: SenseRow[]
  /** The hit dice by die size. */
  hitDice: HitDie[]
  /** The spell slots, the Pact Magic slots and the combined caster level. */
  slots: DerivedSlots
  /** The rules edition that applies to the character. */
  edition: Edition
  /** Initiative and the passive scores. */
  combat: CombatNumbers
  attacks: AttackRow[]
  spellStats: SpellStatRow[]
  /** Every feature and trait: of the classes, the species, the background and the feats. */
  features: FeatureRow[]
  /** The beast forms the character can take with Wild Shape. */
  wildShapes: BeastRef[]
  proficiencies: Proficiencies
  /** The skill table: every skill with its modifier, and what makes it proficient. */
  skills: DerivedSkill[]
  /** The expertise the character has, and the cards to pick it with. */
  expertise: ExpertiseState
  /** A card for each source that lets the player choose a language, tool, weapon or armor. */
  picks: PickCard[]
  /** A card for each fighting style a class lets the player choose. */
  classOptions: PickCard[]
  /** The grants with several alternatives, and which the player took. */
  alternatives: AltChoice[]
  /** The grants the player can switch on. */
  optionals: OptionalSwitch[]
  /** The tag of every source that grants something, to tell a stray pick from a placed one. */
  grantTags: string[]
  /** How many picks of the grants are not made yet. */
  choicesOpen: number
  /** What the build still needs, and which creator sections are open or complete. */
  checklist: Checklist
  hp: Quantity
}

export function deriveSheet(character: Character, deps: DeriveDeps): DerivedSheet {
  const sources = collectSources(character, deps)
  const totals = characterAbilityTotals(character, sources.summary.abilityBonus)
  const level = totalLevel(character)
  const prof = quantity([
    {
      id: 'prof|level',
      label: `Level ${Math.max(1, level)}`,
      source: BASE_SOURCE,
      amount: proficiencyBonus(level),
      op: 'base',
      status: 'applied',
    },
    ...sources.items.flatMap((held) => {
      const amount = itemBonus(held.item, 'bonusProficiencyBonus')
      return amount === 0
        ? []
        : [
            {
              id: `prof|item|${held.item.key}`,
              label: held.item.name,
              source: held.source,
              amount,
              op: 'add' as const,
              status: held.active ? ('applied' as const) : ('inactive' as const),
              ...(held.active
                ? {}
                : { why: 'Needs attunement, and you are not attuned.' }),
            },
          ]
    }),
  ])
  const choices: GrantChoices = { picks: character.grantPicks, alt: character.grantAlt }
  const known = proficiencies(sources, choices)
  const blocks = grantBlocks(sources)
  const skillSources = [
    ...buildSkillSources(character, deps.classByKey, deps.background, deps.race),
    ...sources.summary.skillSources,
  ]
  const table = skillTable(character, sources, skillSources, sources.summary.abilityBonus)
  const ac = armorClass(sources, totals, known)
  const catalog = {
    languages: deps.languages ?? [],
    items: deps.items ?? [],
    books: character.selectedBooks,
  }
  const classOptions = classOptionCards(sources, deps.fightingStyles ?? [])
  const breakdown = hpBreakdown(character, deps.classByKey, sources.summary)
  const rolled = character.hp.method === 'rolled' && breakdown.rolledHP !== undefined
  return {
    prof,
    totals,
    abilities: abilityQuantities(character, sources),
    saves: saveRows(sources, totals, prof.value, known),
    ac,
    speed: speedQuantity(sources),
    senses: senseRows(sources),
    hitDice: hitDice(character, deps.classByKey),
    slots: deriveSlots(character, deps.classByKey, sources),
    edition: characterEdition(character, deps.editionOf),
    combat: combatNumbers(sources, totals, table.rows, prof.value),
    attacks: attackRows(sources, totals, prof.value, known, ac.lines),
    spellStats: spellStats(sources, deps, totals, prof.value, ac.lines),
    features: featureRows(sources),
    wildShapes: character.wildShapes,
    proficiencies: known,
    skills: skillTotals(
      table.rows,
      skillSources,
      sources,
      totals,
      prof.value,
      table.expertise.held,
    ),
    expertise: table.expertise,
    picks: pickCards(sources, choices, catalog, known.listing),
    classOptions,
    alternatives: altChoices(blocks, choices),
    optionals: optionalSwitches(blocks, choices),
    grantTags: [...new Set(blocks.map((b) => b.card.tag))],
    // The expertise of a feat is a pick of its own card, counted there with the classes'.
    choicesOpen:
      known.open
        .filter((o) => !o.spec.kinds.includes('expertise'))
        .reduce((n, o) => n + o.left, 0) +
      table.expertise.cards.reduce((n, c) => n + c.left, 0),
    hp: hpQuantity(character, breakdown, rolled),
    checklist: buildChecklist({
      sources,
      deps,
      openPicks: known.open,
      skills: skillCards(character, skillSources, table.rows),
      expertise: table.expertise.cards,
      classOptions,
    }),
  }
}
