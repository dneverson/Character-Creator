import { beforeEach, describe, expect, it } from 'vitest'
import { dismissToast, showToast, useToasts } from './toasts'

beforeEach(() => useToasts.setState({ toasts: [] }))

describe('toasts', () => {
  it('keeps each message, in order, until it is dismissed', () => {
    showToast('One')
    showToast('Two')
    const [one, two] = useToasts.getState().toasts
    expect([one.message, two.message]).toEqual(['One', 'Two'])
    expect(one.id).not.toBe(two.id)
    dismissToast(one.id)
    expect(useToasts.getState().toasts.map((t) => t.message)).toEqual(['Two'])
  })
})
