// The account and the cloud copy, put together for the app. Importing this loads none of
// the cloud library: `loadBackend` fetches it when it is first needed.

import { appConfig } from '../config/app'
import { showToast } from '../ui/toasts'
import { deviceCharacters } from '../storage/device'
import { deviceSettings } from '../storage/deviceSettings'
import { createAccount } from './account'
import { cloudCharacterStorage } from './cloudStorage'
import { applyRemoteChange } from './remote'
import { sessionKey, signInRedirect, takeAuthCode } from './redirect'
import { deviceRemovalStore } from './removals'
import { deviceSentEventsStore } from './sentEvents'
import { createSyncEngine } from './sync'

const sync = createSyncEngine({
  local: deviceCharacters,
  removals: deviceRemovalStore(
    deviceSettings,
    appConfig.storageKeys.cloudRemovals,
    appConfig.storageKeys.cloudLastUser,
  ),
  sentEvents: deviceSentEventsStore(
    deviceSettings,
    appConfig.storageKeys.cloudSentEvents,
  ),
  eventsPerRequest: appConfig.cloud.eventsPerRequest,
  onRemote: applyRemoteChange,
  debounceMs: appConfig.cloud.syncDebounceMs,
  retryMs: appConfig.cloud.retryMs,
})

/** The characters storage of the app: the device's, followed by the cloud when signed in. */
export const characterStorage = cloudCharacterStorage(deviceCharacters, sync)

export const account = createAccount({
  loadBackend: async () => (await import('./supabaseBackend')).createSupabaseBackend(),
  sync,
  hasSavedSession: () => deviceSettings.getItem(sessionKey(appConfig.cloud.url)) !== null,
  takeCode() {
    const found = takeAuthCode(window.location.href)
    if (!found) return null
    window.history.replaceState(null, '', found.next)
    return found.code
  },
  redirectTo: () => signInRedirect(window.location.origin, import.meta.env.BASE_URL),
  notify: (message) => showToast(message),
})
