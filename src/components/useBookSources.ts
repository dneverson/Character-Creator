// Redraws a component when book names are registered after it first drew, so a source
// code shows its full name once the books have loaded.

import { useSyncExternalStore } from 'react'
import { bookSourcesSnapshot, subscribeBookSources } from '../data/glossary'

export function useBookSources(): void {
  useSyncExternalStore(subscribeBookSources, bookSourcesSnapshot)
}
