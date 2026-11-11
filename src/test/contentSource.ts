// A stand-in for the content source in unit tests: answers `fetch` the way the
// configured hosts and the version-check API do, from data the test supplies.

import { vi } from 'vitest'
import { contentConfig } from '../config/content'
import { contentId } from '../content/source'

export interface FakeSource {
  /** Data files by path inside the data folder. Change it to publish new content. */
  files: Record<string, unknown>
  /** The free rules the site itself hosts, by path inside its data folder. */
  freeRules: Record<string, unknown>
  /** Image files (their bytes) by path inside the image repository. */
  images: Record<string, Uint8Array<ArrayBuffer>>
  /** The commit the branch points at. */
  commit: string
  /** Hosts (by index in `contentConfig.hosts`) that fail with a network error. */
  down: Set<number>
  /** When true the version-check API answers with an error. */
  apiDown: boolean
  /** Every URL requested, in order. */
  requests: string[]
  /** The priority each URL was last requested with. */
  priorities: Map<string, RequestPriority | undefined>
  /** Requests for data files, as `ref:path`. */
  dataRequests: () => string[]
}

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))

/** The content id the fake source reports for a file. */
export function fakeContentId(value: unknown): Promise<string> {
  return contentId(encode(value))
}

/** Install a fake content source as the global `fetch`. */
export function installFakeSource(files: Record<string, unknown> = {}): FakeSource {
  const { dataRepository, imageRepository, ref } = contentConfig.source
  const source: FakeSource = {
    files,
    freeRules: {},
    images: {},
    commit: 'a'.repeat(40),
    down: new Set(),
    apiDown: false,
    requests: [],
    priorities: new Map(),
    dataRequests: () =>
      source.requests.flatMap((url) => {
        const match = /[@/]([^@/]+)\/data\/(.+)$/.exec(url)
        return match && !url.includes('api.github.com') ? [`${match[1]}:${match[2]}`] : []
      }),
  }

  const freeRulesBase = `${import.meta.env.BASE_URL}data/`

  async function respond(url: string): Promise<Response> {
    if (url.startsWith(freeRulesBase)) {
      const path = url.slice(freeRulesBase.length)
      return path in source.freeRules
        ? new Response(encode(source.freeRules[path]))
        : new Response('not found', { status: 404 })
    }

    if (url.startsWith('https://api.github.com/')) {
      if (source.apiDown) return new Response('rate limited', { status: 403 })
      if (url === contentConfig.api.commit(dataRepository, ref)) {
        return new Response(source.commit)
      }
      if (url === contentConfig.api.tree(dataRepository, source.commit)) {
        const tree = await Promise.all(
          Object.entries(source.files).map(async ([path, value]) => ({
            path: `${contentConfig.dataFolder}/${path}`,
            type: 'blob',
            sha: await fakeContentId(value),
          })),
        )
        return new Response(JSON.stringify({ truncated: false, tree }))
      }
      return new Response('not found', { status: 404 })
    }

    for (const [index, host] of contentConfig.hosts.entries()) {
      for (const pinned of [ref, source.commit]) {
        const dataBase = host(dataRepository, pinned, `${contentConfig.dataFolder}/`)
        if (url.startsWith(dataBase)) {
          if (source.down.has(index)) throw new TypeError('Failed to fetch')
          const path = url.slice(dataBase.length)
          return path in source.files
            ? new Response(encode(source.files[path]))
            : new Response('not found', { status: 404 })
        }
        const imageBase = host(imageRepository, pinned, '')
        if (url.startsWith(imageBase)) {
          if (source.down.has(index)) throw new TypeError('Failed to fetch')
          const image = source.images[url.slice(imageBase.length)]
          return image ? new Response(image) : new Response('not found', { status: 404 })
        }
      }
    }
    return new Response('not found', { status: 404 })
  }

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      source.requests.push(url)
      source.priorities.set(url, init?.priority)
      return respond(url)
    }),
  )
  return source
}

/** A minimal but complete set of the files the background download asks for. */
export function prefetchFiles(): Record<string, unknown> {
  const files: Record<string, unknown> = {}
  for (const path of contentConfig.prefetch) {
    files[path] = path.endsWith('/index.json') ? {} : { path }
  }
  files['class/index.json'] = { bard: 'class-bard.json' }
  files['class/class-bard.json'] = { class: [{ name: 'Bard', source: 'PHB' }] }
  files['spells/index.json'] = { PHB: 'spells-phb.json' }
  files['spells/spells-phb.json'] = { spell: [{ name: 'Light', source: 'PHB' }] }
  files['bestiary/index.json'] = { MM: 'bestiary-mm.json' }
  files['bestiary/bestiary-mm.json'] = { monster: [{ name: 'Wolf', source: 'MM' }] }
  return files
}
