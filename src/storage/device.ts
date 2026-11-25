// The characters kept on this device: the app's primary store, in this browser's storage.
// The store is opened on first use, so importing this module (the account page does,
// through the cloud wiring) touches no storage and cannot raise the "not saving" notice.

import { appConfig } from '../config/app'
import { localCharacterStorage, type CharacterStorage } from './characters'
import { deviceSettings } from './deviceSettings'
import { openStore } from './keyValue'
import { storageNotKept, useStorageStatus } from './status'

let opened: CharacterStorage | undefined

const open = (): CharacterStorage =>
  (opened ??= localCharacterStorage({
    store: openStore(appConfig.stores.characters, storageNotKept),
    persistent: () => useStorageStatus.getState().persistent,
    earlier: {
      settings: deviceSettings,
      key: appConfig.storageKeys.characters,
      movedKey: appConfig.storageKeys.charactersMoved,
    },
  }))

export const deviceCharacters: CharacterStorage = {
  loadAll: () => open().loadAll(),
  save: (character) => open().save(character),
  remove: (id) => open().remove(id),
}
