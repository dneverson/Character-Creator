// The characters storage the app uses once an account exists: the device's storage,
// with the sync engine told of every save and removal. The app reads and writes
// characters through `CharacterStorage` as it always did and never knows whether an
// account is signed in; when none is, the engine ignores what it is told.

import type { CharacterStorage } from '../storage/characters'
import type { SyncEngine } from './sync'

export function cloudCharacterStorage(
  device: CharacterStorage,
  sync: Pick<SyncEngine, 'noteSave' | 'noteRemove'>,
): CharacterStorage {
  return {
    loadAll: () => device.loadAll(),
    async save(character) {
      await device.save(character)
      sync.noteSave(character)
    },
    async remove(id) {
      await device.remove(id)
      sync.noteRemove(id)
    },
  }
}
