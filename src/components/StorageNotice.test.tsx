import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { storageNotKept, useStorageStatus } from '../storage/status'
import { StorageNotice } from './StorageNotice'

// Before a test renders, not after: nothing is on screen to answer the change.
beforeEach(() => useStorageStatus.setState({ persistent: true }))

describe('StorageNotice', () => {
  it('shows nothing while the browser keeps what the user does', () => {
    const { container } = render(<StorageNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says the characters are not being saved, and how to keep them', () => {
    render(<StorageNotice />)
    act(() => storageNotKept())
    expect(screen.getByRole('alert')).toHaveTextContent(/not saving your characters/)
    expect(screen.getByRole('alert')).toHaveTextContent(/Use Export/)
  })
})
