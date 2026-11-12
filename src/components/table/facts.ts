// Describing an entry as labelled facts.
//
// A fact is one thing worth knowing about an entry (a race's speed, a spell's
// range, the feature a class gains at level 5). A dataset describes its entries
// once, as groups of facts, and that one description is what the detail pane
// shows for a single entry, what the compare window lays side by side for
// several, and where table columns come from. Like the rest of this folder, it
// knows nothing about what the entries are.

import type { ReactNode } from 'react'
import type { Column } from './types'

export interface Fact<T> {
  /** Stable identifier, unique within its group. */
  key: string
  label: ReactNode
  /**
   * The value as plain text: what is compared between entries, and what is shown
   * unless `render` draws it. Empty text means the entry has nothing here.
   */
  text: (entry: T) => string
  /** Draws the value where plain text will not do. Not called for an empty value. */
  render?: (entry: T) => ReactNode
  /**
   * What the fact is, for a layout that gives these a place of their own (the book
   * style of the detail pane). `summary` facts read as one italic line under the name,
   * `body` is the entry's running text, `source`, `page`, `free` (in the free rules)
   * and `edition` are where the entry is printed. Left out, a fact is a plain
   * label and value.
   */
  role?: 'summary' | 'body' | 'source' | 'page' | 'free' | 'edition'
}

export interface FactGroup<T> {
  key: string
  /** The group's heading. */
  title?: string
  /**
   * A heading that differs per entry (a subclass's features are headed by that
   * subclass's name). Used in place of `title`.
   */
  entryTitle?: (entry: T) => string
  facts: Fact<T>[]
  /** Shown in the detail pane when the entry has nothing in this group. */
  empty?: string
}

/**
 * The description of some entries. It is given all the entries shown together,
 * so a group can line up what they each have (one row per trait any of them has).
 */
export type Describe<T> = (entries: T[]) => FactGroup<T>[]

/** A fact's value for an entry, or `null` when the entry has nothing there. */
export function factValue<T>(fact: Fact<T>, entry: T): ReactNode {
  const text = fact.text(entry)
  if (!text) return null
  return fact.render ? fact.render(entry) : text
}

/** The heading of a group for one entry. */
export function groupTitle<T>(group: FactGroup<T>, entry: T): string {
  return group.entryTitle ? group.entryTitle(entry) : (group.title ?? '')
}

/** Shown in a table cell for an entry that has nothing there. */
export const NO_VALUE = '-'

/**
 * A table column showing a fact. It sorts and filters by the fact's text unless
 * `extra` says otherwise (a number that must sort as a number, for one).
 */
export function factColumn<T>(fact: Fact<T>, extra: Partial<Column<T>> = {}): Column<T> {
  return {
    key: fact.key,
    header: fact.label,
    render: (row) => factValue(fact, row) ?? NO_VALUE,
    sortValue: fact.text,
    filterValue: (row) => fact.text(row) || NO_VALUE,
    ...extra,
  }
}

/**
 * Works a value out once per entry and remembers it. A table asks for a fact's
 * text again on every sort, filter and redraw; this keeps a fact that takes some
 * working out (reading a list of grants into words) from being worked out each time.
 */
export function perEntry<T extends object, V>(compute: (entry: T) => V): (entry: T) => V {
  const known = new WeakMap<T, { value: V }>()
  return (entry) => {
    let hit = known.get(entry)
    if (!hit) {
      hit = { value: compute(entry) }
      known.set(entry, hit)
    }
    return hit.value
  }
}

/** Whether every entry has the same value (only meaningful for two or more). */
export const allSame = (values: string[]) =>
  values.length > 1 && values.every((value) => value === values[0])
