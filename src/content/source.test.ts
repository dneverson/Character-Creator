import { afterEach, describe, expect, it, vi } from 'vitest'
import { contentConfig } from '../config/content'
import {
  SourceError,
  commitFiles,
  contentId,
  fetchFromSource,
  latestCommit,
} from './source'

const REPO = contentConfig.source.dataRepository

function stubFetch(
  answer: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve().then(() => answer(String(input), init)),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchFromSource', () => {
  it('asks the first host with the given priority', async () => {
    const mock = stubFetch(() => new Response('ok'))
    const response = await fetchFromSource(REPO, 'main', 'data/books.json', 'high')
    expect(await response.text()).toBe('ok')
    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock).toHaveBeenCalledWith(
      contentConfig.hosts[0](REPO, 'main', 'data/books.json'),
      { priority: 'high' },
    )
  })

  it('falls through to the next host on an error status or a network failure', async () => {
    for (const failure of [
      () => new Response('busy', { status: 503 }),
      () => {
        throw new TypeError('Failed to fetch')
      },
    ]) {
      const mock = stubFetch((url) =>
        url.startsWith('https://cdn.jsdelivr.net/') ? failure() : new Response('ok'),
      )
      const response = await fetchFromSource(REPO, 'main', 'data/books.json', 'low')
      expect(await response.text()).toBe('ok')
      expect(mock).toHaveBeenCalledTimes(2)
    }
  })

  it('reports a file as missing only when every host says not found', async () => {
    stubFetch(() => new Response('', { status: 404 }))
    const missing = await fetchFromSource(REPO, 'main', 'data/x.json', 'low').catch(
      (e: unknown) => e,
    )
    expect(missing).toBeInstanceOf(SourceError)
    expect((missing as SourceError).missing).toBe(true)

    stubFetch((url) =>
      url.startsWith('https://cdn.jsdelivr.net/')
        ? new Response('', { status: 404 })
        : new Response('', { status: 500 }),
    )
    const failed = await fetchFromSource(REPO, 'main', 'data/x.json', 'low').catch(
      (e: unknown) => e,
    )
    expect((failed as SourceError).missing).toBe(false)
  })
})

describe('latestCommit', () => {
  it('returns the commit id', async () => {
    const id = 'c'.repeat(40)
    const mock = stubFetch(() => new Response(`${id}\n`))
    expect(await latestCommit(REPO, 'main')).toBe(id)
    expect(mock).toHaveBeenCalledWith(contentConfig.api.commit(REPO, 'main'), {
      headers: { Accept: 'application/vnd.github.sha' },
      priority: 'low',
    })
  })

  it('returns null for anything that is not a commit id', async () => {
    stubFetch(() => new Response('{"message":"Not Found"}'))
    expect(await latestCommit(REPO, 'main')).toBeNull()
  })

  it('returns null on an error status or a network failure', async () => {
    stubFetch(() => new Response('', { status: 403 }))
    expect(await latestCommit(REPO, 'main')).toBeNull()
    stubFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    expect(await latestCommit(REPO, 'main')).toBeNull()
  })
})

describe('commitFiles', () => {
  const tree = (extra: object = {}) =>
    new Response(
      JSON.stringify({
        tree: [
          { path: 'data', type: 'tree', sha: 't1' },
          { path: 'data/books.json', type: 'blob', sha: 's1' },
          { path: 'data/class/class-bard.json', type: 'blob', sha: 's2' },
          { path: 'js/render.js', type: 'blob', sha: 's3' },
        ],
        ...extra,
      }),
    )

  it('maps each data file to its content id, by path inside the data folder', async () => {
    stubFetch(() => tree())
    const files = await commitFiles(REPO, 'c'.repeat(40))
    expect(files && [...files]).toEqual([
      ['books.json', 's1'],
      ['class/class-bard.json', 's2'],
    ])
  })

  it('returns null when the listing is cut short or malformed', async () => {
    stubFetch(() => tree({ truncated: true }))
    expect(await commitFiles(REPO, 'c'.repeat(40))).toBeNull()
    stubFetch(() => new Response('{}'))
    expect(await commitFiles(REPO, 'c'.repeat(40))).toBeNull()
  })

  it('returns null on an error status or a network failure', async () => {
    stubFetch(() => new Response('', { status: 500 }))
    expect(await commitFiles(REPO, 'c'.repeat(40))).toBeNull()
    stubFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    expect(await commitFiles(REPO, 'c'.repeat(40))).toBeNull()
  })
})

describe('contentId', () => {
  it('matches the id git gives the same bytes', async () => {
    // `git hash-object` of an empty file, and of a file holding "hello\n".
    expect(await contentId(new Uint8Array())).toBe(
      'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
    )
    expect(await contentId(new TextEncoder().encode('hello\n'))).toBe(
      'ce013625030ba8dba906f756967f9e9ca394464a',
    )
  })
})
