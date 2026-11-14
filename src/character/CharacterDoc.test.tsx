import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { CoinPurse } from '../components/editor/InventoryTotals'
import { NotesPanel } from '../components/sheet/NotesPanel'
import { DraftCharacterProvider } from './CharacterDoc'
import { createCharacter } from './model'
import { useCharacterStore } from './store'
import { useCharacter } from './useCharacterDoc'

function DraftGold() {
  return <output aria-label="Draft gold">{useCharacter()?.equipment.currency.gp}</output>
}

function seedStore() {
  const stored = createCharacter('Stored')
  useCharacterStore.setState({
    characters: { [stored.id]: stored },
    order: [stored.id],
    activeId: stored.id,
    view: 'editor',
  })
  return stored
}

beforeEach(() => {
  useCharacterStore.setState({
    characters: {},
    order: [],
    activeId: null,
    view: 'list',
  })
})

describe('the character document', () => {
  it('reads and writes the store character when no provider is given', async () => {
    const stored = seedStore()
    render(<NotesPanel />)
    const notes = screen.getByLabelText('Notes')
    await userEvent.type(notes, 'In the store')
    await userEvent.tab()
    await waitFor(() =>
      expect(useCharacterStore.getState().characters[stored.id].story.notes).toBe(
        'In the store',
      ),
    )
  })

  it('shows the draft and sends writes to the draft, not to the store', async () => {
    const stored = seedStore()
    const draft = createCharacter('Draft')
    draft.story = { ...draft.story, notes: 'Draft notes' }
    const before = useCharacterStore.getState().characters[stored.id]
    render(
      <DraftCharacterProvider initial={draft}>
        <NotesPanel />
        <CoinPurse currency={draft.equipment.currency} />
        <DraftGold />
      </DraftCharacterProvider>,
    )
    const notes = screen.getByLabelText('Notes')
    expect(notes).toHaveValue('Draft notes')

    await userEvent.type(notes, ' and more')
    await userEvent.tab()
    await waitFor(() => expect(notes).toHaveValue('Draft notes and more'))

    // The coin purse writes through the latest-state path used by batched edits.
    const gold = screen.getByLabelText('Gold pieces')
    await userEvent.clear(gold)
    await userEvent.type(gold, '7')
    await userEvent.tab()
    await waitFor(() =>
      expect(screen.getByLabelText('Draft gold')).toHaveTextContent('7'),
    )

    expect(useCharacterStore.getState().characters[stored.id]).toBe(before)
    expect(useCharacterStore.getState().characters[stored.id].story.notes).toBe('')
    expect(useCharacterStore.getState().characters[stored.id].equipment.currency.gp).toBe(
      before.equipment.currency.gp,
    )
  })
})
