// The character's Favorites and the way to change them. Pinning is not a change to the
// build, so it is saved with the character but never recorded in its history (see
// UNTRACKED in character/history.ts), and the Level up Undo and Done do not see it.

import { useCallback, useMemo } from 'react'
import {
  addFavorite,
  hasFavorite,
  moveFavorite,
  removeFavorite,
  type Favorite,
} from '../../character/favorites'
import {
  useCharacter,
  useLatestCharacter,
  useUpdateCharacter,
} from '../../character/useCharacterDoc'

const NONE: readonly Favorite[] = []

export function useFavorites() {
  const favorites = useCharacter()?.favorites ?? NONE
  const latest = useLatestCharacter()
  const update = useUpdateCharacter()
  // Each change reads the list as it is now, so quick clicks add up.
  const change = useCallback(
    (make: (list: readonly Favorite[]) => Favorite[]) => {
      const character = latest()
      if (character) update({ favorites: make(character.favorites ?? NONE) })
    },
    [latest, update],
  )
  return useMemo(
    () => ({
      favorites,
      has: (favorite: Favorite) => hasFavorite(favorites, favorite),
      add: (favorite: Favorite) => change((list) => addFavorite(list, favorite)),
      remove: (favorite: Favorite) => change((list) => removeFavorite(list, favorite)),
      move: (favorite: Favorite, by: -1 | 1) =>
        change((list) => moveFavorite(list, favorite, by)),
    }),
    [favorites, change],
  )
}
