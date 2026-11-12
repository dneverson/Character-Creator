import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCharacter } from '../../character/model'
import { useCharacterStore } from '../../character/store'
import type { Checklist } from '../../derived/checklist'
import { FinishBuild } from './FinishBuild'

const done: Checklist = { items: [], status: {} }

function seed() {
  const c = createCharacter('Tordek')
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c.id
}

beforeEach(() => {
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('FinishBuild', () => {
  it('is off while the checklist is still being worked out', () => {
    seed()
    render(<FinishBuild checklist={undefined} onJump={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
  })

  it('finishes straight away when nothing is open', async () => {
    const id = seed()
    render(<FinishBuild checklist={done} onJump={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useCharacterStore.getState().characters[id].completedAt).toBeTypeOf('number')
    expect(useCharacterStore.getState().view).toBe('sheet')
  })

  it('follows a link to the section once the window has closed', async () => {
    seed()
    const onJump = vi.fn()
    const checklist: Checklist = {
      items: [
        { id: 'spells', section: 'spells', count: 2, label: '2 cantrips not chosen' },
      ],
      status: { spells: 'open' },
    }
    render(<FinishBuild checklist={checklist} onJump={onJump} />)
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Spells: 2 cantrips not chosen' }),
    )
    await vi.waitFor(() => expect(onJump).toHaveBeenCalledWith('spells'))
    expect(useCharacterStore.getState().view).toBe('editor')
  })
})
