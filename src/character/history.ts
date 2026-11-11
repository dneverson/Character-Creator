// Writing a character's history.
//
// Every edit goes through `edited`, which works out what the edit changed and
// adds it to the character's history. Nothing has to be reported by the code
// that makes the edit: the changes are found by comparing the character before
// and after, so a part of the model added later is recorded without anything
// being written for it here. What an edit was, when it was more than an edit (a
// roll, for one), is passed along as its action.
//
// No screen of the player's shows the history or says that it is kept. It is
// read in the DM's view, and it is in the export file with the rest.

import { appConfig } from '../config/app'
import {
  historyEntry,
  type Change,
  type Character,
  type HistoryAction,
  type HistoryEntry,
} from './model'

/** The parts of an edit a player may make: everything but what the app itself keeps. */
export type CharacterPatch = Partial<
  Omit<Character, 'id' | 'schemaVersion' | 'createdAt' | 'history'>
>

/**
 * Parts of the character that are not recorded: its identity and bookkeeping,
 * the history itself, and which roll the player is looking at.
 */
const UNTRACKED: ReadonlySet<string> = new Set<keyof Character>([
  'id',
  'schemaVersion',
  'history',
  'rollCursors',
  'createdAt',
  'updatedAt',
])

type Fields = Record<string, unknown>

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether two values hold the same data. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, at) => same(item, b[at]))
  }
  if (isFields(a) && isFields(b)) {
    const keys = Object.keys(a)
    return (
      keys.length === Object.keys(b).length && keys.every((key) => same(a[key], b[key]))
    )
  }
  return false
}

/**
 * The entries of a list of named things (items, spells, classes, beasts) by name
 * and source, or `null` when the list is not one: its entries are compared by
 * who they are, not by where in the list they stand.
 */
function byName(list: unknown[]): Map<string, Fields> | null {
  const named = new Map<string, Fields>()
  for (const entry of list) {
    if (!isFields(entry) || typeof entry.name !== 'string') return null
    const key =
      typeof entry.source === 'string' ? `${entry.name}|${entry.source}` : entry.name
    if (named.has(key)) return null
    named.set(key, entry)
  }
  return named
}

function collect(before: unknown, after: unknown, path: string[], out: Change[]): void {
  if (before === after) return
  if (isFields(before) && isFields(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      collect(before[key], after[key], [...path, key], out)
    }
    return
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const was = byName(before)
    const is = byName(after)
    if (was && is) {
      for (const [key, entry] of was) collect(entry, is.get(key), [...path, key], out)
      for (const [key, entry] of is) {
        if (!was.has(key)) out.push({ path: [...path, key], after: entry })
      }
      // The same entries in another order (the first class is the starting class).
      const order = { before: [...was.keys()], after: [...is.keys()] }
      const sameEntries = was.size === is.size && order.before.every((key) => is.has(key))
      if (sameEntries && !same(order.before, order.after)) out.push({ path, ...order })
      return
    }
  }
  if (same(before, after)) return
  out.push({
    path,
    ...(before !== undefined && { before }),
    ...(after !== undefined && { after }),
  })
}

/** What differs between two values, as changes under `path`. */
export function changesBetween(
  before: unknown,
  after: unknown,
  path: string[] = [],
): Change[] {
  const out: Change[] = []
  collect(before, after, path, out)
  return out
}

/** What an edit changed in a character, leaving out what is not recorded. */
export function characterChanges(before: Character, after: Character): Change[] {
  const tracked = (character: Character) =>
    Object.fromEntries(Object.entries(character).filter(([key]) => !UNTRACKED.has(key)))
  return changesBetween(tracked(before), tracked(after))
}

const pathKey = (change: Change) => JSON.stringify(change.path)

/**
 * Whether new changes continue the last entry: a plain edit of the very same
 * values, made on this device a moment ago.
 */
function continues(last: HistoryEntry, changes: Change[], at: number): boolean {
  if (last.action || last.by !== 'device') return false
  if (at - last.at > appConfig.history.mergeWindowMs) return false
  if (last.changes.length !== changes.length) return false
  const paths = new Set(last.changes.map(pathKey))
  return changes.every((change) => paths.has(pathKey(change)))
}

/** The last entry and the new changes as one: from the first value to the latest. */
function merged(last: HistoryEntry, changes: Change[], at: number): HistoryEntry[] {
  const first = new Map(last.changes.map((change) => [pathKey(change), change]))
  const whole = changes.flatMap((change): Change[] => {
    const before = first.get(pathKey(change))?.before
    // Back where it started: nothing changed after all.
    if (same(before, change.after)) return []
    return [
      {
        path: change.path,
        ...(before !== undefined && { before }),
        ...(change.after !== undefined && { after: change.after }),
      },
    ]
  })
  return whole.length ? [{ ...last, at, changes: whole }] : []
}

/**
 * The history with what happened between `before` and `after` added to it.
 * The same history when nothing recorded changed and there is no action.
 */
export function recorded(
  before: Character,
  after: Character,
  action: HistoryAction | undefined,
  at: number,
): HistoryEntry[] {
  const history = before.history
  const changes = characterChanges(before, after)
  if (action) return [...history, historyEntry(at, action, changes)]
  if (!changes.length) return history
  const last = history.at(-1)
  if (last && continues(last, changes, at)) {
    return [...history.slice(0, -1), ...merged(last, changes, at)]
  }
  return [...history, historyEntry(at, undefined, changes)]
}

/**
 * A character after an edit: the patch applied, the edit recorded in its
 * history, and `updatedAt` moved on. A roll that is recorded becomes the roll in
 * use in its stream.
 */
export function edited(
  character: Character,
  patch: CharacterPatch,
  action?: HistoryAction,
  at: number = Date.now(),
): Character {
  const after: Character = { ...character, ...patch, updatedAt: at }
  if (action?.type === 'roll') {
    after.rollCursors = { ...after.rollCursors, [action.roll.stream]: action.roll.id }
  }
  after.history = recorded(character, after, action, at)
  return after
}
