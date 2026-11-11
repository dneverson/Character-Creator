// The options a class lets the player choose (2014): the fighting style of a Fighter,
// Paladin, Ranger or College of Swords Bard, as a card of the same kind as the others.
// How many a class gives comes from the data (`optionalfeatureProgression` of the class
// and of its subclass); the pick is stored in `classOptions` under the class's tag and
// the feature type, and the rules of a style read it through `Sources.options`.

import type { PickCard, PickChip } from '../character/picks'
import { subclassesFor } from '../data/class'
import { FIGHTING_STYLE_TYPE, type ClassOption } from '../data/classOptions'
import type { Sources } from './sources'

/** One feature type of one class: "class:Fighter|PHB|FS:F" and how many it gives. */
interface Slot {
  tag: string
  type: string
  className: string
  index: number
  count: number
}

function slotsOf(sources: Sources): Slot[] {
  const slots = new Map<string, Slot>()
  sources.classes.forEach(({ row, loaded, level }, index) => {
    if (!loaded) return
    const subclass = row.subclass
      ? subclassesFor(loaded).find(
          (s) =>
            s.shortName === row.subclass?.shortName && s.source === row.subclass?.source,
        )
      : undefined
    const progressions = [
      ...(loaded.entry.optionalfeatureProgression ?? []),
      ...(subclass?.optionalfeatureProgression ?? []),
    ]
    for (const progression of progressions) {
      const type = progression.featureType.find((t) => t.startsWith(FIGHTING_STYLE_TYPE))
      if (!type) continue
      const count = Object.entries(progression.progression)
        .filter(([at]) => Number(at) <= level)
        .reduce((n, [, amount]) => n + amount, 0)
      if (count === 0) continue
      const tag = `class:${row.name}|${row.source}|${type}`
      const found = slots.get(tag)
      if (found) found.count += count
      else slots.set(tag, { tag, type, className: row.name, index, count })
    }
  })
  return [...slots.values()]
}

/** A card for each fighting style a class gives, with the styles it can choose from. */
export function classOptionCards(
  sources: Sources,
  catalog: readonly ClassOption[],
): PickCard[] {
  const slots = slotsOf(sources)
  const held = sources.character.classOptions
  const takenBy = new Map<string, string>()
  for (const slot of slots) {
    for (const key of held[slot.tag] ?? []) takenBy.set(key, slot.className)
  }
  return slots.map((slot): PickCard => {
    const picks = held[slot.tag] ?? []
    const full = picks.length >= slot.count
    const chips = catalog
      .filter((o) => o.types.includes(slot.type) || picks.includes(o.key))
      .map((o): PickChip => {
        const base = { kind: 'option' as const, value: o.key, label: o.name }
        if (picks.includes(o.key)) return { ...base, state: 'picked' }
        const by = takenBy.get(o.key)
        if (by) return { ...base, state: 'taken', takenBy: by }
        return { ...base, state: full ? 'full' : 'available' }
      })
    return {
      tag: slot.tag,
      label: `${slot.index > 0 ? 'Multiclass' : 'Class'} · ${slot.className} fighting style`,
      name: slot.className,
      kind: slot.index > 0 ? 'multiclass' : 'class',
      noun: 'fighting styles',
      kinds: ['option'],
      count: slot.count,
      used: picks.length,
      left: Math.max(0, slot.count - picks.length),
      over: picks.length > slot.count,
      picks,
      chips,
      note: 'Each style can be taken once. Its rule is applied to your attacks and armor class.',
    }
  })
}
