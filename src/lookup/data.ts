// The loaded rows with their search index, ready for Quick lookup. Loaded the first time
// something asks (the lookup opening, a reference being hovered), never at app start,
// and again when the content in use changes wholesale.

import { memoizeContent } from '../content/epoch'
import { useAsyncData, type AsyncData } from '../hooks/useAsyncData'
import { loadLookupRows } from './rows'
import { buildIndex, type LookupIndex } from './search'

export const loadLookupIndex = memoizeContent(async (): Promise<LookupIndex> =>
  buildIndex(await loadLookupRows()),
)

/** The lookup index: loading, then ready. */
export const useLookupIndex = (): AsyncData<LookupIndex> => useAsyncData(loadLookupIndex)
