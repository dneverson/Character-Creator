import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contentConfig } from '../config/content'
import { memoryStore, type KeyValueStore } from '../storage/keyValue'
import { installFakeSource, type FakeSource } from '../test/contentSource'
import {
  coverPaths,
  coverUrls,
  createCoverLibrary,
  importedCoverPath,
  type CoverLibrary,
} from './covers'
import { useContentSettings } from './settings'

const PHB = 'covers/PHB.webp'
const MM = 'covers/MM.webp'
const { imageRepository, ref } = contentConfig.source

let source: FakeSource
let thumbs: KeyValueStore<Blob>
let shrink: ReturnType<typeof vi.fn<(image: Blob, width: number) => Promise<Blob>>>
let covers: CoverLibrary
let objectUrls: Blob[]

/** A library over the same store, as a later visit would create. */
function reopen(): CoverLibrary {
  return createCoverLibrary({ thumbs, shrink })
}

function pickedFile(path: string): File {
  const file = new File(['image'], path.split('/').pop() as string)
  Object.defineProperty(file, 'webkitRelativePath', { value: path })
  return file
}

beforeEach(() => {
  useContentSettings.setState({ source: { ...contentConfig.source } })
  source = installFakeSource()
  source.images[PHB] = new Uint8Array([1, 2, 3])
  source.images[MM] = new Uint8Array([4, 5, 6, 7])
  thumbs = memoryStore()
  shrink = vi.fn((image: Blob, width: number) =>
    Promise.resolve(new Blob([`thumb of ${image.size} bytes at ${width}`])),
  )
  objectUrls = []
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn((object: Blob | MediaSource) => {
    objectUrls.push(object as Blob)
    return `blob:thumb-${objectUrls.length}`
  })
  URL.revokeObjectURL = vi.fn()
  covers = reopen()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('coverUrls', () => {
  it('gives the full image on every host, in the order to try them', () => {
    expect(coverUrls(PHB)).toEqual(
      contentConfig.hosts.map((host) => host(imageRepository, ref, PHB)),
    )
  })

  it('follows the source the visitor chose', () => {
    useContentSettings.setState({
      source: { ...contentConfig.source, imageRepository: 'someone/images', ref: 'v2' },
    })
    expect(coverUrls(PHB)[0]).toBe(contentConfig.hosts[0]('someone/images', 'v2', PHB))
  })
})

describe('coverPaths', () => {
  it('lists each internal cover once', () => {
    const file = {
      book: [
        { name: 'A', cover: { type: 'internal', path: PHB } },
        { name: 'B', cover: { type: 'internal', path: PHB } },
        { name: 'C', cover: { type: 'internal', path: MM } },
        { name: 'D', cover: { type: 'external', path: 'https://x/y.webp' } },
        { name: 'E', cover: { type: 'internal', path: '' } },
        { name: 'F' },
        null,
      ],
    }
    expect(coverPaths(file)).toEqual([PHB, MM])
  })

  it('is empty for anything that is not a books file', () => {
    expect(coverPaths(null)).toEqual([])
    expect(coverPaths({ book: 'nope' })).toEqual([])
    expect(coverPaths({ path: 'books.json' })).toEqual([])
  })
})

describe('importedCoverPath', () => {
  it('reads the path from the covers folder onwards', () => {
    expect(importedCoverPath('5etools-img/covers/PHB.webp')).toBe(PHB)
    expect(importedCoverPath('covers/MM.webp')).toBe(MM)
  })

  it('leaves out everything else', () => {
    expect(importedCoverPath('5etools-img/covers/blurred/PHB.webp')).toBeNull()
    expect(importedCoverPath('5etools-img/bestiary/MM/Wolf.webp')).toBeNull()
    expect(importedCoverPath('data/books.json')).toBeNull()
  })
})

describe('loading a thumbnail', () => {
  it('makes it from the full image, stores it and answers with its URL', async () => {
    const url = await covers.load(PHB)

    expect(url).toBe('blob:thumb-1')
    expect(source.requests).toEqual([coverUrls(PHB)[0]])
    expect(source.priorities.get(coverUrls(PHB)[0])).toBe('high')
    expect(shrink).toHaveBeenCalledTimes(1)
    expect(shrink.mock.calls[0][0].size).toBe(3)
    expect(shrink.mock.calls[0][1]).toBe(contentConfig.coverThumbWidth)
    expect(await thumbs.get(PHB)).toBe(objectUrls[0])
  })

  it('answers at once for a thumbnail already loaded on this page', async () => {
    expect(covers.peek(PHB)).toBeUndefined()
    const url = await covers.load(PHB)
    source.requests.length = 0

    expect(covers.peek(PHB)).toBe(url)
    expect(await covers.load(PHB)).toBe(url)
    expect(source.requests).toEqual([])
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('shares one download between callers asking at the same time', async () => {
    const [first, second] = await Promise.all([covers.load(PHB), covers.load(PHB)])
    expect(first).toBe(second)
    expect(source.requests).toHaveLength(1)
  })

  it('reads a stored thumbnail on a later visit without asking the source', async () => {
    await covers.load(PHB)
    source.requests.length = 0
    shrink.mockClear()

    expect(await reopen().load(PHB)).toBe('blob:thumb-2')
    expect(source.requests).toEqual([])
    expect(shrink).not.toHaveBeenCalled()
  })

  it('falls back to the next host', async () => {
    source.down.add(0)
    await covers.load(PHB)
    expect(source.requests).toEqual(coverUrls(PHB))
  })

  it('fails for a cover the source does not have, and stores nothing', async () => {
    await expect(covers.load('covers/NOPE.webp')).rejects.toThrow('does not exist')
    expect(await thumbs.keys()).toEqual([])
    expect(covers.peek('covers/NOPE.webp')).toBeUndefined()
  })

  it('answers with the full image where the browser cannot make thumbnails', async () => {
    shrink.mockRejectedValue(new Error('no canvas'))
    expect(await covers.load(PHB)).toBe(coverUrls(PHB)[0])
    expect(await thumbs.keys()).toEqual([])
  })
})

describe('prefetching thumbnails', () => {
  it('makes the ones not stored yet, in the background', async () => {
    await covers.load(PHB)
    source.requests.length = 0

    await covers.prefetch([PHB, MM, 'covers/NOPE.webp'])

    expect(await thumbs.keys()).toEqual([PHB, MM])
    expect(source.requests).not.toContain(coverUrls(PHB)[0])
    expect(source.priorities.get(coverUrls(MM)[0])).toBe('low')
  })

  it('stops when told to, keeping what is stored', async () => {
    await covers.load(PHB)
    const running = covers.prefetch([MM])
    covers.stop()
    await running

    expect(await thumbs.keys()).toEqual([PHB])
  })
})

describe('importing covers from a picked folder', () => {
  it('stores a thumbnail for each cover image and reports how many', async () => {
    const count = await covers.importFiles([
      pickedFile('5etools-img/covers/PHB.webp'),
      pickedFile('5etools-img/covers/MM.webp'),
      pickedFile('5etools-img/bestiary/MM/Wolf.webp'),
      pickedFile('data/books.json'),
    ])

    expect(count).toBe(2)
    expect(await thumbs.keys()).toEqual([PHB, MM])
    expect(source.requests).toEqual([])
    // The imported thumbnail is what a later load shows.
    await covers.load(PHB)
    expect(source.requests).toEqual([])
  })

  it('leaves out an image that cannot be read', async () => {
    shrink.mockRejectedValueOnce(new Error('not an image'))
    const count = await covers.importFiles([
      pickedFile('covers/PHB.webp'),
      pickedFile('covers/MM.webp'),
    ])
    expect(count).toBe(1)
    expect(await thumbs.keys()).toEqual([MM])
  })

  it('reads the path from the file name when the browser gives no folder path', async () => {
    const loose = new File(['image'], 'PHB.webp')
    expect(await covers.importFiles([loose])).toBe(0)
  })
})

describe('clearing the covers', () => {
  it('deletes the stored thumbnails and releases their URLs', async () => {
    const url = await covers.load(PHB)
    await covers.clear()

    expect(await thumbs.keys()).toEqual([])
    expect(covers.peek(PHB)).toBeUndefined()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
  })

  it('does not keep a thumbnail that was still being made', async () => {
    let release!: () => void
    shrink.mockImplementationOnce(
      (image) =>
        new Promise((resolve) => {
          release = () => resolve(new Blob([`late thumb of ${image.size}`]))
        }),
    )
    const loading = covers.load(PHB)
    await vi.waitFor(() => expect(shrink).toHaveBeenCalled())
    await covers.clear()
    release()

    // Whoever asked still gets something to show.
    expect(await loading).toBe('blob:thumb-1')
    expect(await thumbs.keys()).toEqual([])
    expect(covers.peek(PHB)).toBeUndefined()
  })
})
