// Resolver for the 5etools `_copy` inheritance system used by races, subraces,
// backgrounds, etc. An entry with `_copy` inherits from a base entry, overlays
// its own properties, then applies `_mod` operations. This implements the common
// cases (array append/prepend/insert/replace/remove and scalar overrides) and
// degrades gracefully on anything it does not recognise.

export interface Copyable {
  name: string
  source: string
  _copy?: {
    name: string
    source: string
    _mod?: Record<string, ModOp | ModOp[]>
    _preserve?: Record<string, boolean>
    [k: string]: unknown
  }
  [k: string]: unknown
}

interface ModOp {
  mode?: string
  items?: unknown
  index?: number
  replace?: string | { index?: number }
  names?: string | string[]
  [k: string]: unknown
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

function itemName(item: unknown): string | undefined {
  return item && typeof item === 'object' ? (item as { name?: string }).name : undefined
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object'

const isSame = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function applyModOp(arr: unknown[], op: ModOp): unknown[] {
  const items = asArray(op.items)
  switch (op.mode) {
    case 'appendArr':
      return [...arr, ...items]
    case 'prependArr':
      return [...items, ...arr]
    case 'insertArr': {
      const i = typeof op.index === 'number' ? op.index : arr.length
      return [...arr.slice(0, i), ...items, ...arr.slice(i)]
    }
    case 'replaceArr': {
      // `replace` names the item to swap out, or gives its position as `{ index }`.
      const idx =
        typeof op.replace === 'string'
          ? arr.findIndex((el) => itemName(el) === op.replace)
          : typeof op.replace?.index === 'number' && op.replace.index < arr.length
            ? op.replace.index
            : -1
      if (idx === -1) return arr
      return [...arr.slice(0, idx), ...items, ...arr.slice(idx + 1)]
    }
    case 'appendIfNotExistsArr':
      return [...arr, ...items.filter((item) => !arr.some((el) => isSame(el, item)))]
    case 'removeArr': {
      const names = new Set(asArray(op.names))
      return arr.filter((el) => !names.has(itemName(el) ?? ''))
    }
    default:
      // Unknown mode (e.g. replaceTxt, calculateProp) - leave the array as-is.
      return arr
  }
}

function applyMods(
  target: Record<string, unknown>,
  mod: Record<string, ModOp | ModOp[]>,
): void {
  for (const [field, opOrOps] of Object.entries(mod)) {
    if (field === '*' || field === '_') continue // wildcard targets not supported
    // A dotted field reaches into a nested object ("inherits.entries" on a variant).
    const path = field.split('.')
    const name = path.pop() ?? field
    const holder = path.reduce<Record<string, unknown> | undefined>((at, key) => {
      const next = at?.[key]
      return isRecord(next) ? next : undefined
    }, target)
    if (!holder) continue
    let arr = Array.isArray(holder[name]) ? (holder[name] as unknown[]) : []
    let set: { value: unknown } | undefined
    for (const op of asArray(opOrOps)) {
      if (op && typeof op === 'object' && op.mode === 'setProp') set = { value: op.value }
      else if (op && typeof op === 'object' && 'mode' in op) arr = applyModOp(arr, op)
    }
    holder[name] = set ? set.value : arr
  }
}

/**
 * Resolve a single entry's `_copy` chain. `find` locates a base entry by
 * name+source (returning undefined if unknown). Returns a new resolved object;
 * the original is not mutated. If the base can't be found, the entry is returned
 * with `_copy` stripped so callers still get usable own-fields.
 */
export function resolveCopy<T extends Copyable>(
  entry: T,
  find: (name: string, source: string) => T | undefined,
): T {
  if (!entry._copy) return entry
  const baseRef = entry._copy
  const base = find(baseRef.name, baseRef.source)
  if (!base) {
    const { _copy, ...rest } = entry
    void _copy
    return rest as T
  }

  const resolvedBase = resolveCopy(base, find)
  const result: Record<string, unknown> = structuredClone(resolvedBase)

  // Overlay the entry's own properties (own values win over inherited).
  for (const [k, v] of Object.entries(entry)) {
    if (k === '_copy') continue
    result[k] = v
  }
  // Identity comes from the copying entry.
  result.name = entry.name
  result.source = entry.source

  if (baseRef._mod) applyMods(result, baseRef._mod)
  delete result._copy
  return result as T
}
