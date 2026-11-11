import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contentConfig } from '../config/content'
import { memoryStore, type KeyValueStore } from '../storage/keyValue'
import {
  fakeContentId,
  installFakeSource,
  prefetchFiles,
  type FakeSource,
} from '../test/contentSource'
import {
  createContentLibrary,
  importedDataPath,
  useContentStatus,
  type ContentLibrary,
  type LibraryRecord,
  type StoredFile,
} from './library'
import { useContentSettings } from './settings'

const HOUR = 3_600_000

let source: FakeSource
let files: KeyValueStore<StoredFile>
let record: KeyValueStore<LibraryRecord>
let clock: number
let library: ContentLibrary

/** A library over the same stores, as a later visit would create. */
function reopen(): ContentLibrary {
  return createContentLibrary({ files, record, now: () => clock })
}

function status() {
  return useContentStatus.getState()
}

function saved(): Promise<LibraryRecord | undefined> {
  return record.get('library')
}

function pickedFile(path: string, content: string): File {
  const file = new File([content], path.split('/').pop() as string)
  Object.defineProperty(file, 'webkitRelativePath', { value: path })
  return file
}

beforeEach(() => {
  localStorage.clear()
  useContentSettings.setState({ fullContent: null, source: { ...contentConfig.source } })
  useContentStatus.setState({ epoch: 0, unreachable: false })
  source = installFakeSource(prefetchFiles())
  files = memoryStore()
  record = memoryStore()
  clock = Date.UTC(2026, 10, 9)
  library = reopen()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reading a file', () => {
  it('downloads it once, then answers from storage', async () => {
    expect(await library.read('races.json')).toEqual({ path: 'races.json' })
    expect(source.dataRequests()).toEqual(['main:races.json'])
    expect((await files.get('races.json'))?.id).toBe(
      await fakeContentId({ path: 'races.json' }),
    )

    expect(await library.read('races.json')).toEqual({ path: 'races.json' })
    // A later visit reads the stored copy too.
    expect(await reopen().read('races.json')).toEqual({ path: 'races.json' })
    expect(source.dataRequests()).toHaveLength(1)
    expect(status().stored).toBe(1)
  })

  it('shares one download between simultaneous requests', async () => {
    const [first, second] = await Promise.all([
      library.read('feats.json'),
      library.read('feats.json'),
    ])
    expect(first).toBe(second)
    expect(source.dataRequests()).toHaveLength(1)
  })

  it('uses the next host when the first one fails', async () => {
    source.down.add(0)
    expect(await library.read('feats.json')).toEqual({ path: 'feats.json' })
    expect(source.requests).toHaveLength(2)
    expect(status().unreachable).toBe(false)
  })

  it('rejects for a file the source does not have, without giving up on the source', async () => {
    await expect(library.read('nope.json')).rejects.toThrow('does not exist')
    expect(status().unreachable).toBe(false)
    expect(await library.read('feats.json')).toEqual({ path: 'feats.json' })
  })

  it('stops asking a source that cannot be reached until told to retry', async () => {
    source.down.add(0).add(1)
    await expect(library.read('feats.json')).rejects.toThrow('could not be downloaded')
    expect(status().unreachable).toBe(true)

    const asked = source.requests.length
    await expect(library.read('races.json')).rejects.toThrow('could not be downloaded')
    expect(source.requests).toHaveLength(asked)

    source.down.clear()
    const epoch = status().epoch
    await library.retry()
    expect(status().unreachable).toBe(false)
    expect(status().epoch).toBe(epoch + 1)
    expect(await library.read('feats.json')).toEqual({ path: 'feats.json' })
  })

  it('downloads again when the browser has dropped a stored file', async () => {
    await library.read('feats.json')
    await files.clear()
    expect(await library.read('feats.json')).toEqual({ path: 'feats.json' })
    expect(source.dataRequests()).toHaveLength(2)
  })
})

describe('the background download', () => {
  it('stores every prefetch file and the files its indexes name', async () => {
    await library.start()

    const stored = (await files.keys()).sort()
    expect(stored).toEqual(Object.keys(source.files).sort())
    expect(status()).toMatchObject({
      activity: 'idle',
      complete: true,
      stored: stored.length,
      commit: source.commit,
      unreachable: false,
    })
    expect((await saved())?.complete).toBe(true)
    // Once the commit is known every file is fetched from that exact commit.
    expect(source.dataRequests().every((r) => r.startsWith(source.commit))).toBe(true)
  })

  it('reports progress while it runs', async () => {
    const seen: string[] = []
    const stop = useContentStatus.subscribe((s) => {
      if (s.activity === 'downloading') seen.push(`${s.done}/${s.total}`)
    })
    await library.start()
    stop()
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.at(-1)).toMatch(/^\d+\/\d+$/)
    expect(status()).toMatchObject({ activity: 'idle', done: 0, total: 0 })
  })

  it('downloads nothing on a later visit when everything is stored and current', async () => {
    await library.start()
    const asked = source.requests.length

    clock += HOUR
    await reopen().start()
    expect(source.requests).toHaveLength(asked)
    expect(status().complete).toBe(true)
  })

  it('does nothing while the full content is switched off', async () => {
    useContentSettings.setState({ fullContent: false })
    await library.start()
    expect(await library.checkForUpdate(true)).toBe(false)
    expect(source.requests).toEqual([])
    expect(status().stored).toBe(0)
  })

  it('still downloads when the version check is unavailable', async () => {
    source.apiDown = true
    await library.start()
    expect(status()).toMatchObject({ complete: true, commit: null })
    // Without a known commit the files come from the branch.
    expect(source.dataRequests().every((r) => r.startsWith('main:'))).toBe(true)
  })

  it('is left incomplete when a prefetch file is missing, and says the source is fine', async () => {
    delete source.files['feats.json']
    await library.start()
    expect(status()).toMatchObject({ complete: false, unreachable: false })
    expect(await files.get('races.json')).toBeDefined()
  })

  it('ends early when the source stops answering', async () => {
    source.down.add(0).add(1)
    source.apiDown = true
    await library.start()
    expect(status()).toMatchObject({ complete: false, unreachable: true, stored: 0 })
  })
})

describe('checking for a newer version', () => {
  it('fetches only the files whose content changed', async () => {
    await library.start()
    source.requests.length = 0

    source.files['feats.json'] = { path: 'feats.json', revised: true }
    source.commit = 'b'.repeat(40)
    clock += contentConfig.updateCheckHours * HOUR
    await reopen().start()

    expect(source.dataRequests()).toEqual([`${source.commit}:feats.json`])
    expect((await files.get('feats.json'))?.data).toEqual({
      path: 'feats.json',
      revised: true,
    })
    expect(status()).toMatchObject({ commit: source.commit, complete: true })
  })

  it('waits for the configured interval between checks', async () => {
    await library.start()
    source.requests.length = 0
    source.commit = 'b'.repeat(40)

    clock += contentConfig.updateCheckHours * HOUR - 1
    await reopen().start()
    expect(source.requests).toEqual([])

    // Not due yet: the source is not asked. Forced: it is, and it answers.
    expect(await reopen().checkForUpdate()).toBe(false)
    expect(await reopen().checkForUpdate(true)).toBe(true)
    expect(status().commit).toBe(source.commit)
  })

  it('says so when the source does not answer the check', async () => {
    await library.start()
    source.apiDown = true
    expect(await library.checkForUpdate(true)).toBe(false)
  })

  it('costs one small request when nothing changed', async () => {
    await library.start()
    source.requests.length = 0
    clock += contentConfig.updateCheckHours * HOUR
    await reopen().start()
    expect(source.requests).toEqual([
      contentConfig.api.commit(
        contentConfig.source.dataRepository,
        contentConfig.source.ref,
      ),
    ])
    expect(status().checkedAt).toBe(clock)
  })

  it('tries again later when the file list cannot be read', async () => {
    await library.start()
    const before = status().commit
    source.commit = 'b'.repeat(40)
    // The commit id is readable but the listing for it is not.
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: RequestInfo | URL) =>
      String(input).includes('/git/trees/')
        ? Promise.resolve(new Response('error', { status: 500 }))
        : realFetch(input),
    )
    expect(await reopen().checkForUpdate(true)).toBe(false)
    expect(status().commit).toBe(before)
  })

  it('replaces a file that was fetched from the branch before the commit was known', async () => {
    // A CDN can serve the branch a few hours stale: the first, unpinned request
    // gets an older version than the commit the version check then reports.
    const realFetch = globalThis.fetch
    let staleServed = false
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      const url = String(input)
      if (!staleServed && url.includes('@main/data/feats.json')) {
        staleServed = true
        return new Promise<Response>((resolve) => {
          // Answer only after the version check has finished.
          const stop = useContentStatus.subscribe((s) => {
            if (s.commit) {
              stop()
              resolve(new Response(JSON.stringify({ path: 'feats.json', stale: true })))
            }
          })
        })
      }
      return realFetch(input)
    })

    const early = library.read('feats.json')
    await library.start()
    expect(await early).toEqual({ path: 'feats.json', stale: true })
    expect((await files.get('feats.json'))?.data).toEqual({ path: 'feats.json' })
    expect(status().complete).toBe(true)
  })
})

describe('switching the full content on and off', () => {
  it('starts the download when switched on', async () => {
    useContentSettings.setState({ fullContent: false })
    const epoch = status().epoch
    await library.enable()
    expect(useContentSettings.getState().fullContent).toBe(true)
    expect(status()).toMatchObject({ complete: true, epoch: epoch + 1 })
  })

  it('tries the source again when switched on after it could not be reached', async () => {
    source.down.add(0).add(1)
    source.apiDown = true
    await library.start()
    expect(status().unreachable).toBe(true)

    source.down.clear()
    source.apiDown = false
    library.disable()
    await library.enable()
    expect(status()).toMatchObject({ complete: true, unreachable: false })
  })

  it('keeps stored files when switched off, and discards work still in flight', async () => {
    await library.read('races.json')
    const running = library.start()
    library.disable()
    await running

    expect(useContentSettings.getState().fullContent).toBe(false)
    expect(status()).toMatchObject({ activity: 'idle', stored: 1 })
    // Let the abandoned downloads finish; none of them may be stored.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(await files.keys()).toEqual(['races.json'])
  })

  it('removes everything that was downloaded', async () => {
    await library.start()
    const epoch = status().epoch
    await library.remove()
    expect(await files.keys()).toEqual([])
    expect(status()).toMatchObject({
      stored: 0,
      complete: false,
      commit: null,
      epoch: epoch + 1,
    })
    expect(useContentSettings.getState().fullContent).toBe(false)
  })

  it('drops the stored files and starts over when the source changes', async () => {
    await library.start()
    source.requests.length = 0
    const other = { ...contentConfig.source, ref: 'next' }
    await library.useSource(other)
    expect(useContentSettings.getState().source).toEqual(other)
    // The fake source only knows the default branch, so nothing can be fetched.
    expect(status().stored).toBe(0)
    expect(source.requests.length).toBeGreaterThan(0)
  })
})

describe('importing a copy of the data folder', () => {
  it('stores the picked files and switches the full content on', async () => {
    useContentSettings.setState({ fullContent: false })
    const epoch = status().epoch
    const count = await library.importFiles([
      pickedFile('5etools/data/feats.json', '{"feat":[]}'),
      pickedFile('5etools/data/class/class-bard.json', '{"class":[]}'),
      pickedFile('5etools/data/adventure/adventure-cos.json', '{"data":[]}'),
      pickedFile('5etools/data/broken.json', '{not json'),
      pickedFile('5etools/data/readme.md', 'hello'),
    ])

    expect(count).toBe(2)
    expect((await files.keys()).sort()).toEqual(['class/class-bard.json', 'feats.json'])
    expect(await library.read('feats.json')).toEqual({ feat: [] })
    expect(source.requests).toEqual([])
    expect(useContentSettings.getState().fullContent).toBe(true)
    expect(status()).toMatchObject({
      origin: 'import',
      activity: 'idle',
      complete: false,
      epoch: epoch + 1,
    })
  })

  it('is complete when the import covers every prefetch file', async () => {
    const picked = contentConfig.prefetch.map((path) => pickedFile(`data/${path}`, '{}'))
    expect(await library.importFiles(picked)).toBe(picked.length)
    expect(status().complete).toBe(true)
  })

  it('is not replaced by the source unless an update is asked for', async () => {
    await library.importFiles([pickedFile('data/feats.json', '{"feat":[]}')])
    clock += contentConfig.updateCheckHours * HOUR
    await library.checkForUpdate()
    expect(source.requests).toEqual([])

    await library.checkForUpdate(true)
    await library.start()
    expect(status().origin).toBe('download')
    expect((await files.get('feats.json'))?.data).toEqual({ path: 'feats.json' })
  })

  it('changes nothing when no usable file was picked', async () => {
    expect(await library.importFiles([pickedFile('notes/readme.md', 'hello')])).toBe(0)
    expect(status().origin).toBe('download')
    expect(useContentSettings.getState().fullContent).toBeNull()
  })
})

describe('the book covers', () => {
  const PHB = 'covers/PHB.webp'
  let covers: {
    prefetch: ReturnType<typeof vi.fn<(paths: string[]) => Promise<void>>>
    importFiles: ReturnType<typeof vi.fn<(picked: File[]) => Promise<number>>>
    stop: ReturnType<typeof vi.fn<() => void>>
    clear: ReturnType<typeof vi.fn<() => Promise<void>>>
  }

  beforeEach(() => {
    source.files[contentConfig.booksFile] = {
      book: [{ name: 'PHB', cover: { type: 'internal', path: PHB } }],
    }
    covers = {
      prefetch: vi.fn(() => Promise.resolve()),
      importFiles: vi.fn(() => Promise.resolve(0)),
      stop: vi.fn(),
      clear: vi.fn(() => Promise.resolve()),
    }
    library = createContentLibrary({ files, record, covers, now: () => clock })
  })

  it('are prefetched once the content is stored', async () => {
    await library.start()
    expect(covers.prefetch).toHaveBeenCalledTimes(1)
    expect(covers.prefetch).toHaveBeenCalledWith([PHB])
  })

  it('are left alone when the source cannot be reached', async () => {
    source.down.add(0).add(1)
    source.apiDown = true
    await library.start()
    expect(covers.prefetch).not.toHaveBeenCalled()
  })

  it('are left alone when the full content is switched off', async () => {
    useContentSettings.setState({ fullContent: false })
    await library.start()
    expect(covers.prefetch).not.toHaveBeenCalled()
  })

  it('stop being prefetched when the full content is switched off', async () => {
    await library.start()
    library.disable()
    expect(covers.stop).toHaveBeenCalled()
    expect(covers.clear).not.toHaveBeenCalled()
  })

  it('are deleted with the content, and when the source changes', async () => {
    await library.start()
    await library.remove()
    expect(covers.clear).toHaveBeenCalledTimes(1)

    await library.useSource({ ...contentConfig.source, ref: 'next' })
    expect(covers.clear).toHaveBeenCalledTimes(2)
  })

  it('are imported from the same picked folder, and counted', async () => {
    covers.importFiles.mockResolvedValue(2)
    const picked = [
      pickedFile('data/feats.json', '{"feat":[]}'),
      pickedFile('covers/PHB.webp', 'image'),
    ]
    expect(await library.importFiles(picked)).toBe(3)
    expect(covers.importFiles).toHaveBeenCalledWith(picked)
  })
})

describe('importedDataPath', () => {
  it('reads the path after the data folder', () => {
    expect(importedDataPath('5etools-src/data/class/class-bard.json')).toBe(
      'class/class-bard.json',
    )
    expect(importedDataPath('data/feats.json')).toBe('feats.json')
  })

  it('treats a differently named folder as the data folder itself', () => {
    expect(importedDataPath('my-copy/spells/spells-phb.json')).toBe(
      'spells/spells-phb.json',
    )
  })

  it('leaves out other file types and the excluded folders', () => {
    expect(importedDataPath('data/readme.md')).toBeNull()
    expect(importedDataPath('data/adventure/adventure-cos.json')).toBeNull()
  })

  it('keeps the book text, which the contents page numbers are read from', () => {
    expect(importedDataPath('data/book/book-phb.json')).toBe('book/book-phb.json')
  })
})
