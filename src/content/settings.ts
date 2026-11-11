// The visitor's own content settings: whether they want the full content, and
// which source it comes from. Small and synchronous, so it is a device setting.

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  contentConfig,
  type ContentDownloadMode,
  type ContentSource,
} from '../config/content'
import { deviceSettings } from '../storage/deviceSettings'

interface ContentSettingsState {
  /** The visitor's choice about the full content; `null` until they make one. */
  fullContent: boolean | null
  source: ContentSource
  setFullContent: (wanted: boolean) => void
  setSource: (source: ContentSource) => void
}

export const useContentSettings = create<ContentSettingsState>()(
  persist(
    (set) => ({
      fullContent: null,
      source: { ...contentConfig.source },
      setFullContent: (wanted) => set({ fullContent: wanted }),
      setSource: (source) => set({ source }),
    }),
    {
      name: contentConfig.settingsKey,
      storage: createJSONStorage(() => deviceSettings),
      partialize: (state) => ({ fullContent: state.fullContent, source: state.source }),
    },
  ),
)

/**
 * Whether the full content is in use. The visitor's own choice wins; before they
 * make one, the configured download mode decides.
 */
export function fullContentWanted(
  choice: boolean | null = useContentSettings.getState().fullContent,
  mode: ContentDownloadMode = contentConfig.download,
): boolean {
  return choice ?? mode === 'automatic'
}

/** Whether the one-time question about downloading the full content is still open. */
export function downloadPromptOpen(
  choice: boolean | null = useContentSettings.getState().fullContent,
  mode: ContentDownloadMode = contentConfig.download,
): boolean {
  return choice === null && mode === 'prompt'
}
