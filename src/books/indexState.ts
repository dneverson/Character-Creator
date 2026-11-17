// The one search index of the books on this device, kept up to date with what is stored.
// Nothing is built at app start: the reader asks for it when it opens. A book stored
// later (read for the first time, or downloaded in bulk) is added when asked again.

import { create } from 'zustand'
import { contentLibrary } from '../content'
import { contentEpoch } from '../content/epoch'
import { docPath } from './catalog'
import { readBookText } from './load'
import { createBookIndex, type BookIndex } from './searchIndex'
import type { BookDoc } from './types'

interface IndexStatus {
  /** Bumps whenever the index holds more than it did, so a search can run again. */
  version: number
  /** Documents in the index, and documents the catalog lists. */
  indexed: number
  listed: number
  building: boolean
}

export const useIndexStatus = create<IndexStatus>()(() => ({
  version: 0,
  indexed: 0,
  listed: 0,
  building: false,
}))

let index: BookIndex = createBookIndex()
let epoch = contentEpoch()
let running: Promise<void> | undefined
let again = false
/** The documents the latest request listed, which the running pass goes round again for. */
let wanted: BookDoc[] = []

/** The index as it is now; it grows as `syncIndex` adds documents. */
export function currentIndex(): BookIndex {
  return index
}

async function pass(docs: BookDoc[]): Promise<void> {
  for (const doc of docs) {
    if (index.has(doc.kind, doc.id)) continue
    if (!(await contentLibrary.has(docPath(doc.kind, doc.id)))) continue
    try {
      const { scan } = await readBookText(doc.kind, doc.id)
      await index.addDoc({ kind: doc.kind, id: doc.id, name: doc.name }, scan)
    } catch {
      // A text that cannot be read is left out; the next pass tries it again.
      continue
    }
    useIndexStatus.setState((s) => ({
      version: s.version + 1,
      indexed: index.size().docs,
    }))
  }
}

/**
 * Add every stored book and adventure that is not in the index yet. One pass runs at a
 * time; a request that arrives during a pass makes it go round once more.
 */
export function syncIndex(docs: BookDoc[]): Promise<void> {
  if (epoch !== contentEpoch()) {
    // The content changed wholesale: nothing of the old index is true any more.
    index = createBookIndex()
    epoch = contentEpoch()
    useIndexStatus.setState((s) => ({ version: s.version + 1, indexed: 0 }))
  }
  wanted = docs
  useIndexStatus.setState({ listed: docs.length })
  if (running) {
    again = true
    return running
  }
  useIndexStatus.setState({ building: true })
  running = (async () => {
    do {
      again = false
      await pass(wanted)
    } while (again)
  })().finally(() => {
    running = undefined
    useIndexStatus.setState({ building: false })
  })
  return running
}

/** Test-only: start from an empty index. */
export function _resetIndex(): void {
  index = createBookIndex()
  epoch = contentEpoch()
  running = undefined
  again = false
  useIndexStatus.setState({ version: 0, indexed: 0, listed: 0, building: false })
}
