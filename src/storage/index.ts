// The app's one place for the user's characters, backed by this browser's storage.

import { appConfig } from '../config/app'
import { localCharacterStorage } from './characters'
import { deviceSettings } from './deviceSettings'
import { openStore } from './keyValue'
import { storageNotKept, useStorageStatus } from './status'

export const characterStorage = localCharacterStorage({
  store: openStore(appConfig.stores.characters, storageNotKept),
  persistent: () => useStorageStatus.getState().persistent,
  earlier: {
    settings: deviceSettings,
    key: appConfig.storageKeys.characters,
    movedKey: appConfig.storageKeys.charactersMoved,
  },
})
