// The character's Favorites: the attacks, spells, items, features and limited uses the
// player pins on the sheet for quick access. A favorite is only a pointer, the kind of
// thing and the id the derived sheet already gives that row; what it shows is read live
// from the sheet, so it can never go out of date. What a file may hold is checked here.

/** What can be pinned: the five kinds of row the sheet's tables list. */
export const FAVORITE_KINDS = ['attack', 'spell', 'item', 'feature', 'use'] as const

export type FavoriteKind = (typeof FAVORITE_KINDS)[number]

export interface Favorite {
  kind: FavoriteKind
  /** The id of the row on the sheet: an attack's id, a spell's key, an item's key... */
  key: string
}

/** The longest key kept; a real id is far shorter, so a longer one is not one. */
export const FAVORITE_KEY_MAX = 300

const isKind = (value: unknown): value is FavoriteKind =>
  FAVORITE_KINDS.some((kind) => kind === value)

function isFavorite(value: unknown): value is Favorite {
  if (typeof value !== 'object' || value === null) return false
  const { kind, key } = value as Partial<Record<keyof Favorite, unknown>>
  return (
    isKind(kind) &&
    typeof key === 'string' &&
    key !== '' &&
    key.length <= FAVORITE_KEY_MAX
  )
}

export const sameFavorite = (a: Favorite, b: Favorite) =>
  a.kind === b.kind && a.key === b.key

export const hasFavorite = (list: readonly Favorite[], favorite: Favorite) =>
  list.some((f) => sameFavorite(f, favorite))

/** The favorites a stored or imported value holds: valid ones, once each, in order. */
export function normalizeFavorites(raw: unknown): Favorite[] {
  if (!Array.isArray(raw)) return []
  const out: Favorite[] = []
  for (const value of raw) {
    if (!isFavorite(value)) continue
    const favorite: Favorite = { kind: value.kind, key: value.key }
    if (!hasFavorite(out, favorite)) out.push(favorite)
  }
  return out
}

/** The list with the favorite added at the end; the same list when it is already there. */
export function addFavorite(list: readonly Favorite[], favorite: Favorite): Favorite[] {
  return hasFavorite(list, favorite) ? [...list] : [...list, favorite]
}

/** The list without the favorite. */
export function removeFavorite(
  list: readonly Favorite[],
  favorite: Favorite,
): Favorite[] {
  return list.filter((f) => !sameFavorite(f, favorite))
}

/** The list with the favorite one place earlier (-1) or later (1); at the end, unchanged. */
export function moveFavorite(
  list: readonly Favorite[],
  favorite: Favorite,
  by: -1 | 1,
): Favorite[] {
  const from = list.findIndex((f) => sameFavorite(f, favorite))
  const to = from + by
  if (from < 0 || to < 0 || to >= list.length) return [...list]
  const out = [...list]
  const [moved] = out.splice(from, 1)
  out.splice(to, 0, moved)
  return out
}
