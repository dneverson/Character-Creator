// The one search index of the books on this device, kept up to date with what is stored.
// Nothing is built at app start: the reader asks for it when it opens. A book stored
// later (read for the first time, or downloaded in bulk) is added when asked again.

import { create } from 'zustand'
import { contentLibrary } from '../content'
import { contentEpoch } from '../content/epoch'
import { docPath } from './catalog'
import { openDocReader } from './docReader'
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
  const reader = openDocReader()
  // The words of a document are found while the one before it is merged into the index.
  const fetchWords = async (doc: BookDoc) =>
    !index.has(doc.kind, doc.id) && (await contentLibrary.has(docPath(doc.kind, doc.id)))
      ? // A text that cannot be read is left out; the next pass tries it again.
        reader.read(doc.kind, doc.id).catch(() => undefined)
      : undefined
  try {
    // The words of the next few documents are found while the first of them is merged in.
    const ahead = new Map<number, ReturnType<typeof fetchWords>>()
    for (const [i, doc] of docs.entries()) {
      for (let j = i; j < Math.min(docs.length, i + reader.parallel); j++)
        if (!ahead.has(j)) ahead.set(j, fetchWords(docs[j]))
      const tokens = await ahead.get(i)
      ahead.delete(i)
      if (!tokens) continue
      await index.addTokens({ kind: doc.kind, id: doc.id, name: doc.name }, tokens)
      useIndexStatus.setState((s) => ({
        version: s.version + 1,
        indexed: index.size().docs,
      }))
    }
  } finally {
    reader.close()
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
