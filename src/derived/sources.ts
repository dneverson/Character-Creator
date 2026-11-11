// What a character has to derive from: its classes with their subclass, race, taken
// feats and equipped items. This is the only place that knows how a character names
// its sources; every derived number asks here who holds a rule (`heldBy`) and what is
// worn or wielded, so no derivation reads the character's shape on its own.

import type { AbilityKey } from '../dice/dice'
import type { Character, ClassRef, InventoryItem } from '../character/model'
import { resolveFeats, type FeatSummary } from '../character/feats'
import { indexItems, resolveInventoryItem } from '../character/inventory'
import type { LoadedClass } from '../data/class'
import { subclassUnlockLevel } from '../data/class'
import type { PlayableBackground } from '../data/background'
import type { PlayableRace } from '../data/race'
import type { Feat } from '../data/feats'
import type { Item } from '../data/items'
import type { ClassOption } from '../data/classOptions'
import type { Language } from '../data/languages'
import type { Holder } from '../rules/holder'
import type { SourceRef } from './types'

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
  /** The fighting styles of the books, for the class option cards. */
  fightingStyles?: readonly ClassOption[]
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

/** An equipped item, and whether its effects are in force. */
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
  /** Every equipped item, in inventory order. */
  items: HeldItem[]
  /**
   * The 2014 optional features the player picked ("Defense|PHB"), from the class
   * options.
   */
  options: ReadonlySet<string>
}

export function collectSources(character: Character, deps: DeriveDeps): Sources {
  const summary = resolveFeats(character, {
    feats: deps.feats ?? [],
    classByKey: deps.classByKey,
    race: deps.race,
    background: deps.background,
  })
  const catalog = indexItems(deps.items ?? [])
  const items = character.equipment.items.flatMap((stack): HeldItem[] => {
    if (!stack.equipped) return []
    const item = resolveInventoryItem(stack, catalog)
    if (!item) return []
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
  return {
    character,
    summary,
    classes: character.classes.map((row) => ({
      row,
      loaded: deps.classByKey.get(`${row.name}|${row.source}`),
      level: Math.max(0, Math.floor(row.level || 0)),
    })),
    race: deps.race,
    background: deps.background,
    feats: summary.slots.flatMap((s) =>
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
    ),
    items,
    // An option of a class the character no longer has is not held.
    options: new Set(
      Object.entries(character.classOptions)
        .filter(([tag]) =>
          character.classes.some((c) => tag.startsWith(`class:${c.name}|${c.source}|`)),
        )
        .flatMap(([, values]) => values),
    ),
  }
}

/** A rule's holder as the character has it. */
export interface Held {
  source: SourceRef
  /** The class level the character is at in the holder's class, for a class feature. */
  classLevel?: number
}

/** The level a class or subclass feature arrives at, read from the data. */
function featureLevel(
  loaded: LoadedClass,
  holder: Holder,
  classSource: string,
): number | undefined {
  if ('classFeature' in holder) {
    const h = holder.classFeature
    return loaded.file.classFeature?.find(
      (f) => f.name === h.name && f.source === h.source && f.className === h.className,
    )?.level
  }
  if ('subclassFeature' in holder) {
    const h = holder.subclassFeature
    const level = loaded.file.subclassFeature?.find(
      (f) =>
        f.name === h.name &&
        f.source === h.source &&
        f.className === h.className &&
        f.subclassShortName === h.shortName,
    )?.level
    // A 2014 subclass on a 2024 class arrives when that class's subclass does.
    return level === undefined
      ? undefined
      : classSource === h.source
        ? level
        : Math.max(level, subclassUnlockLevel(loaded))
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
    const race = sources.character.race
    if (
      race?.baseName === want.baseName &&
      race.source === want.source &&
      (want.subraceName === undefined || race.subraceName === want.subraceName)
    ) {
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
  if ('item' in holder) {
    const held = sources.items.find((i) => i.item.key === holder.item)
    return held && { source: held.source }
  }
  const className =
    'classFeature' in holder
      ? holder.classFeature.className
      : holder.subclassFeature.className
  const source =
    'classFeature' in holder ? holder.classFeature.source : holder.subclassFeature.source
  for (const c of sources.classes) {
    if (c.row.name !== className || !c.loaded) continue
    if ('classFeature' in holder && c.row.source !== source) continue
    if ('subclassFeature' in holder) {
      const sub = c.row.subclass
      if (sub?.shortName !== holder.subclassFeature.shortName || sub.source !== source) {
        continue
      }
    }
    const level = featureLevel(c.loaded, holder, c.row.source)
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
