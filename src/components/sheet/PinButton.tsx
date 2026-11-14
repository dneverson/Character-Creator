// The one button every row of the Actions, Spells, Inventory and Features tables carries to
// add the row to the Favorites or take it off: a plus when it is not there, a minus when it
// is. The click is only the pin; it never opens the row's text.

import type { FavoriteKind } from '../../character/favorites'
import { RowActionButton } from '../table/RowActionButton'
import { useFavorites } from './useFavorites'

export const ADD_FAVORITE = 'Add to Favorites'
export const REMOVE_FAVORITE = 'Remove from Favorites'

export function PinButton({ kind, id }: { kind: FavoriteKind; id: string }) {
  const { has, add, remove } = useFavorites()
  const favorite = { kind, key: id }
  const pinned = has(favorite)
  return (
    <RowActionButton
      label={pinned ? REMOVE_FAVORITE : ADD_FAVORITE}
      kind={pinned ? 'remove' : 'add'}
      variant="secondary"
      onClick={() => (pinned ? remove(favorite) : add(favorite))}
    />
  )
}
