import { describe, expect, it, vi } from 'vitest'
import { character, memoryCharacters } from '../test/cloudFixtures'
import { cloudCharacterStorage } from './cloudStorage'

describe('cloudCharacterStorage', () => {
  it('stores on the device first, then tells the sync', async () => {
    const device = memoryCharacters([character('old', 1)])
    const sync = { noteSave: vi.fn(), noteRemove: vi.fn() }
    const storage = cloudCharacterStorage(device.storage, sync)
    const mine = character('a', 5)

    expect(await storage.loadAll()).toEqual([device.records.get('old')])
    await storage.save(mine)
    await storage.remove('old')

    expect(device.records.get('a')).toBe(mine)
    expect(device.records.has('old')).toBe(false)
    expect(sync.noteSave).toHaveBeenCalledWith(mine)
    expect(sync.noteRemove).toHaveBeenCalledWith('old')
  })

  it('does not tell the sync of a save the device refused', async () => {
    const device = memoryCharacters()
    device.storage.save.mockRejectedValueOnce(new Error('full'))
    const sync = { noteSave: vi.fn(), noteRemove: vi.fn() }
    await expect(
      cloudCharacterStorage(device.storage, sync).save(character('a', 1)),
    ).rejects.toThrow()
    expect(sync.noteSave).not.toHaveBeenCalled()
  })
})
