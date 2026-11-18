import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContentSettings } from '../content/settings'
import { fixtureSections } from '../test/bookFixture'
import {
  answer,
  openDocReader,
  readDocTokens,
  transferOf,
  type DocAnswer,
  type DocRequest,
  type WorkerPort,
} from './docReader'
import { storedMisses } from '../data/dataClient'
import { readBookText } from './load'
import { scan } from './outline'
import { tokenize } from './tokenize'

vi.mock('./load', () => ({ readBookText: vi.fn() }))
vi.mock('../data/dataClient', () => ({ storedMisses: vi.fn() }))
const misses = vi.mocked(storedMisses)
const read = vi.mocked(readBookText)

beforeEach(() => {
  vi.clearAllMocks()
  misses.mockReturnValue(0)
  read.mockResolvedValue({ sections: fixtureSections, scan: scan(fixtureSections) })
})

/** A worker that answers each request with what `reply` makes of it. */
function fakeWorker(reply: (request: DocRequest) => DocAnswer | undefined) {
  const port: WorkerPort & { requests: DocRequest[] } = {
    requests: [],
    onmessage: null,
    onerror: null,
    terminate: vi.fn(),
    postMessage(request) {
      port.requests.push(request)
      const data = reply(request)
      if (data)
        queueMicrotask(() => port.onmessage?.({ data } as MessageEvent<DocAnswer>))
    },
  }
  return port
}

describe('reading a document on this thread', () => {
  it('gives its words', async () => {
    const tokens = await readDocTokens('book', 'TST')
    expect(tokens.texts).toEqual(tokenize(scan(fixtureSections)).texts)
  })

  it('is what a reader does when there is no worker', async () => {
    const reader = openDocReader(3, () => undefined)
    expect((await reader.read('book', 'TST')).words).toContain('lantern')
    expect(reader.close()).toBeUndefined()
  })
})

describe('the worker side', () => {
  it('answers with the words and says which buffers it hands over', async () => {
    const reply = await answer({ n: 4, kind: 'book', id: 'TST', fullContent: true })
    expect(reply).toMatchObject({ n: 4 })
    const [offsets, ids] = transferOf(reply)
    expect(offsets.byteLength).toBeGreaterThan(0)
    expect(ids.byteLength).toBeGreaterThan(0)
  })

  it('carries the visitor choice about the full content', async () => {
    await answer({ n: 0, kind: 'book', id: 'TST', fullContent: false })
    expect(useContentSettings.getState().fullContent).toBe(false)
    await answer({ n: 1, kind: 'book', id: 'TST', fullContent: true })
    expect(useContentSettings.getState().fullContent).toBe(true)
  })

  it('leaves a document that needed a file the page has not stored to the page', async () => {
    misses.mockReturnValueOnce(0).mockReturnValueOnce(1)
    const reply = await answer({ n: 3, kind: 'book', id: 'TST', fullContent: true })
    expect(reply).toEqual({ n: 3, failed: true })
  })

  it('answers that a document could not be read, handing nothing over', async () => {
    read.mockRejectedValue(new Error('no'))
    const reply = await answer({ n: 2, kind: 'book', id: 'X', fullContent: true })
    expect(reply).toEqual({ n: 2, failed: true })
    expect(transferOf(reply)).toEqual([])
  })
})

describe('reading through a worker', () => {
  it('pairs each answer with its request', async () => {
    const tokens = tokenize(scan(fixtureSections))
    const port = fakeWorker((request) => ({ n: request.n, tokens }))
    const reader = openDocReader(1, () => port)
    const [a, b] = await Promise.all([reader.read('book', 'A'), reader.read('book', 'B')])
    expect(a).toBe(tokens)
    expect(b).toBe(tokens)
    expect(port.requests.map(({ n, id }) => [n, id])).toEqual([
      [0, 'A'],
      [1, 'B'],
    ])
    expect(typeof port.requests[0].fullContent).toBe('boolean')
    reader.close()
    expect(port.terminate).toHaveBeenCalled()
  })

  it('reads on this thread a document the worker could not read', async () => {
    const port = fakeWorker((request) => ({ n: request.n, failed: true }))
    const tokens = await openDocReader(1, () => port).read('book', 'A')
    expect(tokens.words).toContain('lantern')
    expect(read).toHaveBeenCalledWith('book', 'A')
  })

  it('rejects a document neither the worker nor this thread can read', async () => {
    read.mockRejectedValue(new Error('no'))
    const port = fakeWorker((request) => ({ n: request.n, failed: true }))
    await expect(openDocReader(1, () => port).read('book', 'A')).rejects.toThrow('no')
  })

  it('reads on this thread what is waiting when the worker stops', async () => {
    const port = fakeWorker(() => undefined)
    const waiting = openDocReader(1, () => port).read('book', 'A')
    port.onerror?.(new Event('error') as ErrorEvent)
    expect((await waiting).words).toContain('lantern')
  })

  it('gives each document to the worker with the least to do', async () => {
    const tokens = tokenize(scan(fixtureSections))
    const ports = [fakeWorker(() => undefined), fakeWorker((r) => ({ n: r.n, tokens }))]
    const spawn = () => ports.shift() ?? undefined
    const all = [...ports]
    const reader = openDocReader(2, spawn)
    expect(reader.parallel).toBe(2)
    const first = reader.read('book', 'A')
    const second = reader.read('book', 'B')
    void reader.read('book', 'C')
    expect(all.map((port) => port.requests.map(({ id }) => id))).toEqual([
      ['A', 'C'],
      ['B'],
    ])
    expect(await second).toBe(tokens)
    // One worker stopping leaves what the other is doing alone.
    all[0].onerror?.(new Event('error') as ErrorEvent)
    expect((await first).words).toContain('lantern')
    reader.close()
    expect(all.every((port) => vi.mocked(port.terminate).mock.calls.length === 1)).toBe(
      true,
    )
  })

  it('ignores an answer nobody waits for', () => {
    const port = fakeWorker(() => undefined)
    openDocReader(1, () => port)
    expect(() =>
      port.onmessage?.({ data: { n: 9, failed: true } } as MessageEvent<DocAnswer>),
    ).not.toThrow()
  })
})
