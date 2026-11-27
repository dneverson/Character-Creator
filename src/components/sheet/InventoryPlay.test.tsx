import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetView } from './SheetView'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadClasses } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadSpells } from '../../data/spells'
import { loadBeasts } from '../../data/beasts'
import { loadClassOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { FIGHTER, ITEMS, stack } from '../../test/derivedFixtures'
import { makeItem } from '../../test/itemFixtures'

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
vi.mock('../../data/spells', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/spells')>()),
  loadSpells: vi.fn(),
}))
vi.mock('../../data/beasts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/beasts')>()),
  loadBeasts: vi.fn(),
}))

const rope = makeItem({ name: 'Rope', value: 100, weight: 10 })
const gem = makeItem({ name: 'Ruby', kind: 'treasure', value: 5000 })

function seed(gp: number) {
  const c = createCharacter('Tordek')
  c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
  c.abilities = { ...c.abilities, str: { base: 16, other: 0 } }
  c.equipment.items = [
    stack('Longsword'),
    stack('Rope', { equipped: false, quantity: 2 }),
  ]
  c.equipment.currency = { pp: 0, gp, ep: 0, sp: 0, cp: 0 }
  c.completedAt = Date.now()
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
  })
  return c
}

const active = (id: string) => useCharacterStore.getState().characters[id]
const lastAction = (id: string) => active(id).history.at(-1)?.action

async function openInventory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('tab', { name: 'Inventory' }))
  const panel = screen.getByRole('tabpanel')
  await within(panel).findByRole('table', { name: 'Items' })
  return panel
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
  vi.mocked(loadItems).mockResolvedValue([...ITEMS, rope, gem])
  vi.mocked(loadSpells).mockResolvedValue([])
  vi.mocked(loadBeasts).mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

function renderSheet() {
  return render(
    <ThemeProvider>
      <SheetView />
    </ThemeProvider>,
  )
}

describe('the purse in play', () => {
  it('adds coins, spends them with change, and records both', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed(10)
    renderSheet()
    const panel = await openInventory(user)
    const amount = within(panel).getByLabelText('Coins to add or spend')
    await user.clear(amount)
    await user.type(amount, '5')
    await user.click(within(panel).getByRole('button', { name: 'Add coins' }))
    await waitFor(() => expect(active(c.id).equipment.currency.gp).toBe(15))
    expect(lastAction(c.id)).toMatchObject({
      type: 'inventory',
      change: 'coins',
      item: 'gp',
    })
    await user.click(within(panel).getByRole('button', { name: 'Spend coins' }))
    await waitFor(() => expect(active(c.id).equipment.currency.gp).toBe(10))
    const change = active(c.id)
      .history.at(-1)
      ?.changes.map((x) => x.path.join('.'))
    expect(change).toContain('equipment.currency.gp')
  })

  it('flags a spend the purse cannot meet and still empties the purse', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed(3)
    renderSheet()
    const panel = await openInventory(user)
    const amount = within(panel).getByLabelText('Coins to add or spend')
    await user.clear(amount)
    await user.type(amount, '10')
    expect(within(panel).getByText('Not enough coin')).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Spend coins' }))
    await waitFor(() => expect(active(c.id).equipment.currency.gp).toBe(0))
    expect(lastAction(c.id)).toMatchObject({ change: 'coins', short: 700 })
  })

  it('changes coins of one kind for another', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed(0)
    useCharacterStore.getState().updateActive({
      equipment: {
        ...active(c.id).equipment,
        currency: { pp: 0, gp: 0, ep: 0, sp: 25, cp: 0 },
      },
    })
    renderSheet()
    const panel = await openInventory(user)
    await user.clear(within(panel).getByLabelText('Coins to change'))
    await user.type(within(panel).getByLabelText('Coins to change'), '25')
    await user.click(within(panel).getByRole('button', { name: 'Change coins' }))
    await waitFor(() =>
      expect(active(c.id).equipment.currency).toMatchObject({ sp: 5, gp: 2 }),
    )
  })

  it('records a count typed into the purse as a play change', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed(1)
    renderSheet()
    const panel = await openInventory(user)
    const gold = within(panel).getByLabelText('Gold pieces')
    await user.clear(gold)
    await user.type(gold, '8{Enter}')
    await waitFor(() => expect(active(c.id).equipment.currency.gp).toBe(8))
    expect(lastAction(c.id)).toMatchObject({ type: 'inventory', change: 'coins' })
  })
})

describe('items in play', () => {
  it('adds an item for nothing, and buys one with the purse', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed(5)
    renderSheet()
    const panel = await openInventory(user)
    await user.click(within(panel).getByRole('button', { name: 'Add item' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('table', { name: 'Items' })
    await user.click(await within(dialog).findByRole('button', { name: 'Add Ruby' }))
    await waitFor(() =>
      expect(active(c.id).equipment.items.map((s) => s.name)).toContain('Ruby'),
    )
    expect(active(c.id).equipment.currency.gp).toBe(5)
    expect(lastAction(c.id)).toMatchObject({ change: 'add', item: 'Ruby' })

    await user.click(within(dialog).getByRole('button', { name: /^Buy: pay/ }))
    await user.click(await within(dialog).findByRole('button', { name: 'Buy Rope' }))
    await waitFor(() =>
      expect(active(c.id).equipment.items.find((s) => s.name === 'Rope')?.quantity).toBe(
        3,
      ),
    )
    expect(active(c.id).equipment.currency.gp).toBe(4)
    expect(lastAction(c.id)).toMatchObject({ change: 'buy', item: 'Rope', price: 100 })
  })

  it('flags a purchase the purse is short for, and takes what it has', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed(0)
    renderSheet()
    const panel = await openInventory(user)
    await user.click(within(panel).getByRole('button', { name: 'Add item' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^Buy: pay/ }))
    await user.click(await within(dialog).findByRole('button', { name: 'Buy Rope' }))
    expect(await within(dialog).findByText('Not enough coin')).toBeInTheDocument()
    expect(lastAction(c.id)).toMatchObject({ change: 'buy', short: 100 })
    expect(active(c.id).equipment.currency.gp).toBe(0)
  })

  it('sells part of a stack at half price', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed(0)
    renderSheet()
    const panel = await openInventory(user)
    await user.click(
      await within(panel).findByRole('button', { name: 'Sell or drop Rope' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/^Price received/)).toHaveValue(0.5)
    await user.click(within(dialog).getByRole('button', { name: 'Sell' }))
    await waitFor(() =>
      expect(active(c.id).equipment.items.find((s) => s.name === 'Rope')?.quantity).toBe(
        1,
      ),
    )
    expect(active(c.id).equipment.currency).toMatchObject({ gp: 0, sp: 5 })
    expect(lastAction(c.id)).toMatchObject({ change: 'sell', item: 'Rope', price: 50 })
  })

  it('drops a whole stack for nothing', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed(0)
    renderSheet()
    const panel = await openInventory(user)
    await user.click(
      await within(panel).findByRole('button', { name: 'Sell or drop Rope' }),
    )
    const dialog = await screen.findByRole('dialog')
    const count = within(dialog).getByLabelText(/^How many/)
    await user.clear(count)
    await user.type(count, '2')
    await user.click(within(dialog).getByRole('button', { name: 'Drop for nothing' }))
    await waitFor(() =>
      expect(active(c.id).equipment.items.map((s) => s.name)).toEqual(['Longsword']),
    )
    expect(lastAction(c.id)).toMatchObject({ change: 'drop', quantity: 2 })
  })

  it('steps a quantity up and down in place, and drops the stack at none', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed(0)
    renderSheet()
    const panel = await openInventory(user)
    await user.click(await within(panel).findByRole('button', { name: 'One more Rope' }))
    await waitFor(() =>
      expect(active(c.id).equipment.items.find((s) => s.name === 'Rope')?.quantity).toBe(
        3,
      ),
    )
    expect(lastAction(c.id)).toMatchObject({ change: 'quantity', quantity: 3 })
    for (let i = 0; i < 3; i++) {
      await user.click(
        await within(panel).findByRole('button', { name: 'One fewer Rope' }),
      )
    }
    await waitFor(() =>
      expect(active(c.id).equipment.items.map((s) => s.name)).toEqual(['Longsword']),
    )
  })

  it('records wearing as play, which leaves the level up undo alone', async () => {
    const user = userEvent.setup({ delay: null })
    const c = seed(0)
    renderSheet()
    const panel = await openInventory(user)
    await user.click(
      await within(panel).findByRole('checkbox', { name: 'Longsword equipped' }),
    )
    await waitFor(() => expect(active(c.id).equipment.items[0].equipped).toBe(false))
    expect(lastAction(c.id)).toMatchObject({ change: 'unequip', item: 'Longsword' })
  })
})
