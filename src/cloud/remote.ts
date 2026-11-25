// Showing in the app what the sync changed on this device. The characters were already
// stored by the sync; this brings the open app up to date with them.

import { useCharacterStore } from '../character/store'
import type { RemoteChange } from './sync'

export function applyRemoteChange({ upserts, removedIds }: RemoteChange): void {
  useCharacterStore.setState((state) => {
    const characters = { ...state.characters }
    const order = [...state.order]
    for (const character of upserts) {
      // An edit made since the sync read the device is newer than what it brings.
      if ((characters[character.id]?.updatedAt ?? 0) > character.updatedAt) continue
      characters[character.id] = character
      if (!order.includes(character.id)) order.push(character.id)
    }
    return { characters, order }
  })
  for (const id of removedIds) useCharacterStore.getState().deleteCharacter(id)
}
