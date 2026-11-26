import { describe, expect, it } from 'vitest'
import { createCharacter, historyEntry } from '../character/model'
import { copyOfShared } from './copy'
import { isShareToken, shareLink, sharedHash } from './link'

const token = '0123456789abcdef0123456789abcdef'

describe('the share link', () => {
  it('is the site address, the hash route and the token', () => {
    expect(shareLink('https://site.test', '/app/', token)).toBe(
      `https://site.test/app/#/shared/${token}`,
    )
    expect(sharedHash(token)).toBe(`#/shared/${token}`)
  })

  it('knows a token by its shape: 32 lowercase hexadecimal digits', () => {
    expect(isShareToken(token)).toBe(true)
    expect(isShareToken(token.slice(1))).toBe(false)
    expect(isShareToken(`${token}0`)).toBe(false)
    expect(isShareToken(token.toUpperCase())).toBe(false)
    expect(isShareToken('g'.repeat(32))).toBe(false)
  })
})

describe('the copy of a shared character', () => {
  it('is a new character with a fresh id, times and a history of its own', () => {
    const shared = {
      ...createCharacter('Tordek'),
      id: 'owners-id',
      history: [historyEntry(1, { type: 'created' }), historyEntry(2)],
    }
    const copy = copyOfShared(shared, 500)
    expect(copy.id).not.toBe('owners-id')
    expect(copy.name).toBe('Tordek')
    expect(copy.createdAt).toBe(500)
    expect(copy.updatedAt).toBe(500)
    expect(copy.history).toHaveLength(1)
    expect(copy.history[0]).toMatchObject({
      at: 500,
      by: 'device',
      action: { type: 'duplicated', from: 'owners-id' },
    })
    // The shared character itself is untouched.
    expect(shared.history).toHaveLength(2)
  })
})
