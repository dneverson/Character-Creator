// The proficiencies a character has, each with where it comes from: the first class's
// starting list, the lists later classes give a multiclass character, the species, the
// background, the feats taken, the features that grant them in text (a table of
// rules), what the player picked from a grant that lets them choose, and the item that
// makes its wielder proficient. Every list the data gives is read once, by `readGrant`
// (see grantBlocks); the older class lists in words are read the same way. A grant that
// offers a pick (Weapon Master) is not a proficiency until the pick is made.

import type { Item } from '../data/items'
import type { ClassEntry } from '../data/class'
import {
  readGrant,
  readWeaponFilter,
  valueText,
  type GrantKind,
  type GrantValue,
} from '../data/grants'
import {
  PROFICIENCY_GRANTS,
  type ArmorKind,
  type WeaponGrant,
} from '../rules/proficiencyGrants'
import { ABILITY_NAMES } from '../dice/dice'
import { SAVE_RULES } from '../rules/saveRules'
import { MANUAL_TAG, picksOf } from '../character/picks'
import {
  activeParts,
  classGrantBlocks,
  grantBlocks,
  grantState,
  type GrantChoices,
  type OpenPick,
} from './grantBlocks'
import { heldBy, type HeldItem, type Sources } from './sources'
import { mergeListings, type Listing, type ListingEntry, type SourceRef } from './types'

export { readWeaponFilter }

export interface ReadBlocks<T> {
  grants: T[]
  /** Keys the reader does not know: the data audit fails on any. */
  unknown: string[]
}

/** The weapon a value grants: a category, a firearm, a named weapon or a filter. */
function weaponGrantOf(value: GrantValue): WeaponGrant | undefined {
  if (value.filter !== undefined) return readWeaponFilter(value.filter)
  if (value.key === 'simple' || value.key === 'martial') return { category: value.key }
  if (value.key === 'firearms') return { firearms: true }
  // Improvised weapons are not items, so there is nothing to match them with.
  if (value.key === 'improvised') return undefined
  return { name: value.key }
}

/** Every value of every alternative of a grant. */
function readValues(blocks: readonly unknown[], kind: GrantKind) {
  const read = readGrant(blocks, kind)
  return { values: read.alternatives.flatMap((a) => a.fixed), unknown: read.unknown }
}

/** The armor a list of blocks (or words) grants. */
export function readArmorBlocks(blocks: readonly unknown[]): ReadBlocks<ArmorKind> {
  const { values, unknown } = readValues(blocks, 'armor')
  return { grants: values.map((v) => v.key as ArmorKind), unknown }
}

/** The weapons a list of blocks (or words) grants. */
export function readWeaponBlocks(blocks: readonly unknown[]): ReadBlocks<WeaponGrant> {
  const { values, unknown } = readValues(blocks, 'weapon')
  return {
    grants: values.flatMap((v) => {
      const grant = weaponGrantOf(v)
      return grant ? [grant] : []
    }),
    unknown,
  }
}

/** A class's armor and weapon lists as blocks: the structured form when it has one. */
export function classProficiencyBlocks(
  entry: ClassEntry,
  first: boolean,
): { armor: readonly unknown[]; weapons: readonly unknown[] } {
  const { armor, weapons } = classGrantBlocks(entry, first)
  return { armor, weapons }
}

export interface ArmorProficiency {
  kind: ArmorKind
  source: SourceRef
}

export interface WeaponProficiency {
  grant: WeaponGrant
  source: SourceRef
}

/** The proficiencies as the sheet lists them, each value with every source that gives it. */
export interface ProficiencyListing {
  armor: Listing[]
  weapon: Listing[]
  tool: Listing[]
  language: Listing[]
  save: Listing[]
}

export interface Proficiencies {
  armor: ArmorProficiency[]
  weapons: WeaponProficiency[]
  listing: ProficiencyListing
  /** The picks the grants still wait for. */
  open: OpenPick[]
}

const ARMOR_NAMES: Record<ArmorKind, string> = {
  light: 'Light armor',
  medium: 'Medium armor',
  heavy: 'Heavy armor',
  shield: 'Shields',
}

const PROPERTY_NAMES: Record<string, string> = {
  L: 'light',
  F: 'finesse',
  H: 'heavy',
  '2H': 'two-handed',
  T: 'thrown',
  V: 'versatile',
  R: 'reach',
  LD: 'loading',
  A: 'ammunition',
  S: 'special',
}

const titled = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** A weapon proficiency in words: "Martial weapons with the light or finesse property". */
export function weaponGrantText(grant: WeaponGrant): string {
  if (grant.firearms) return 'Firearms'
  if (grant.name) return titled(grant.name)
  const names = (codes: string[]) => codes.map((c) => PROPERTY_NAMES[c] ?? c)
  const kind = [
    grant.category ?? '',
    grant.melee ? 'melee' : grant.ranged ? 'ranged' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const parts = [
    `${kind} weapons`.trim(),
    grant.anyProperty ? `with the ${names(grant.anyProperty).join(' or ')} property` : '',
    grant.noProperty
      ? `without the ${names(grant.noProperty).join(' or ')} property`
      : '',
  ].filter(Boolean)
  return titled(parts.join(' '))
}

/** The source a pick outside every list is charged to. */
const NON_STANDARD: SourceRef = {
  kind: 'manual',
  tag: MANUAL_TAG,
  label: 'Non-standard (DM approval)',
}

export function proficiencies(
  sources: Sources,
  choices: GrantChoices = {},
): Proficiencies {
  const armor: ArmorProficiency[] = []
  const weapons: WeaponProficiency[] = []
  const entries = {
    tool: [] as ListingEntry[],
    language: [] as ListingEntry[],
    save: [] as ListingEntry[],
  }
  const blocks = grantBlocks(sources)
  const state = grantState(blocks, choices)

  const give = (value: GrantValue, source: SourceRef) => {
    if (value.kind === 'armor') armor.push({ kind: value.key as ArmorKind, source })
    else if (value.kind === 'weapon') {
      const grant = weaponGrantOf(value)
      if (grant) weapons.push({ grant, source })
    } else if (
      value.kind === 'tool' ||
      value.kind === 'language' ||
      value.kind === 'save'
    ) {
      entries[value.kind].push({ value: valueText(value), source })
    }
  }
  for (const { value, source } of state.granted) give(value, source)
  // What the player picked, charged to the source that offered it.
  const tagSources = new Map(blocks.map((b) => [b.source.tag, b.source]))
  for (const kind of ['tool', 'language', 'armor', 'weapon'] as const) {
    for (const [key, tag] of Object.entries(picksOf(choices.picks, kind))) {
      give({ kind, key }, tagSources.get(tag) ?? NON_STANDARD)
    }
  }
  // A saving throw pick counts while its feature offers the choice: Iron Mind offers it
  // only when the character already has its Wisdom save.
  const saveChoosers = new Map(
    blocks
      .filter(
        (b) =>
          b.feature !== undefined &&
          activeParts(b, choices).some((p) => p.picks.length > 0),
      )
      .map((b) => [b.card.tag, b.source]),
  )
  for (const [key, tag] of Object.entries(picksOf(choices.picks, 'save'))) {
    const source = saveChoosers.get(tag)
    if (source) give({ kind: 'save', key }, source)
  }
  for (const grant of PROFICIENCY_GRANTS) {
    const held = heldBy(sources, grant.holder)
    if (!held) continue
    for (const kind of grant.armor ?? []) armor.push({ kind, source: held.source })
    for (const one of grant.weapons ?? [])
      weapons.push({ grant: one, source: held.source })
    for (const tool of grant.tools ?? [])
      give({ kind: 'tool', key: tool.toLowerCase() }, held.source)
    for (const language of grant.languages ?? [])
      give({ kind: 'language', key: language.toLowerCase() }, held.source)
  }
  for (const rule of SAVE_RULES) {
    const held = heldBy(sources, rule.holder)
    if (!held || rule.effect.kind !== 'proficiency') continue
    for (const ability of rule.effect.abilities)
      entries.save.push({ value: ABILITY_NAMES[ability], source: held.source })
  }
  return {
    armor,
    weapons,
    listing: {
      armor: mergeListings(
        armor.map((a) => ({ value: ARMOR_NAMES[a.kind], source: a.source })),
      ),
      weapon: mergeListings(
        weapons.map((w) => ({ value: weaponGrantText(w.grant), source: w.source })),
      ),
      tool: mergeListings(entries.tool),
      language: mergeListings(entries.language),
      save: mergeListings(entries.save),
    },
    open: state.open,
  }
}

/** Whether a weapon (an item of a base name) meets every condition a grant names. */
export function grantCovers(grant: WeaponGrant, item: Item, baseName: string): boolean {
  const weapon = item.weapon
  if (grant.firearms) return item.firearm === true
  if (grant.category && weapon?.category !== grant.category) return false
  if (grant.name && grant.name !== baseName.toLowerCase()) return false
  const codes = weapon?.properties.map((p) => p.code) ?? []
  if (grant.anyProperty && !grant.anyProperty.some((c) => codes.includes(c))) return false
  if (grant.noProperty?.some((c) => codes.includes(c))) return false
  if (grant.melee !== undefined && weapon?.melee !== grant.melee) return false
  if (grant.ranged !== undefined && weapon?.melee === grant.ranged) return false
  return true
}

/** What makes the character proficient with a weapon, or undefined if nothing does. */
export function weaponProficiency(
  all: Proficiencies,
  held: HeldItem,
): SourceRef | undefined {
  const found = all.weapons.find((w) => grantCovers(w.grant, held.item, held.baseName))
  if (found) return found.source
  // Proficiency with a named weapon makes the wielder proficient with a weapon like it.
  const via = PROFICIENCY_GRANTS.find(
    (g) => 'item' in g.holder && g.holder.item === held.item.key,
  )?.via
  const kin = via
    ?.map((v) =>
      all.weapons.find(
        (w) =>
          w.grant.name === v.name ||
          (w.grant.category === v.category &&
            !w.grant.name &&
            !w.grant.anyProperty &&
            !w.grant.noProperty &&
            w.grant.melee === undefined &&
            w.grant.ranged === undefined),
      ),
    )
    .find((w) => w !== undefined)
  if (kin) return kin.source
  return held.item.grantsProficiency ? held.source : undefined
}

/** The source of proficiency with an armor kind, or undefined. */
export function armorProficiency(
  all: Proficiencies,
  kind: ArmorKind,
): SourceRef | undefined {
  return all.armor.find((a) => a.kind === kind)?.source
}

export const isArmorItem = (item: Item) =>
  item.armor?.class === 'light' ||
  item.armor?.class === 'medium' ||
  item.armor?.class === 'heavy'
