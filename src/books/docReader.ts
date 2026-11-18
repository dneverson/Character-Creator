// Reading a stored document and finding its words, off the page's thread. Reading a
// document (parsing its file, writing out the classes it names, putting it in print
// order) and finding its words is most of the work of building the search index, and one
// document can take a fifth of a second. A module worker does it, so typing never waits
// for it; the index only merges the words in, in small slices. Where there is no worker
// the same work runs on the page's own thread.

import { appConfig } from '../config/app'
import { fullContentWanted, useContentSettings } from '../content/settings'
import { storedMisses } from '../data/dataClient'
import { readBookText } from './load'
import { tokenize, type DocTokens } from './tokenize'
import { spawnDocWorker } from './spawnDocWorker'
import type { DocKind } from './types'

/** What the page asks the worker. `n` pairs an answer with its request. */
export interface DocRequest {
  n: number
  kind: DocKind
  id: string
  /** The visitor's choice about the full content, which the worker cannot read itself. */
  fullContent: boolean
}

/** What the worker answers: the document's words, or that it could not be read. */
export type DocAnswer = { n: number; tokens: DocTokens } | { n: number; failed: true }

/** The part of a `Worker` this uses. */
export interface WorkerPort {
  postMessage: (request: DocRequest) => void
  terminate: () => void
  onmessage: ((event: MessageEvent<DocAnswer>) => unknown) | null
  onerror: ((event: ErrorEvent) => unknown) | null
}

export interface DocReader {
  /** How many documents it reads at the same time. */
  parallel: number
  /**
   * The words of one stored document; rejects when it cannot be read. What the worker
   * cannot read it leaves to this thread, which can download what is missing.
   */
  read: (kind: DocKind, id: string) => Promise<DocTokens>
  /** Let go of the worker. */
  close: () => void
}

/** A document's words. */
export async function readDocTokens(kind: DocKind, id: string): Promise<DocTokens> {
  const { scan } = await readBookText(kind, id)
  return tokenize(scan)
}

/**
 * The worker's side: answer one request. A document that needed a file the page has not
 * stored is not answered: the worker only reads, so the page reads it, which fetches and
 * stores that file.
 */
export async function answer(request: DocRequest): Promise<DocAnswer> {
  const { n, kind, id, fullContent } = request
  useContentSettings.getState().setFullContent(fullContent)
  const before = storedMisses()
  try {
    const tokens = await readDocTokens(kind, id)
    if (storedMisses() === before) return { n, tokens }
    return { n, failed: true }
  } catch {
    return { n, failed: true }
  }
}

/** The buffers an answer hands over rather than copies. */
export function transferOf(reply: DocAnswer): ArrayBuffer[] {
  return 'tokens' in reply ? [reply.tokens.offsets.buffer, reply.tokens.ids.buffer] : []
}

/**
 * Open a reader on `count` workers `spawn` gives, or on this thread when it gives none.
 * Each document goes to the worker with the least to do.
 */
export function openDocReader(
  count: number = appConfig.books.indexWorkers,
  spawn: () => WorkerPort | undefined = spawnDocWorker,
): DocReader {
  const ports = Array.from({ length: count }, spawn).filter(
    (port): port is WorkerPort => port !== undefined,
  )
  if (ports.length === 0)
    return { parallel: 1, read: readDocTokens, close: () => undefined }
  interface Wait {
    port: WorkerPort
    resolve: (tokens: DocTokens) => void
    reject: (error: Error) => void
  }
  const waiting = new Map<number, Wait>()
  let next = 0
  for (const port of ports) {
    port.onmessage = ({ data }) => {
      const wait = waiting.get(data.n)
      waiting.delete(data.n)
      if ('tokens' in data) wait?.resolve(data.tokens)
      else wait?.reject(new Error('The worker could not read the document'))
    }
    port.onerror = () => {
      for (const [n, wait] of waiting) {
        if (wait.port !== port) continue
        wait.reject(new Error('The worker stopped'))
        waiting.delete(n)
      }
    }
  }
  const busy = (port: WorkerPort) =>
    [...waiting.values()].filter((wait) => wait.port === port).length
  return {
    parallel: ports.length,
    read(kind, id) {
      const port = ports.reduce((least, one) => (busy(one) < busy(least) ? one : least))
      const n = next++
      const promise = new Promise<DocTokens>((resolve, reject) =>
        waiting.set(n, { port, resolve, reject }),
      )
      port.postMessage({ n, kind, id, fullContent: fullContentWanted() })
      return promise.catch(() => readDocTokens(kind, id))
    },
    close: () => ports.forEach((port) => port.terminate()),
  }
}
