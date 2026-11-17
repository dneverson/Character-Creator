import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contentLibrary } from '../content'
import { useContentStatus } from '../content/library'
import { fixtureDoc, fixtureSections } from '../test/bookFixture'
import { _resetIndex, currentIndex, syncIndex, useIndexStatus } from './indexState'
import { readBookText } from './load'
import { scan } from './outline'

vi.mock('../content', () => ({ contentLibrary: { has: vi.fn() } }))
vi.mock('./load', () => ({ readBookText: vi.fn() }))
const has = vi.mocked(contentLibrary.has)
const read = vi.mocked(readBookText)

const second = { ...fixtureDoc, id: 'TWO', name: 'Second' }

beforeEach(() => {
  vi.clearAllMocks()
  useContentStatus.setState({ epoch: 0 })
  _resetIndex()
  has.mockResolvedValue(true)
  read.mockResolvedValue({ sections: fixtureSections, scan: scan(fixtureSections) })
})

describe('keeping the search index up to date', () => {
  it('adds the stored documents and says how many it holds', async () => {
    await syncIndex([fixtureDoc, second])
    expect(currentIndex().has('book', 'TST')).toBe(true)
    expect(useIndexStatus.getState()).toMatchObject({
      indexed: 2,
      listed: 2,
      building: false,
    })
    expect(useIndexStatus.getState().version).toBe(2)
  })

  it('leaves out a document that is not stored, without reading it', async () => {
    has.mockImplementation((path) => Promise.resolve(path.includes('tst')))
    await syncIndex([fixtureDoc, second])
    expect(currentIndex().has('book', 'TWO')).toBe(false)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('adds only what is new when asked again', async () => {
    await syncIndex([fixtureDoc])
    await syncIndex([fixtureDoc, second])
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('leaves out a text that cannot be read, and tries it on the next pass', async () => {
    read.mockRejectedValueOnce(new Error('bad'))
    await syncIndex([fixtureDoc])
    expect(currentIndex().has('book', 'TST')).toBe(false)
    await syncIndex([fixtureDoc])
    expect(currentIndex().has('book', 'TST')).toBe(true)
  })

  it('goes round once more when asked during a pass', async () => {
    const first = syncIndex([fixtureDoc])
    const during = syncIndex([fixtureDoc, second])
    expect(during).toBe(first)
    await first
    expect(currentIndex().has('book', 'TWO')).toBe(true)
    expect(useIndexStatus.getState().building).toBe(false)
  })

  it('starts over when the content changes wholesale', async () => {
    await syncIndex([fixtureDoc])
    useContentStatus.setState({ epoch: 1 })
    has.mockResolvedValue(false)
    await syncIndex([fixtureDoc])
    expect(currentIndex().has('book', 'TST')).toBe(false)
    expect(useIndexStatus.getState().indexed).toBe(0)
  })
})
