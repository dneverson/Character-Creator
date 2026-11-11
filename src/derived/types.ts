// The shared vocabulary of every derived number: a Quantity is a value together
// with the lines that add up to it, each line naming where it comes from. The value
// is always computed from the lines (`quantity`), so the table a player reads is the
// calculation itself and cannot drift from the number.

/** What kind of thing a line comes from. */
export type SourceKind =
  | 'base'
  | 'class'
  | 'subclass'
  | 'race'
  | 'background'
  | 'feat'
  | 'item'
  | 'option'
  | 'manual'

/** Where a line comes from; `tag` is the form the skill sources already use. */
export interface SourceRef {
  kind: SourceKind
  /** "class:Rogue|PHB", "feat:asi-4", "item:Chain Mail|PHB". */
  tag: string
  /** What the player reads: "Chain Mail", "Sorcerer, Draconic Bloodline". */
  label: string
}

/**
 * How a line takes part: `base` and `add` are summed when applied; `note` carries a
 * rule or a consequence and `alt` an alternative that is not used (both show, neither
 * is summed).
 */
export type LineOp = 'base' | 'add' | 'note' | 'alt'

/**
 * `applied` is summed. `conditional` is a bonus that holds only under a condition
 * (`when`) and is shown, not summed. `inactive` is not in force (`why` says why).
 * `flag` is a deviation from the rules with its consequence in `why`; it is never
 * summed and never blocks anything.
 */
export type LineStatus = 'applied' | 'conditional' | 'inactive' | 'flag'

export interface Line {
  /** Stable identity, e.g. "ac|armor|Chain Mail|PHB" (the data identity of its rule). */
  id: string
  /** What the line is: "Armor", "Shield", "Dexterity". */
  label: string
  source: SourceRef
  /** The signed amount; absent for a note. */
  amount?: number
  op: LineOp
  /** How the amount comes about, in plain words: "Base 16, no Dexterity". */
  how?: string
  /** The rule in plain words, as the line's tooltip. */
  text?: string
  /** The condition a conditional line holds under: "while wielding one weapon". */
  when?: string
  status: LineStatus
  /** For an inactive or flagged line: the reason, or the consequence. */
  why?: string
  /** A small tag beside the label: "Automatic", "Manual". */
  badge?: string
}

export interface Quantity {
  value: number
  lines: Line[]
}

/** A set member merged from several sources (a language, a tool): used from step 4 on. */
export interface Listing {
  value: string
  sources: SourceRef[]
  note?: string
  choicePending?: boolean
}

/** One value granted by one source, before values are merged. */
export interface ListingEntry {
  value: string
  source: SourceRef
  note?: string
}

/** Entries merged by value (not case sensitive), each keeping every source that gives it. */
export function mergeListings(entries: readonly ListingEntry[]): Listing[] {
  const merged = new Map<string, Listing>()
  for (const { value, source, note } of entries) {
    const key = value.toLowerCase()
    const found = merged.get(key)
    if (!found) merged.set(key, { value, sources: [source], ...(note ? { note } : {}) })
    else if (!found.sources.some((s) => s.tag === source.tag && s.label === source.label))
      found.sources.push(source)
  }
  return [...merged.values()]
}

/** The sum of what counts: the amounts of the applied base and add lines. */
export function sumLines(lines: readonly Line[]): number {
  return lines.reduce(
    (sum, l) =>
      l.status === 'applied' && (l.op === 'base' || l.op === 'add')
        ? sum + (l.amount ?? 0)
        : sum,
    0,
  )
}

/** The Quantity of some lines: its value is their sum, by construction. */
export function quantity(lines: Line[]): Quantity {
  return { value: sumLines(lines), lines }
}

export const BASE_SOURCE: SourceRef = { kind: 'base', tag: 'base', label: '' }
