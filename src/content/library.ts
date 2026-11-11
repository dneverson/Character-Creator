// The content library: the full book content, downloaded by the browser from the
// configured source and kept in browser storage.
//
// How it behaves:
//   - A file something asks for is answered from storage, or downloaded at once
//     and then stored. Nothing the user is waiting on ever sits in a queue.
//   - Meanwhile the files in `contentConfig.prefetch` are downloaded in the
//     background, a few at a time, so later sections find them already stored.
//   - About once a day one small request checks for a newer version. Only then is
//     the file list read, and only the files whose content changed are fetched.
//   - Once those are stored, the thumbnails of the book covers are made, also in
//     the background (src/content/covers.ts).
//   - If the source cannot be reached the library says so once and stops trying
//     until asked again; callers fall back to the free rules the site hosts.
//
// The library never decides what to show. `src/data/dataClient.ts` does that.

import { create } from 'zustand'
import { contentConfig } from '../config/content'
import type { KeyValueStore } from '../storage/keyValue'
import { coverPaths, type CoverLibrary } from './covers'
import { fullContentWanted, useContentSettings } from './settings'
import {
  SourceError,
  commitFiles,
  contentId,
  fetchFromSource,
  latestCommit,
} from './source'

/** A downloaded file as stored: its parsed content and its content id. */
export interface StoredFile {
  id: string
  data: unknown
}

/** What the library remembers between visits. */
export interface LibraryRecord {
  /** The commit the stored files were last brought up to, when known. */
  commit: string | null
  /** When the version was last checked (ms epoch); 0 for never. */
  checkedAt: number
  /** Whether the files came from the source or from the visitor's own folder. */
  origin: 'download' | 'import'
  /** Content id of every stored file, by path. A path missing here is not stored. */
  files: Record<string, string>
  /** Every prefetch file was stored at the end of the last background run. */
  complete: boolean
}

export interface ContentStatus {
  /**
   * Bumped whenever the content of every file may have changed at once (full
   * content switched on or off, an import, another source, a retry). Anything
   * that caches loaded data keys it on this number.
   */
  epoch: number
  /** Background work in progress. */
  activity: 'idle' | 'downloading' | 'importing'
  /** Files finished and files wanted by the current background run. */
  done: number
  total: number
  /** How many files are stored in this browser. */
  stored: number
  complete: boolean
  commit: string | null
  origin: LibraryRecord['origin']
  checkedAt: number
  /** The source could not be reached; cleared by `retry`. */
  unreachable: boolean
}

const RECORD_KEY = 'library'

function emptyRecord(): LibraryRecord {
  return { commit: null, checkedAt: 0, origin: 'download', files: {}, complete: false }
}

export const useContentStatus = create<ContentStatus>()(() => ({
  epoch: 0,
  activity: 'idle',
  done: 0,
  total: 0,
  stored: 0,
  complete: false,
  commit: null,
  origin: 'download',
  checkedAt: 0,
  unreachable: false,
}))

/** The path of a file inside the data folder, from its path inside a picked folder. */
export function importedDataPath(relativePath: string): string | null {
  const parts = relativePath.split('/').filter(Boolean)
  const dataAt = parts.indexOf(contentConfig.dataFolder)
  // Either the picked folder contains `data/`, or the picked folder is the data.
  const inside = dataAt >= 0 ? parts.slice(dataAt + 1) : parts.slice(1)
  const path = inside.join('/')
  if (!path.endsWith('.json')) return null
  return contentConfig.importExclude.some((prefix) => path.startsWith(prefix))
    ? null
    : path
}

function isFileIndex(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  )
}

export interface ContentLibraryOptions {
  files: KeyValueStore<StoredFile>
  record: KeyValueStore<LibraryRecord>
  /** The book covers, which follow the content: prefetched after it, cleared with it. */
  covers?: Pick<CoverLibrary, 'prefetch' | 'importFiles' | 'stop' | 'clear'>
  now?: () => number
}

export type ContentLibrary = ReturnType<typeof createContentLibrary>

export function createContentLibrary({
  files,
  record: recordStore,
  covers,
  now = Date.now,
}: ContentLibraryOptions) {
  let record = emptyRecord()
  let restoring: Promise<void> | undefined
  // Every run of work belongs to a generation. Switching the content off, clearing
  // it or changing the source starts a new one, and work from an older generation
  // is discarded when it finishes instead of being stored.
  let generation = 0
  let unreachable = false
  // The file list of the commit last checked, kept to verify files that were
  // requested before the commit was known.
  let listing: Map<string, string> | null = null
  const downloads = new Map<string, Promise<unknown>>()
  const queue: string[] = []
  let running = 0
  let done = 0
  let total = 0
  let failed = 0
  let importing = false
  // Queued files that still have to be downloaded: what the progress counts.
  const awaited = new Set<string>()
  let drained: (() => void) | undefined

  function publish(extra: Partial<ContentStatus> = {}) {
    useContentStatus.setState({
      activity: importing ? 'importing' : total > done ? 'downloading' : 'idle',
      done,
      total,
      stored: Object.keys(record.files).length,
      complete: record.complete,
      commit: record.commit,
      origin: record.origin,
      checkedAt: record.checkedAt,
      unreachable,
      ...extra,
    })
  }

  function bumpEpoch() {
    publish({ epoch: useContentStatus.getState().epoch + 1 })
  }

  function saveRecord(): Promise<void> {
    return recordStore.set(RECORD_KEY, record)
  }

  /** Read what an earlier visit stored. Runs once; everything else waits on it. */
  function restore(): Promise<void> {
    restoring ??= recordStore.get(RECORD_KEY).then((saved) => {
      if (saved) record = saved
      publish()
    })
    return restoring
  }

  /** Parse a downloaded or picked file and work out its content id. */
  async function parse(bytes: Uint8Array): Promise<StoredFile> {
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return { id: await contentId(bytes), data }
  }

  async function keep(path: string, file: StoredFile, pinned: boolean): Promise<void> {
    await files.set(path, file)
    // A file requested before the commit was known came from the branch itself,
    // which a CDN may serve a few hours stale. If it is not the commit's version,
    // leave it marked as not stored so the pinned version is fetched.
    const expected = listing?.get(path)
    if (!pinned && expected && expected !== file.id) {
      delete record.files[path]
      enqueue([path])
    } else {
      record.files[path] = file.id
    }
    await saveRecord()
    publish()
  }

  function download(path: string, priority: RequestPriority): Promise<unknown> {
    const pending = downloads.get(path)
    if (pending) return pending
    if (unreachable) return Promise.reject(new SourceError(path, false))

    const startedIn = generation
    const { source } = useContentSettings.getState()
    const pinned = record.commit !== null
    const task = fetchFromSource(
      source.dataRepository,
      record.commit ?? source.ref,
      `${contentConfig.dataFolder}/${path}`,
      priority,
    )
      .then((response) => response.arrayBuffer())
      .then(async (buffer) => {
        const file = await parse(new Uint8Array(buffer))
        if (startedIn === generation) await keep(path, file, pinned)
        return file.data
      })
      .catch((error: unknown) => {
        // A file the source does not have is that file's problem. Anything else
        // means the source itself is not answering.
        const missing = error instanceof SourceError && error.missing
        if (!missing && startedIn === generation) {
          unreachable = true
          queue.length = 0
          publish()
        }
        throw error
      })
      .finally(() => downloads.delete(path))
    downloads.set(path, task)
    return task
  }

  async function read(path: string, priority: RequestPriority): Promise<unknown> {
    await restore()
    if (record.files[path]) {
      const stored = await files.get(path)
      if (stored) return stored.data
      // The browser dropped the file (cleared site data); treat it as not stored.
      delete record.files[path]
    }
    return download(path, priority)
  }

  /** Make sure one prefetch file is stored, and follow it if it is an index. */
  async function ensure(path: string): Promise<void> {
    const isIndex = path.endsWith('/index.json')
    if (record.files[path] && !isIndex) return
    const data = await read(path, 'low')
    if (isIndex && isFileIndex(data)) {
      const folder = path.slice(0, path.lastIndexOf('/'))
      enqueue(Object.values(data).map((name) => `${folder}/${name}`))
    }
  }

  function enqueue(paths: string[]) {
    for (const path of paths) {
      if (queue.includes(path)) continue
      queue.push(path)
      if (!record.files[path] && !awaited.has(path)) {
        awaited.add(path)
        total++
      }
    }
    publish()
    pump()
  }

  function pump() {
    while (
      running < contentConfig.backgroundConcurrency &&
      queue.length > 0 &&
      !unreachable
    ) {
      const path = queue.shift() as string
      const startedIn = generation
      running++
      ensure(path)
        .catch(() => {
          failed++
        })
        .finally(() => {
          if (startedIn !== generation) return
          running--
          if (awaited.delete(path)) done++
          publish()
          pump()
          if (running === 0 && queue.length === 0) finishRun()
        })
    }
  }

  function finishRun() {
    record.complete = failed === 0 && !unreachable
    done = 0
    total = 0
    void saveRecord()
    publish()
    drained?.()
    drained = undefined
  }

  /** Stop all background work and forget its progress. */
  function halt() {
    generation++
    queue.length = 0
    running = 0
    done = 0
    total = 0
    failed = 0
    listing = null
    covers?.stop()
    awaited.clear()
    drained?.()
    drained = undefined
  }

  /**
   * Check for a newer version of the content, at most once per configured
   * interval unless `force` is set. Files whose content changed are marked as not
   * stored and fetched again in the background. Resolves to whether the source
   * was asked and answered.
   */
  async function checkForUpdate(force = false): Promise<boolean> {
    await restore()
    if (!fullContentWanted()) return false
    // Imported content is the visitor's own; it is only replaced when they ask.
    if (record.origin === 'import' && !force) return false
    const intervalMs = contentConfig.updateCheckHours * 3_600_000
    if (!force && now() - record.checkedAt < intervalMs) return false

    const startedIn = generation
    const { source } = useContentSettings.getState()
    const latest = await latestCommit(source.dataRepository, source.ref)
    if (!latest || startedIn !== generation) return false
    if (latest !== record.commit) {
      const current = await commitFiles(source.dataRepository, latest)
      if (!current || startedIn !== generation) return false
      listing = current
      const changed = Object.keys(record.files).filter((path) => {
        const id = current.get(path)
        return id !== undefined && id !== record.files[path]
      })
      for (const path of changed) delete record.files[path]
      record.commit = latest
      record.complete = record.complete && changed.length === 0
      enqueue(changed)
    }
    record.checkedAt = now()
    record.origin = 'download'
    await saveRecord()
    publish()
    return true
  }

  /** Download every prefetch file that is not stored yet. Resolves when the run ends. */
  async function fill(): Promise<void> {
    await restore()
    if (!fullContentWanted() || unreachable) return
    const finished = new Promise<void>((resolve) => {
      const previous = drained
      drained = () => {
        previous?.()
        resolve()
      }
    })
    failed = 0
    enqueue([...contentConfig.prefetch])
    await finished
    await prefetchCovers()
  }

  /** Make the thumbnails of the covers the stored books file names. */
  async function prefetchCovers(): Promise<void> {
    const path = contentConfig.booksFile
    if (!covers || unreachable || !fullContentWanted() || !record.files[path]) return
    const startedIn = generation
    const books = await read(path, 'low').catch(() => null)
    if (startedIn === generation) await covers.prefetch(coverPaths(books))
  }

  return {
    /**
     * One file of the full content, from storage or downloaded now. Rejects when
     * it cannot be had; the caller decides what to show instead.
     */
    read: <T>(path: string): Promise<T> => read(path, 'high') as Promise<T>,

    /** Bring the stored content up to date in the background. Call once at startup. */
    async start(): Promise<void> {
      await restore()
      if (!fullContentWanted()) return
      await checkForUpdate()
      await fill()
    },

    checkForUpdate,

    /** Switch the full content on and start downloading it. */
    async enable(): Promise<void> {
      useContentSettings.getState().setFullContent(true)
      unreachable = false
      bumpEpoch()
      await checkForUpdate()
      await fill()
    },

    /** Switch back to the free rules. Stored files are kept until `remove`. */
    disable() {
      useContentSettings.getState().setFullContent(false)
      halt()
      bumpEpoch()
    },

    /** Switch back to the free rules and delete everything that was downloaded. */
    async remove(): Promise<void> {
      useContentSettings.getState().setFullContent(false)
      halt()
      record = emptyRecord()
      await files.clear()
      await covers?.clear()
      await saveRecord()
      bumpEpoch()
    },

    /** Try the source again after it could not be reached. */
    async retry(): Promise<void> {
      unreachable = false
      bumpEpoch()
      await checkForUpdate(true)
      await fill()
    },

    /** Point the library at another source. What was stored from the old one is dropped. */
    async useSource(source: {
      dataRepository: string
      imageRepository: string
      ref: string
    }): Promise<void> {
      useContentSettings.getState().setSource(source)
      halt()
      unreachable = false
      record = emptyRecord()
      await files.clear()
      await covers?.clear()
      await saveRecord()
      bumpEpoch()
      await checkForUpdate()
      await fill()
    },

    /**
     * Store content from files the visitor picked on their own device (a copy of
     * the data folder, of the cover images, or both). Returns how many files were
     * stored.
     */
    async importFiles(picked: File[]): Promise<number> {
      await restore()
      halt()
      importing = true
      publish()
      let count = 0
      let images = 0
      try {
        for (const file of picked) {
          const path = importedDataPath(file.webkitRelativePath || file.name)
          if (!path) continue
          try {
            const parsed = await parse(new Uint8Array(await file.arrayBuffer()))
            await files.set(path, parsed)
            record.files[path] = parsed.id
            count++
          } catch {
            // Not valid JSON, or unreadable: leave it out and carry on.
          }
        }
        if (count > 0) {
          record.origin = 'import'
          record.commit = null
          record.complete = contentConfig.prefetch.every((path) => record.files[path])
          unreachable = false
          useContentSettings.getState().setFullContent(true)
          await saveRecord()
        }
        if (covers) images = await covers.importFiles(picked)
      } finally {
        importing = false
      }
      bumpEpoch()
      return count + images
    },
  }
}
