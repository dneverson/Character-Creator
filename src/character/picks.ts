// What the player chose from the things a source lets them choose (a language, a tool,
// a skill, an expertise): each pick is stored as kind -> value -> the tag of the source
// that granted it, the way skills always were. One shape for every kind of pick, so one
// card, one budget rule and one migration serve them all.

import type { Entry } from '../text/Entries'

/** What a pick can be of. */
export type PickKind =
  | 'skill'
  | 'tool'
  | 'language'
  | 'armor'
  | 'weapon'
  | 'save'
  | 'expertise'
  | 'resist'
  | 'condition'
  /** A class option (a fighting style): stored in `classOptions`, not in the picks. */
  | 'option'

/** The values of one kind the player chose, each with the source tag that pays for it. */
export type PickMap = Record<string, string>

/** Every pick of the character: kind -> value (the data's own key) -> source tag. */
export type GrantPicks = Partial<Record<PickKind, PickMap>>

/** The tag of a pick outside every source's list: allowed, but for the DM to approve. */
export const MANUAL_TAG = 'manual'

/** The picks of one kind. */
export const picksOf = (picks: GrantPicks | undefined, kind: PickKind): PickMap =>
  picks?.[kind] ?? {}

/** How many picks of these kinds a source has been charged with. */
export function picksCharged(
  picks: GrantPicks | undefined,
  tag: string,
  kinds: readonly string[],
): number {
  return kinds.reduce(
    (n, kind) =>
      n + Object.values(picksOf(picks, kind as PickKind)).filter((t) => t === tag).length,
    0,
  )
}

/** The picks with this value of this kind placed, or taken back when already placed. */
export function togglePick(
  picks: GrantPicks | undefined,
  kind: PickKind,
  value: string,
  tag: string,
): GrantPicks {
  const map = { ...picksOf(picks, kind) }
  if (value in map) delete map[value]
  else map[value] = tag
  return { ...picks, [kind]: map }
}

/** The class options with this one placed, or taken back when already placed. */
export function toggleClassOption(
  options: Record<string, string[]>,
  tag: string,
  value: string,
): Record<string, string[]> {
  const held = options[tag] ?? []
  return {
    ...options,
    [tag]: held.includes(value) ? held.filter((v) => v !== value) : [...held, value],
  }
}

/** The skill picks of a character. */
export const skillPicks = (character: { grantPicks: GrantPicks }): PickMap =>
  picksOf(character.grantPicks, 'skill')

/** What kind of source a card is for. */
export type SkillSourceKind = 'class' | 'multiclass' | 'background' | 'race' | 'feat'

export type ChipState = 'available' | 'picked' | 'taken' | 'full'

/** One thing a source lets the player choose, and where it stands. */
export interface PickChip {
  kind: PickKind
  /** The data's own key: "elvish", "smith's tools", "acrobatics". */
  value: string
  label: string
  state: ChipState
  /** Who already covers the value, when `taken`. */
  takenBy?: string
  /** What goes beside the label: a skill's modifier with proficiency. */
  hint?: string
  /** What the option is and does, from the data, so it can be read before it is picked. */
  detail?: PickChipDetail
}

/** What a pick is, in the data's own words: labelled facts, then its rules text. */
export interface PickChipDetail {
  facts: { label: string; value: string }[]
  entries: Entry[]
}

/** A source of picks as a card: its whole list, the picks it allows and the ones made. */
export interface PickCard {
  tag: string
  /** "Background · Acolyte": the card's heading. */
  label: string
  /** Short name: "Background", "Race", or the class or feat. */
  name: string
  kind: SkillSourceKind
  /** What is picked, plural: "skills", "languages". */
  noun: string
  /** Every kind of pick the card's budget pays for (a Skilled pick is a skill or a tool). */
  kinds: PickKind[]
  count: number
  used: number
  left: number
  over: boolean
  /** The values chosen, as the stored keys. */
  picks: string[]
  chips: PickChip[]
  /** A line under the heading: where the rest of a shared budget is spent. */
  note?: string
}

/** The picks without those a source paid for, of these kinds. */
export function clearPicks(
  picks: GrantPicks | undefined,
  tag: string,
  kinds: readonly string[],
): GrantPicks {
  const next: GrantPicks = { ...picks }
  for (const kind of kinds as PickKind[]) {
    if (next[kind] === undefined) continue
    next[kind] = Object.fromEntries(
      Object.entries(next[kind]).filter(([, t]) => t !== tag),
    )
  }
  return next
}
