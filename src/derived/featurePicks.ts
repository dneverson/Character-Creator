// The picks of the feature picks table (rules/featurePicks.ts) as pick cards of the class
// options kind: stored in `classOptions` under `<holder tag>|pick:<title>`, and an
// option's own choice under that tag and the option's key. How many picks a card allows
// is how many of the row's features the character has, the row's count at the class
// level, or how many times the option holding it is taken; none once the first holder is
// not had (Favored Enemy given up for Favored Foe). The list of a row that points at the
// character or the data (`from`) is read here: the Warlock cantrips the character knows,
// the weapons of the catalog, the tables of the option's text.

import type { PickCard, PickChip } from '../character/picks'
import type { ClassOption } from '../data/classOptions'
import type { Item } from '../data/itemTypes'
import {
  FEATURE_PICKS,
  type FeaturePick,
  type FeaturePickFrom,
  type FeaturePickOption,
} from '../rules/featurePicks'
import type { Entry } from '../text/Entries'
import { stripTags } from '../text/tags'
import { REPEAT_MARK, type OptionOwner } from './classOptions'
import { heldBy, type Sources } from './sources'
import type { SourceRef } from './types'

export const PICK_MARK = '|pick:'

/** A row of the table the character has. */
export interface HeldFeaturePick {
  pick: FeaturePick
  source: SourceRef
  /** `<holder tag>|pick:<title>`. */
  tag: string
  /** "Class", "Multiclass" or "Feat". */
  prefix: string
  count: number
  /** The level of the class the holder belongs to. */
  classLevel: number
  /** For an option holder: the class or feat that took the option, whose card it joins. */
  owner?: OptionOwner
}

/** What the lists that point at the data are read from. */
export interface PickData {
  items?: readonly Item[]
  catalog?: readonly ClassOption[]
}

/** The class or feat that took an option, by the option slot it is picked or known in. */
function optionOwner(sources: Sources, key: string): OptionOwner | undefined {
  return sources.optionSlots.find(
    (s) =>
      s.required.includes(key) ||
      (sources.character.classOptions[s.tag] ?? []).includes(key),
  )?.owner
}

/** The class whose option pick holds an option, by the tag the pick is stored under. */
function optionClass(sources: Sources, key: string) {
  const tag = Object.entries(sources.character.classOptions).find(
    ([t, values]) => t.startsWith('class:') && values.includes(key),
  )?.[0]
  return sources.classes.findIndex((c) =>
    tag?.startsWith(`class:${c.row.name}|${c.row.source}|`),
  )
}

const PREFIX: Record<string, string> = { multiclass: 'Multiclass', feat: 'Feat' }

/** How many picks the byLevel row gives at a class level: its count from the highest level reached. */
const atLevel = (byLevel: Record<number, number>, level: number) =>
  Object.entries(byLevel).reduce((n, [at, count]) => (level >= Number(at) ? count : n), 0)

export function heldFeaturePicks(sources: Sources): HeldFeaturePick[] {
  return FEATURE_PICKS.flatMap((pick): HeldFeaturePick[] => {
    const [first, ...more] = pick.holders.map((h) => heldBy(sources, h))
    if (!first) return []
    const holder = pick.holders[0]
    const option = 'option' in holder ? holder.option : undefined
    const owner = option ? optionOwner(sources, option) : undefined
    const index = option
      ? optionClass(sources, option)
      : sources.classes.findIndex(
          (c) => `class:${c.row.name}|${c.row.source}` === first.source.tag,
        )
    const classLevel =
      first.classLevel ?? owner?.level ?? sources.classes[index]?.level ?? 0
    const prefix = owner
      ? (PREFIX[owner.kind] ?? 'Class')
      : index > 0
        ? 'Multiclass'
        : 'Class'
    // An option taken more than once gives one pick each time.
    const times = option
      ? Object.values(sources.character.classOptions)
          .flat()
          .filter((k) => k === option).length
      : 0
    const count = pick.byLevel
      ? atLevel(pick.byLevel, classLevel)
      : option
        ? Math.max(1, times)
        : 1 + more.filter(Boolean).length
    return [
      {
        pick,
        source: first.source,
        tag: `${first.source.tag}${PICK_MARK}${pick.title}`,
        prefix,
        count,
        classLevel,
        ...(owner ? { owner } : {}),
      },
    ]
  })
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

/** The cantrips of the character's Warlock classes, by the spell's "name|source". */
function warlockCantrips(sources: Sources, pick: FeaturePick): FeaturePickOption[] {
  return Object.entries(sources.character.spells)
    .filter(([classKey]) => classKey.startsWith('Warlock|'))
    .flatMap(([, selection]) => selection.cantrips)
    .map((spell) => ({
      key: `${spell.name}|${spell.source}`.toLowerCase(),
      name: titleCase(spell.name),
      text: pick.note,
    }))
}

/** The kinds of weapons without some properties, and those named, by name in lower case. */
function weaponOptions(
  from: Extract<FeaturePickFrom, { kind: 'weapons' }>,
  items: readonly Item[],
): FeaturePickOption[] {
  const byName = new Map<string, FeaturePickOption>()
  for (const item of items) {
    const w = item.weapon
    if (item.kind !== 'weapon' || item.magic || !w?.category) continue
    const key = item.name.toLowerCase()
    const codes = w.properties.map((p) => p.code)
    if (!from.also.includes(key) && from.without.some((c) => codes.includes(c))) continue
    if (byName.has(key)) continue
    const category = w.category === 'martial' ? 'Martial' : 'Simple'
    byName.set(key, {
      key,
      name: item.name,
      text: `${category} ${w.melee ? 'melee' : 'ranged'} weapon.`,
      facts: [
        { label: 'Weapon', value: `${category} ${w.melee ? 'Melee' : 'Ranged'}` },
        {
          label: 'Damage',
          value: `${w.damage?.text ?? '-'} ${w.damageTypes.join(', ')}`,
        },
      ],
    })
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** The rows of the option's own tables whose caption matches, with the level the caption names. */
function tableOptions(
  from: Extract<FeaturePickFrom, { kind: 'textTables' }>,
  option: ClassOption | undefined,
): FeaturePickOption[] {
  const out: FeaturePickOption[] = []
  const walk = (entries: readonly Entry[]) => {
    for (const e of entries) {
      if (typeof e !== 'object' || e === null) continue
      if ('entries' in e && Array.isArray(e.entries)) walk(e.entries)
      if (!('type' in e) || e.type !== 'table' || !('caption' in e)) continue
      const level = from.caption.exec(String(e.caption))?.[1]
      if (!level || !('rows' in e) || !Array.isArray(e.rows)) continue
      for (const row of e.rows as unknown[][]) {
        const [cell, attunement] = row.map((c) => (typeof c === 'string' ? c : ''))
        const name = /\{@item ([^|}]+)/.exec(cell)?.[1]
        if (!name) continue
        out.push({
          key: name.toLowerCase(),
          name: name.charAt(0).toUpperCase() + name.slice(1),
          text: stripTags(cell),
          minLevel: Number(level),
          facts: [
            { label: 'Level', value: level },
            { label: 'Attunement', value: attunement },
          ],
        })
      }
    }
  }
  walk(option?.entries ?? [])
  return out
}

/** The options of a row the character has: written out, or read from where `from` points. */
export function pickOptions(
  held: HeldFeaturePick,
  sources: Sources,
  data: PickData,
): readonly FeaturePickOption[] {
  const { pick } = held
  const from = pick.from
  if (!from) return pick.options
  if (from.kind === 'warlockCantrips') return warlockCantrips(sources, pick)
  if (from.kind === 'weapons') return weaponOptions(from, data.items ?? [])
  const holder = pick.holders[0]
  const key = 'option' in holder ? holder.option : ''
  return tableOptions(
    from,
    data.catalog?.find((o) => o.key === key),
  )
}

/** The options, and any pick no longer among them (a cantrip since swapped), to be seen and taken back. */
function withGone(options: readonly FeaturePickOption[], picks: readonly string[]) {
  const known = new Set(options.map((o) => o.key))
  const gone = [...new Set(picks.filter((p) => !known.has(p)))].map(
    (key): FeaturePickOption => ({
      key,
      name: titleCase(key.split('|')[0]),
      text: 'Not in the list it is picked from now.',
    }),
  )
  return [...options, ...gone]
}

const chipOf = (
  option: FeaturePickOption,
  value: string,
  label: string,
  state: PickChip['state'],
  classLevel: number,
): PickChip => ({
  kind: 'option',
  value,
  label,
  state,
  ...(option.minLevel && classLevel < option.minLevel
    ? { unmet: `Needs class level ${option.minLevel} - allowed with DM approval` }
    : {}),
  detail: { facts: option.facts ?? [], entries: [option.text] },
})

/** The chips of a list: each option once, a repeatable one again after each time taken. */
function chipsOf(
  options: readonly FeaturePickOption[],
  picks: string[],
  full: boolean,
  classLevel: number,
) {
  return withGone(options, picks).flatMap((o): PickChip[] => {
    const times = picks.filter((p) => p === o.key).length
    if (!o.repeatable) {
      return [
        chipOf(
          o,
          o.key,
          o.name,
          times > 0 ? 'picked' : full ? 'full' : 'available',
          classLevel,
        ),
      ]
    }
    const label = (i: number) => (i === 0 ? o.name : `${o.name} (again)`)
    const value = (i: number) => (i === 0 ? o.key : `${o.key}${REPEAT_MARK}${i + 1}`)
    return [
      ...Array.from({ length: times }, (_, i) =>
        chipOf(o, value(i), label(i), 'picked', classLevel),
      ),
      chipOf(o, value(times), label(times), full ? 'full' : 'available', classLevel),
    ]
  })
}

function card(
  held: HeldFeaturePick,
  sources: Sources,
  tag: string,
  words: { label: string; noun: string },
  count: number,
  options: readonly FeaturePickOption[],
  note: string,
): PickCard {
  const picks = sources.character.classOptions[tag] ?? []
  // "Agonizing Blast cantrip" names its option already; "Kensei Weapons" names the
  // subclass, so only the class goes before it ("Monk Kensei Weapons").
  const [first = ''] = words.label.split(' ')
  const [className, subclass] = held.source.label.split(',')
  const label = words.label.startsWith(held.source.label)
    ? words.label
    : subclass?.includes(first)
      ? `${className} ${words.label}`
      : `${held.source.label} ${words.label}`
  return {
    tag,
    label: `${held.prefix} · ${label}`,
    name: held.source.label,
    kind: held.owner?.kind ?? (held.prefix === 'Multiclass' ? 'multiclass' : 'class'),
    ...(held.owner ? { owner: held.owner.tag } : {}),
    noun: words.noun,
    kinds: ['option'],
    count,
    used: picks.length,
    left: Math.max(0, count - picks.length),
    over: picks.length > count,
    picks,
    chips: chipsOf(options, picks, picks.length >= count, held.classLevel),
    note,
  }
}

/** The card of every pick had, each followed by the cards of the options taken that ask for more. */
export function featurePickCards(sources: Sources, data: PickData = {}): PickCard[] {
  return heldFeaturePicks(sources).flatMap((held) => {
    const { pick } = held
    const picks = sources.character.classOptions[held.tag] ?? []
    const words = { label: pick.title, noun: pick.noun }
    const options = pickOptions(held, sources, data)
    const main = card(held, sources, held.tag, words, held.count, options, pick.note)
    const subs = options.flatMap((o): PickCard[] => {
      const times = picks.filter((p) => p === o.key).length
      if (!o.sub || times === 0) return []
      const count = o.sub.count * times
      return [
        card(
          held,
          sources,
          `${held.tag}|${o.key}`,
          { label: o.sub.noun, noun: o.sub.noun },
          count,
          o.sub.options,
          `${o.name}: choose ${count}, ${o.sub.count} for each time it is taken.`,
        ),
      ]
    })
    return [main, ...subs]
  })
}

/** The word a card's open picks are counted in, for the checklist: "favored enemy choice". */
export function featurePickWord(tag: string): string | undefined {
  const at = tag.indexOf(PICK_MARK)
  if (at < 0) return undefined
  const [title, optionKey] = tag.slice(at + PICK_MARK.length).split('|')
  const pick = FEATURE_PICKS.find((p) => p.title === title)
  const sub = pick?.options.find((o) => o.key === optionKey)?.sub
  return `${(sub?.title ?? title).toLowerCase()} choice`
}

/** What a character took of each pick it has, by name: "Undead", "Gnoll". */
export function takenFeaturePicks(sources: Sources, data: PickData = {}) {
  return heldFeaturePicks(sources).map((held) => {
    const picks = sources.character.classOptions[held.tag] ?? []
    const options = withGone(pickOptions(held, sources, data), picks)
    const taken = options.flatMap((o) => {
      const times = picks.filter((p) => p === o.key).length
      if (times === 0) return []
      if (!o.sub) return [o]
      const subPicks = sources.character.classOptions[`${held.tag}|${o.key}`] ?? []
      return o.sub.options.filter((s) => subPicks.includes(s.key))
    })
    return { held, taken }
  })
}
