// What a character has to derive from: its classes with their subclass, race, taken
// feats, equipped items and the carried items that work while carried. This is the only
// place that knows how a character names its sources; every derived number asks here who
// holds a rule (`heldBy`) and what is worn or wielded, so no derivation reads the
// character's shape on its own.

import type { AbilityKey } from '../dice/dice'
import type { Character, ClassRef, InventoryItem } from '../character/model'
import { resolveFeats, type FeatSummary } from '../character/feats'
import { indexItems, resolveInventoryItem } from '../character/inventory'
import type { LoadedClass } from '../data/class'
import {
  ownClassFeatures,
  ownSubclassFeatures,
  subclassOf,
  subclassUnlockLevel,
} from '../data/class'
import type { PlayableBackground } from '../data/background'
import { holdsRace, type PlayableRace } from '../data/race'
import type { Feat } from '../data/feats'
import type { Item } from '../data/items'
import type { ClassOption } from '../data/classOptions'
import type { Language } from '../data/languages'
import type { Beast } from '../data/beasts'
import type { Edition } from '../data/edition'
import { rewardKey, type Reward } from '../data/rewards'
import type { Holder } from '../rules/holder'
import type { SourceRef } from './types'
import {
  featureChoiceSlots,
  featureChoiceState,
  featureWithheld,
  heldOptions,
  optionSlots,
  variantChoices,
  type FeatureChoiceSlot,
  type FeatureChoiceState,
  type OptionSlot,
} from './classOptions'
import { worksWhileCarried } from '../rules/carryRules'
import { holderId } from '../rules/holder'

/** What the derivation reads: the loaded data a character's choices refer to. */
export interface DeriveDeps {
  classByKey: Map<string, LoadedClass>
  background?: PlayableBackground
  race?: PlayableRace
  /** Loaded feats; feat choices only take effect when these are supplied. */
  feats?: Feat[]
  /** The item catalog; without it nothing is worn or wielded. */
  items?: readonly Item[]
  /** The languages of the books, for the language picks. */
  languages?: readonly Language[]
  /** The optional features of the books (invocations, maneuvers...), for the class options. */
  optionCatalog?: readonly ClassOption[]
  /** The supernatural gifts of the books, for the ones the character has. */
  rewards?: readonly Reward[]
  /** The beasts of the books, read only for a Druid with Wild Shape forms (for its limits). */
  beasts?: readonly Beast[]
  /** The rules edition of each book, from the books list; the 2024 books by name without it. */
  editionOf?: (source: string) => Edition
}

export interface HeldReward {
  reward: Reward
  source: SourceRef
}

export interface ClassSource {
  row: ClassRef
  loaded?: LoadedClass
  level: number
}

export interface HeldFeat {
  feat: Feat
  source: SourceRef
  /** The ability increases placed in the feat's slot (Resilient's saving throw follows it). */
  increases?: Partial<Record<AbilityKey, number>>
}

/** An equipped item, or one that works while carried, and whether its effects are in force. */
export interface HeldItem {
  stack: InventoryItem
  item: Item
  source: SourceRef
  /** The name of the item it is made of: "Longsword" for a "+1 Longsword". */
  baseName: string
  /** False while the item needs attunement the character has not made. */
  active: boolean
}

export interface Sources {
  character: Character
  summary: FeatSummary
  classes: ClassSource[]
  race?: PlayableRace
  background?: PlayableBackground
  feats: HeldFeat[]
  /** Every equipped item and every carried one that works while carried, in inventory order. */
  items: HeldItem[]
  /**
   * The optional features the character holds ("Defense|PHB"): picked in a slot of a
   * class, subclass, feat or option it has, or known outright.
   */
  options: ReadonlySet<string>
  /** Every slot of optional features the character has. */
  optionSlots: OptionSlot[]
  /**
   * Every feature that lists features to choose from, and every optional class feature
   * that replaces another (one or the other is taken).
   */
  featureSlots: FeatureChoiceSlot[]
  /**
   * The features of those choices, and of the optional class features, and which are
   * held: an offered one is held only when taken.
   */
  featureChoices: FeatureChoiceState
  /** The supernatural gifts the character has (rewards), each with its source. */
  rewards: HeldReward[]
  /** Whether a weapon of the item catalog, by lower-case name, is simple or martial. */
  weaponCategory: (name: string) => 'simple' | 'martial' | undefined
}

export function collectSources(character: Character, deps: DeriveDeps): Sources {
  const summary = resolveFeats(character, {
    feats: deps.feats ?? [],
    classByKey: deps.classByKey,
    race: deps.race,
    background: deps.background,
    optionCatalog: deps.optionCatalog,
  })
  const catalog = indexItems(deps.items ?? [])
  const items = character.equipment.items.flatMap((stack): HeldItem[] => {
    const item = resolveInventoryItem(stack, catalog)
    if (!item || !(stack.equipped || worksWhileCarried(item.kind, item.entries)))
      return []
    return [
      {
        stack,
        item,
        baseName: stack.base ? stack.base.split('|')[0] : item.name,
        source: { kind: 'item', tag: `item:${item.key}`, label: item.name },
        active: !item.attunement?.required || stack.attuned === true,
      },
    ]
  })
  const classes: ClassSource[] = character.classes.map((row) => ({
    row,
    loaded: deps.classByKey.get(`${row.name}|${row.source}`),
    level: Math.max(0, Math.floor(row.level || 0)),
  }))
  const feats: HeldFeat[] = summary.slots.flatMap((s) =>
    s.feat
      ? [
          {
            feat: s.feat,
            source: {
              kind: 'feat' as const,
              tag: `feat:${s.slot.id}`,
              label: s.feat.label,
            },
            increases: s.increases,
          },
        ]
      : [],
  )
  const slots = optionSlots(character, classes, feats, deps.optionCatalog ?? [])
  const variants = variantChoices(classes, character.selectedBooks)
  const featureSlots = [...featureChoiceSlots(classes), ...variants.slots]
  return {
    character,
    summary,
    classes,
    race: deps.race,
    background: deps.background,
    feats,
    items,
    // An option of a class, feat or option the character no longer has is not held.
    options: heldOptions(character, slots),
    optionSlots: slots,
    featureSlots,
    featureChoices: featureChoiceState(character, featureSlots, variants),
    rewards: heldRewards(character, deps.rewards ?? []),
    weaponCategory: weaponCategories(deps.items ?? []),
  }
}

/** The rewards the character has, found in the loaded list, in the order they were added. */
function heldRewards(character: Character, rewards: readonly Reward[]): HeldReward[] {
  const byKey = new Map(rewards.map((r) => [r.key, r]))
  return (character.rewards ?? []).flatMap((ref) => {
    const reward = byKey.get(rewardKey(ref))
    return reward
      ? [
          {
            reward,
            source: {
              kind: 'reward' as const,
              tag: `reward:${reward.key}`,
              label: reward.name,
            },
          },
        ]
      : []
  })
}

/** The weapons of the catalog by lower-case name, read once per catalog. */
const CATEGORIES = new WeakMap<readonly Item[], Sources['weaponCategory']>()

function weaponCategories(items: readonly Item[]): Sources['weaponCategory'] {
  const known = CATEGORIES.get(items)
  if (known) return known
  const byName = new Map<string, 'simple' | 'martial'>()
  for (const item of items) {
    const category = item.weapon?.category
    if (category && !byName.has(item.name.toLowerCase()))
      byName.set(item.name.toLowerCase(), category)
  }
  const read = (name: string) => byName.get(name)
  CATEGORIES.set(items, read)
  return read
}

/** A rule's holder as the character has it. */
export interface Held {
  source: SourceRef
  /** The class level the character is at in the holder's class, for a class feature. */
  classLevel?: number
  /** For an item: false while it needs attunement the character has not made. */
  active?: boolean
}

/**
 * The level a class or subclass feature arrives at, when the class (and its chosen
 * subclass) gives it: read from the features they name, so a `_copy` class or subclass
 * (the WoW Druid, its Circle of the Moon) holds the features of what it copies.
 */
function featureLevel(
  loaded: LoadedClass,
  holder: Holder,
  row: ClassRef,
): number | undefined {
  const own = ownClassFeatures(loaded)
  if ('classFeature' in holder) {
    const h = holder.classFeature
    return own.find(
      (f) => f.name === h.name && f.source === h.source && f.className === h.className,
    )?.level
  }
  if ('subclassFeature' in holder) {
    const h = holder.subclassFeature
    const subclass = subclassOf(loaded, row.subclass)
    const feature =
      subclass &&
      ownSubclassFeatures(loaded.file, subclass).find(
        (f) =>
          f.name === h.name &&
          f.source === h.source &&
          f.className === h.className &&
          f.subclassShortName === h.shortName,
      )
    if (!feature) return undefined
    // A 2014 subclass on a 2024 class arrives when that class's subclass does.
    const book = own[0]?.classSource ?? loaded.entry.source
    return feature.classSource === book
      ? feature.level
      : Math.max(feature.level, subclassUnlockLevel(loaded))
  }
  return undefined
}

/** Whether the character holds the rule's holder, and where it comes from. */
export function heldBy(sources: Sources, holder: Holder): Held | undefined {
  if ('feat' in holder) {
    const key = holder.feat.toLowerCase()
    const held = sources.feats.find((f) => f.feat.key === key)
    return held && { source: held.source }
  }
  if ('race' in holder) {
    const want = holder.race
    // The loaded race knows its base race's book even where an older save does not.
    if (holdsRace(sources.race ?? sources.character.race, want)) {
      const name = want.subraceName ?? want.baseName
      return { source: { kind: 'race', tag: 'race', label: name } }
    }
    return undefined
  }
  if ('option' in holder) {
    return sources.options.has(holder.option)
      ? {
          source: {
            kind: 'option',
            tag: `option:${holder.option}`,
            label: holder.option.split('|')[0],
          },
        }
      : undefined
  }
  if ('reward' in holder) {
    const held = sources.rewards.find((r) => r.reward.key === holder.reward)
    return held && { source: held.source }
  }
  if ('item' in holder) {
    const held = sources.items.find((i) => i.item.key === holder.item)
    return held && { source: held.source, active: held.active }
  }
  if ('variant' in holder) {
    const held = sources.items.find(
      (i) => i.stack.variantOf?.split('|')[0] === holder.variant,
    )
    return held && { source: held.source, active: held.active }
  }
  // A feature of a list to choose from (Protector or Thaumaturge), or an optional class
  // feature (Favored Foe) and the one it replaces, is held once taken.
  if (featureWithheld(sources.featureChoices, holderId(holder))) return undefined
  const className =
    'classFeature' in holder
      ? holder.classFeature.className
      : holder.subclassFeature.className
  for (const c of sources.classes) {
    if (c.row.name !== className || !c.loaded) continue
    const level = featureLevel(c.loaded, holder, c.row)
    if (level === undefined || c.level < level) continue
    const label =
      'subclassFeature' in holder && c.row.subclass
        ? `${c.row.name}, ${c.row.subclass.name}`
        : c.row.name
    return {
      classLevel: c.level,
      source: {
        kind: 'subclassFeature' in holder ? 'subclass' : 'class',
        tag: `class:${c.row.name}|${c.row.source}`,
        label,
      },
    }
  }
  return undefined
}
