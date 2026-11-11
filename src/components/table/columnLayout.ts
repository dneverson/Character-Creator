// Column layout for the shared DataTable: which columns are
// visible, in what order, and how wide. Kept pure and JSON-serializable so it can
// be persisted as a device setting and unit-tested without React. Nothing here is
// dataset-specific - it works purely in terms of column keys.

import { deviceSettings } from '../../storage/deviceSettings'

/** A table's per-column layout: display order, hidden keys, and pixel widths. */
export interface ColumnLayout {
  /** Column keys in display order, left to right. */
  order: string[]
  /** Keys the user has hidden (still in `order`, just not rendered). */
  hidden: string[]
  /** Per-column pixel widths set by dragging; an absent key is auto-sized. */
  widths: Record<string, number>
}

/**
 * The default layout for a set of columns: declared order, and nothing hidden
 * but the columns that start hidden.
 */
export function defaultLayout(keys: string[], hidden: string[] = []): ColumnLayout {
  return { order: [...keys], hidden: [...hidden], widths: {} }
}

/**
 * Merge a saved layout with the current column set so a stored layout survives
 * column-config changes across app versions: keep the saved order for keys that
 * still exist, append any new keys at the end, and drop anything that no longer
 * exists (from `order`, `hidden`, and `widths` alike).
 */
export function reconcileLayout(saved: ColumnLayout, keys: string[]): ColumnLayout {
  const known = new Set(keys)
  const savedOrder = saved.order.filter((k) => known.has(k))
  const appended = keys.filter((k) => !saved.order.includes(k))
  const order = [...savedOrder, ...appended]
  const hidden = saved.hidden.filter((k) => known.has(k))
  const widths: Record<string, number> = {}
  for (const k of keys) {
    const w = saved.widths[k]
    if (typeof w === 'number') widths[k] = w
  }
  return { order, hidden, widths }
}

/**
 * Move `moved` so it sits immediately before `before` in the order, or to the
 * end when `before` is null. Preserves every other key's relative position
 * (including hidden ones), so a header drag never loses columns. Returns
 * the original array unchanged when the move is a no-op or the target is unknown.
 */
export function reorderKey(
  order: string[],
  moved: string,
  before: string | null,
): string[] {
  if (moved === before) return order
  const without = order.filter((k) => k !== moved)
  if (without.length === order.length) return order // `moved` not present
  if (before === null) return [...without, moved]
  const idx = without.indexOf(before)
  if (idx < 0) return order
  return [...without.slice(0, idx), moved, ...without.slice(idx)]
}

/** The keys to render, in order - those present in `order` and not hidden. */
export function visibleKeys(layout: ColumnLayout): string[] {
  const hidden = new Set(layout.hidden)
  return layout.order.filter((k) => !hidden.has(k))
}

const STORAGE_PREFIX = 'charcreator.table:'

/**
 * Storage schema version for persisted layouts. Bump this whenever a table's
 * default columns change in a way existing users must pick up (order, default
 * visibility): a stored layout tagged with an older version is treated as absent
 * on load, so the table re-seeds to the new `defaultLayout` once. The version is
 * a storage-only concern and never appears in the in-memory `ColumnLayout`.
 *
 * v2: the DataTable's default column order changed (the class reference table's
 * "Build" action column moved ahead of the reference columns).
 */
export const LAYOUT_VERSION = 2

/** The on-disk shape: a layout plus the schema version it was written under. */
interface StoredLayout extends ColumnLayout {
  version: number
}

/**
 * Load a saved layout for `tableId`, or `null` when there is none, storage is
 * unreadable (private mode, cleared data), or the stored schema version is not
 * the current one (a pre-version or outdated entry, which re-seeds to default).
 * Malformed data is treated as absent rather than thrown, so a bad entry never
 * breaks the table.
 */
export function loadLayout(tableId: string): ColumnLayout | null {
  try {
    const raw = deviceSettings.getItem(STORAGE_PREFIX + tableId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredLayout>
    if (parsed.version !== LAYOUT_VERSION) return null
    if (!Array.isArray(parsed.order)) return null
    const strings = (xs: unknown): string[] =>
      Array.isArray(xs) ? xs.filter((x): x is string => typeof x === 'string') : []
    const widths: Record<string, number> = {}
    if (parsed.widths && typeof parsed.widths === 'object') {
      for (const [k, v] of Object.entries(parsed.widths)) {
        if (typeof v === 'number') widths[k] = v
      }
    }
    return { order: strings(parsed.order), hidden: strings(parsed.hidden), widths }
  } catch {
    return null
  }
}

/**
 * Persist a layout for `tableId`. When the browser refuses storage the layout
 * stays in memory for the session, which is a graceful degradation, not an error.
 */
export function saveLayout(tableId: string, layout: ColumnLayout): void {
  const stored: StoredLayout = { ...layout, version: LAYOUT_VERSION }
  deviceSettings.setItem(STORAGE_PREFIX + tableId, JSON.stringify(stored))
}
