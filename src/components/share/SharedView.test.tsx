import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCharacter, historyEntry, type Character } from '../../character/model'
import { useCharacterStore } from '../../character/store'
import { loadBackgrounds } from '../../data/background'
import { loadClasses } from '../../data/class'
import { loadClassOptions } from '../../data/classOptions'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadLanguages } from '../../data/languages'
import { loadRaces } from '../../data/race'
import { useSharedStore } from '../../share/state'
import { fakeAccount } from '../../test/accountFixtures'
import { FIGHTER, ITEMS, stack } from '../../test/derivedFixtures'
import { settle } from '../../test/settle'
import { useToasts } from '../../ui/toasts'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { SharedView } from './SharedView'

vi.mock('../../data/class', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/class')>()),
  loadClasses: vi.fn(),
}))
vi.mock('../../data/background', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/background')>()),
  loadBackgrounds: vi.fn(),
}))
vi.mock('../../data/race', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/race')>()),
  loadRaces: vi.fn(),
}))
vi.mock('../../data/feats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/feats')>()),
  loadFeats: vi.fn(),
}))
vi.mock('../../data/classOptions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/classOptions')>()),
  loadClassOptions: vi.fn(),
}))
vi.mock('../../data/languages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/languages')>()),
  loadLanguages: vi.fn(),
}))
vi.mock('../../data/items', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/items')>()),
  loadItems: vi.fn(),
}))

const TOKEN = '0123456789abcdef0123456789abcdef'

/** What a link gives out: the document with no history log. */
function sharedDocument(): Partial<Character> {
  const c = createCharacter('Tordek')
  c.classes = [
    {
      name: 'Fighter',
      source: 'PHB',
      level: 3,
      subclass: { name: 'Champion', shortName: 'Champion', source: 'PHB' },
    },
  ]
  c.race = {
    name: 'Dwarf',
    baseName: 'Dwarf',
    source: 'PHB',
    abilityFixed: {},
    abilityChoices: {},
  }
  c.equipment.items = [stack('Longsword')]
  c.story.notes = 'The owner wrote this.'
  c.play = { ...c.play, conditions: ['Prone'], tempHp: 3, inspiration: true }
  c.completedAt = 5
  c.history = [historyEntry(1, { type: 'created' })]
  const { history, ...rest } = c
  void history
  return rest
}

function renderShared(account = fakeAccount()) {
  const view = render(
    <ThemeProvider>
      <SharedView account={account} token={TOKEN} />
    </ThemeProvider>,
  )
  return { account, ...view }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([FIGHTER])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadClassOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue(ITEMS)
  useToasts.setState({ toasts: [] })
  useSharedStore.setState({ token: TOKEN })
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('a shared character', () => {
  it('shows a spinner while it loads', async () => {
    const account = fakeAccount()
    vi.mocked(account.readShared).mockReturnValue(new Promise(() => {}))
    renderShared(account)
    expect(screen.getByRole('status')).toHaveTextContent('Loading the shared character')
    await settle()
  })

  it('shows the sheet with the banner, the name and no way to change it', async () => {
    const account = fakeAccount()
    vi.mocked(account.readShared).mockResolvedValue(sharedDocument())
    renderShared(account)
    expect(await screen.findByRole('heading', { name: 'Tordek' })).toBeInTheDocument()
    expect(account.readShared).toHaveBeenCalledWith(TOKEN)
    expect(screen.getByRole('region', { name: 'Shared character' })).toHaveTextContent(
      'Shared character - view only',
    )
    expect(
      screen.getByRole('button', { name: 'Save a copy to my characters' }),
    ).toBeInTheDocument()
    await screen.findByRole('group', { name: 'Hit points' })
    // Nothing that changes the character is offered.
    for (const name of [
      'Heal',
      'Damage',
      'Short rest',
      'Long rest',
      'Condition',
      'Remove Prone',
      'Raise exhaustion',
      'Lower exhaustion',
      'Edit',
      'Level up',
      'Share',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('textbox', { name: 'Temporary hit points' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Roll /i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Dice' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prone' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Inspiration/i })).toBeDisabled()
  })

  it('shows no numbers, never "Dying" or 0 hit points, until the game data is loaded', async () => {
    const account = fakeAccount()
    vi.mocked(account.readShared).mockResolvedValue(sharedDocument())
    let finish: (items: typeof ITEMS) => void = () => {}
    vi.mocked(loadItems).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderShared(account)
    expect(await screen.findByText('Loading the sheet...')).toBeInTheDocument()
    expect(screen.queryByText('Dying')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Hit points' })).not.toBeInTheDocument()
    finish(ITEMS)
    expect(await screen.findByRole('group', { name: 'Hit points' })).toBeInTheDocument()
    expect(screen.queryByText('Loading the sheet...')).not.toBeInTheDocument()
    expect(screen.queryByText('Dying')).not.toBeInTheDocument()
  })

  it('switches tabs, and shows the notes without letting them be edited', async () => {
    const account = fakeAccount()
    vi.mocked(account.readShared).mockResolvedValue(sharedDocument())
    renderShared(account)
    await userEvent.click(await screen.findByRole('tab', { name: 'Notes' }))
    const notes = await screen.findByRole('textbox', { name: 'Notes' })
    expect(notes).toHaveValue('The owner wrote this.')
    expect(notes).toHaveAttribute('readonly')
    await userEvent.type(notes, 'more')
    expect(notes).toHaveValue('The owner wrote this.')
  })

  it('shows the inventory without add, remove, coins or pins', async () => {
    const account = fakeAccount()
    vi.mocked(account.readShared).mockResolvedValue(sharedDocument())
    renderShared(account)
    await userEvent.click(await screen.findByRole('tab', { name: 'Inventory' }))
    await screen.findByText('Longsword')
    expect(screen.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sell or drop/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add to Favorites/ })).toBeNull()
    expect(screen.queryByLabelText('Coins to add or spend')).not.toBeInTheDocument()
  })

  it('shows the story tab without the editor shortcut', async () => {
    const account = fakeAccount()
    vi.mocked(account.readShared).mockResolvedValue(sharedDocument())
    renderShared(account)
    await userEvent.click(await screen.findByRole('tab', { name: 'Story' }))
    expect(await screen.findByText('Nothing is written yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit story' })).not.toBeInTheDocument()
  })

  it('keeps a copy as a new character of its own, and opens it', async () => {
    const account = fakeAccount()
    vi.mocked(account.readShared).mockResolvedValue(sharedDocument())
    renderShared(account)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Save a copy to my characters' }),
    )
    const { characters, order, activeId, view } = useCharacterStore.getState()
    expect(order).toHaveLength(1)
    const copy = characters[order[0]]
    expect(copy.name).toBe('Tordek')
    expect(copy.story.notes).toBe('The owner wrote this.')
    expect(copy.history).toHaveLength(1)
    expect(copy.history[0].action).toMatchObject({ type: 'duplicated' })
    expect(activeId).toBe(copy.id)
    expect(view).toBe('sheet')
    expect(useSharedStore.getState().token).toBeNull()
    expect(useToasts.getState().toasts.map((t) => t.message)).toContain(
      'Saved a copy to your characters',
    )
  })

  it('leaves for the list from the Characters button', async () => {
    const account = fakeAccount()
    vi.mocked(account.readShared).mockResolvedValue(sharedDocument())
    renderShared(account)
    await userEvent.click(await screen.findByRole('button', { name: 'Characters' }))
    expect(useSharedStore.getState().token).toBeNull()
    expect(useCharacterStore.getState().order).toHaveLength(0)
  })

  it('says a link that does not work may have been stopped', async () => {
    const account = fakeAccount()
    renderShared(account)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link does not work. It may have been stopped by its owner.',
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Go to my characters' }))
    expect(useSharedStore.getState().token).toBeNull()
  })

  it('offers a retry when the cloud cannot be reached', async () => {
    const account = fakeAccount()
    vi.mocked(account.readShared).mockRejectedValueOnce(new Error('offline'))
    renderShared(account)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Check your connection/)
    vi.mocked(account.readShared).mockResolvedValue(sharedDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Tordek' })).toBeInTheDocument()
    await waitFor(() => expect(account.readShared).toHaveBeenCalledTimes(2))
  })
})
