import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createContentLibrary,
  useContentStatus,
  type ContentLibrary,
} from '../content/library'
import { useContentSettings } from '../content/settings'
import { memoryStore } from '../storage/keyValue'
import { installFakeSource, type FakeSource } from '../test/contentSource'
import { _clearDataCache, dataUrl, fetchData, fetchDataUncached } from './dataClient'

// Each test gets its own content library, so nothing stored or learned about the
// source in one test reaches the next.
const current = vi.hoisted(() => ({ library: undefined as ContentLibrary | undefined }))
vi.mock('../content', () => ({
  contentLibrary: { read: (path: string) => current.library!.read(path) },
}))

let source: FakeSource

/** Requests that went to the content source rather than to the site itself. */
function sourceRequests(): string[] {
  return source.requests.filter((url) => url.startsWith('https://'))
}

beforeEach(() => {
  _clearDataCache()
  source = installFakeSource()
  current.library = createContentLibrary({ files: memoryStore(), record: memoryStore() })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('dataUrl', () => {
  it('builds a base-relative data URL and trims leading slashes', () => {
    // BASE_URL is "/" under Vitest.
    expect(dataUrl('books.json')).toBe('/data/books.json')
    expect(dataUrl('/class/index.json')).toBe('/data/class/index.json')
  })
})

describe('fetchData with the free rules only', () => {
  it('fetches and parses JSON from the site', async () => {
    source.freeRules['books.json'] = { book: [] }
    source.files['books.json'] = { book: [{ name: 'full' }] }

    const data = await fetchData<{ book: unknown[] }>('/books.json')
    expect(data).toEqual({ book: [] })
    expect(source.requests).toEqual(['/data/books.json'])
  })

  it('deduplicates concurrent requests for the same file', async () => {
    source.freeRules['feats.json'] = { ok: 1 }
    await Promise.all([fetchData('feats.json'), fetchData('feats.json')])
    expect(source.requests).toHaveLength(1)
  })

  it('throws and does not cache on HTTP error', async () => {
    await expect(fetchData('missing.json')).rejects.toThrow('HTTP 404')

    // A second call retries (failure was not cached).
    source.freeRules['missing.json'] = { recovered: true }
    await expect(fetchData('missing.json')).resolves.toEqual({ recovered: true })
  })
})

describe('fetchDataUncached', () => {
  it('reads the file afresh each time, from the same place as fetchData', async () => {
    source.freeRules['book/book-phb.json'] = { data: [] }

    expect(await fetchDataUncached('/book/book-phb.json')).toEqual({ data: [] })
    expect(await fetchDataUncached('book/book-phb.json')).toEqual({ data: [] })
    expect(source.requests).toEqual([
      '/data/book/book-phb.json',
      '/data/book/book-phb.json',
    ])
  })

  it('prefers the full content when it is switched on', async () => {
    useContentSettings.setState({ fullContent: true })
    source.freeRules['book/book-phb.json'] = { data: ['free'] }
    source.files['book/book-phb.json'] = { data: ['full'] }

    expect(await fetchDataUncached('book/book-phb.json')).toEqual({ data: ['full'] })
  })
})

describe('fetchData with the full content switched on', () => {
  beforeEach(() => {
    useContentSettings.setState({ fullContent: true })
    source.freeRules['books.json'] = { book: ['free'] }
    source.files['books.json'] = { book: ['free', 'full'] }
  })

  it('answers from the full content without asking the site', async () => {
    expect(await fetchData('books.json')).toEqual({ book: ['free', 'full'] })
    expect(source.requests.every((url) => url.startsWith('https://'))).toBe(true)
  })

  it('answers a file the full content does not have from the free rules', async () => {
    delete source.files['books.json']
    expect(await fetchData('books.json')).toEqual({ book: ['free'] })
    expect(useContentStatus.getState().unreachable).toBe(false)
  })

  it('answers from the free rules when the source cannot be reached', async () => {
    source.down.add(0).add(1)
    expect(await fetchData('books.json')).toEqual({ book: ['free'] })
    expect(useContentStatus.getState().unreachable).toBe(true)
  })

  it('fails when neither has the file', async () => {
    await expect(fetchData('nowhere.json')).rejects.toThrow('HTTP 404')
  })

  it('forgets what it loaded when the content changes wholesale', async () => {
    expect(await fetchData('books.json')).toEqual({ book: ['free', 'full'] })
    source.requests.length = 0

    // Still held: no further request.
    await fetchData('books.json')
    expect(source.requests).toEqual([])

    current.library!.disable()
    expect(await fetchData('books.json')).toEqual({ book: ['free'] })
    expect(sourceRequests()).toEqual([])
  })
})
