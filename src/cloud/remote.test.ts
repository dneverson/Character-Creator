import { beforeEach, describe, expect, it } from 'vitest'
import { useCharacterStore } from '../character/store'
import { character } from '../test/cloudFixtures'
import { applyRemoteChange } from './remote'

describe('applyRemoteChange', () => {
  beforeEach(() =>
    useCharacterStore.setState({
      characters: {},
      order: [],
      activeId: null,
      view: 'list',
    }),
  )

  it('adds new characters, replaces older ones and keeps a newer edit', () => {
    const state = () => useCharacterStore.getState()
    const older = character('a', 10, [], 'Old')
    const newer = character('b', 50, [], 'Edited here')
    useCharacterStore.setState({
      characters: { a: older, b: newer },
      order: ['a', 'b'],
    })
    const replaced = character('a', 20, [], 'From cloud')
    const stale = character('b', 40, [], 'Stale')
    const added = character('c', 5)

    applyRemoteChange({ upserts: [replaced, stale, added], removedIds: [] })

    expect(state().characters.a).toBe(replaced)
    expect(state().characters.b).toBe(newer)
    expect(state().characters.c).toBe(added)
    expect(state().order).toEqual(['a', 'b', 'c'])
  })

  it('removes a character the cloud deleted, closing it if it was open', () => {
    useCharacterStore.setState({
      characters: { a: character('a', 1), b: character('b', 1) },
      order: ['a', 'b'],
      activeId: 'a',
      view: 'sheet',
    })
    applyRemoteChange({ upserts: [], removedIds: ['a'] })
    expect(Object.keys(useCharacterStore.getState().characters)).toEqual(['b'])
    expect(useCharacterStore.getState().view).toBe('list')
  })
})
