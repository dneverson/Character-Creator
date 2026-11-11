import { create } from 'zustand'

export interface StorageStatus {
  /**
   * What the user does is being kept on this device. False once the browser has
   * refused to store it: the app then works from memory for the rest of the visit,
   * and says so (`StorageNotice`).
   */
  persistent: boolean
}

export const useStorageStatus = create<StorageStatus>()(() => ({ persistent: true }))

/** Record that the browser is not keeping what the user does. */
export function storageNotKept(): void {
  useStorageStatus.setState({ persistent: false })
}
