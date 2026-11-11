import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EquipmentSection } from './EquipmentSection'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadClasses } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems, type Item } from '../../data/items'
import { readVariant } from '../../data/itemVariants'
import { makeLookups } from '../../data/itemRead'
import { makeItem } from '../../test/itemFixtures'
import { settle } from '../../test/settle'

vi.mock('../../data/items', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/items')>()
  return { ...actual, loadItems: vi.fn() }
})
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
const mockItems = vi.mocked(loadItems)

const ROPE = 'Rope, Hempen (50 feet)'
const rope: Item = makeItem({ name: ROPE, weight: 10, value: 100 })

// An uncommon item with no weight: exercises the rarity label and the "-" weight
// in the tables.
const wand: Item = makeItem({
  name: 'Wand of Magic Detection',
  rarity: 'uncommon',
  value: 500,
})

/** A ring that needs attunement, to tick as many as the test needs. */
const ring = (n: number): Item =>
  makeItem({
    name: `Ring ${n}`,
    rarity: 'rare',
    weight: 0.1,
    attunement: { required: true, optional: false, classes: [] },
  })

const longsword: Item = makeItem({
  name: 'Longsword',
  source: 'XPHB',
  kind: 'weapon',
  weight: 3,
  weapon: { melee: true, damageTypes: ['Slashing'], properties: [], mastery: [] },
})
const plusOne: Item = readVariant(
  {
    name: '+1 Weapon',
    source: '',
    requires: [{ weapon: true }],
    inherits: {
      namePrefix: '+1 ',
      source: 'XDMG',
      rarity: 'uncommon',
      bonusWeapon: '+1',
    },
  },
  makeLookups({ properties: [], masteries: [], types: [] }, () => 'one'),
  () => undefined,
)

function seedActive(mutate: (c: ReturnType<typeof createCharacter>) => void = () => {}) {
  const c = createCharacter('Tordek')
  c.selectedBooks = ['PHB']
  mutate(c)
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c
}

function renderSection() {
  return render(
    <ThemeProvider>
      <EquipmentSection />
    </ThemeProvider>,
  )
}

function active(id: string) {
  return useCharacterStore.getState().characters[id]
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockItems.mockResolvedValue([rope])
  vi.mocked(loadClasses).mockResolvedValue([])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

const button = (name: string) => screen.getByRole('button', { name })
/** The row of the items table that holds an item's name. */
const rowOf = (name: string) => {
  const row = within(screen.getByRole('table', { name: 'Items' }))
    .getByText(name, { selector: 'strong' })
    .closest('tr')
  if (!row) throw new Error(`no row for ${name}`)
  return within(row)
}

describe('EquipmentSection', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the section data has loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('adds an item, adjusts quantity, removes it, and edits coins', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await waitFor(() => expect(active(c.id).equipment.items).toHaveLength(1))
    expect(active(c.id).equipment.items[0].quantity).toBe(1)

    // The lookup stays open while adding; Done shows what is carried.
    await user.click(button('Done'))
    await user.click(screen.getByLabelText(/One more Rope/))
    await waitFor(() => expect(active(c.id).equipment.items[0].quantity).toBe(2))

    await user.click(rowOf(ROPE).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(active(c.id).equipment.items).toHaveLength(0))

    const gp = screen.getByLabelText('Gold pieces')
    await user.clear(gp)
    await user.type(gp, '25')
    await waitFor(() => expect(active(c.id).equipment.currency.gp).toBe(25))
  })

  it('shows a dash weight for an item missing from the catalog', async () => {
    // An inventory entry with no matching catalog item contributes no weight
    // or value, reads "-" for weight, and is named in the not-in-books alert.
    seedActive((ch) => {
      ch.equipment.items = [{ name: 'Homebrew Trinket', source: 'HB', quantity: 2 }]
    })
    renderSection()

    expect(await screen.findByRole('button', { name: 'Remove item' })).toBeInTheDocument()
    expect(rowOf('Homebrew Trinket').getAllByText('-').length).toBeGreaterThan(0)
    expect(screen.getByText(/1 item has no listed weight/)).toBeInTheDocument()
    expect(screen.getByText(/^Carried/)).toHaveTextContent('Carried 0 lb')
  })

  it('stacks a re-added item, labels rarity, and adjusts one item among several', async () => {
    const user = userEvent.setup()
    mockItems.mockResolvedValue([rope, wand])
    const c = seedActive()
    renderSection()

    // Adding the same catalogued item twice increments its quantity.
    await screen.findByText(ROPE)
    await user.click(rowOf(ROPE).getByRole('button', { name: 'Add' }))
    await user.click(rowOf(ROPE).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(active(c.id).equipment.items[0].quantity).toBe(2))

    // An uncommon item shows its rarity in the lookup, and joins the inventory.
    expect(rowOf('Wand of Magic Detection').getByText('Uncommon')).toBeInTheDocument()
    await user.click(
      rowOf('Wand of Magic Detection').getByRole('button', { name: 'Add' }),
    )
    await waitFor(() => expect(active(c.id).equipment.items).toHaveLength(2))
    await user.click(button('Done'))
    // The weightless wand reads "-" in its row.
    expect(rowOf('Wand of Magic Detection').getAllByText('-').length).toBeGreaterThan(0)

    // Adjusting one item leaves the other untouched.
    await user.click(screen.getByLabelText(/One more Rope/))
    await waitFor(() => expect(active(c.id).equipment.items[0].quantity).toBe(3))
    expect(active(c.id).equipment.items[1].quantity).toBe(1)
  })

  it('surfaces a loader error', async () => {
    seedActive()
    mockItems.mockRejectedValue(new Error('boom'))
    renderSection()
    expect(await screen.findByText(/Failed to load items: boom/i)).toBeInTheDocument()
  })

  it('records an add, a quantity change and a remove in the character history', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()
    const at = (...path: string[]) =>
      active(c.id)
        .history.flatMap((entry) => entry.changes)
        .filter((change) => change.path.join('/') === path.join('/'))
    const stack = ['equipment', 'items', `${ROPE}|PHB`]

    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(at(...stack)[0]?.after).toEqual({ name: ROPE, source: 'PHB', quantity: 1 }),
    )
    await user.click(button('Done'))
    await user.click(screen.getByLabelText(/One more Rope/))
    await waitFor(() =>
      expect(at(...stack, 'quantity')[0]).toMatchObject({ before: 1, after: 2 }),
    )
    await user.click(rowOf(ROPE).getByRole('button', { name: 'Remove' }))
    await waitFor(() =>
      expect(
        at(...stack).some((change) => change.after === undefined && change.before),
      ).toBe(true),
    )
  })

  it('equips and attunes, flagging a fourth attuned item without blocking it', async () => {
    const user = userEvent.setup()
    mockItems.mockResolvedValue([ring(1), ring(2), ring(3), ring(4)])
    const c = seedActive((ch) => {
      ch.equipment.items = [1, 2, 3, 4].map((n) => ({
        name: `Ring ${n}`,
        source: 'PHB',
        quantity: 1,
      }))
    })
    renderSection()

    await user.click(await screen.findByLabelText('Ring 1 equipped'))
    await waitFor(() => expect(active(c.id).equipment.items[0].equipped).toBe(true))
    for (const n of [1, 2, 3])
      await user.click(screen.getByLabelText(`Ring ${n} attuned`))
    expect(screen.queryByText('More than 3 attuned')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Ring 4 attuned'))
    await waitFor(() => expect(active(c.id).equipment.items[3].attuned).toBe(true))
    expect(screen.getByText('More than 3 attuned')).toBeInTheDocument()
  })

  it('flags armor that needs more Strength and an item for another class, never blocking', async () => {
    const user = userEvent.setup()
    mockItems.mockResolvedValue([
      makeItem({
        name: 'Plate',
        kind: 'armor',
        armor: { strength: 15, stealth: true, class: 'heavy' },
      }),
      makeItem({
        name: 'Wizard Staff',
        rarity: 'rare',
        attunement: {
          required: true,
          optional: false,
          text: 'by a wizard',
          classes: ['wizard'],
        },
      }),
    ])
    const c = seedActive((ch) => {
      ch.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
      ch.abilities.str.base = 10
      ch.equipment.items = [
        { name: 'Plate', source: 'PHB', quantity: 1 },
        { name: 'Wizard Staff', source: 'PHB', quantity: 1 },
      ]
    })
    renderSection()

    await user.click(await screen.findByLabelText('Plate equipped'))
    await waitFor(() => expect(active(c.id).equipment.items[0].equipped).toBe(true))
    expect(screen.getByText('Needs Strength 15 (you have 10)')).toBeInTheDocument()
    expect(screen.getByText('Requires wizard')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Wizard Staff attuned'))
    await waitFor(() => expect(active(c.id).equipment.items[1].attuned).toBe(true))
  })

  it('labels each coin with its name, the code in a tooltip', async () => {
    const user = userEvent.setup()
    seedActive()
    renderSection()
    const label = await screen.findByText('Platinum pieces')
    expect(screen.queryByText('PP')).not.toBeInTheDocument()
    await user.hover(label)
    expect(await screen.findByText('PP')).toBeInTheDocument()
  })

  it('flags weight over what the character can carry, and keeps a note', async () => {
    const user = userEvent.setup()
    mockItems.mockResolvedValue([makeItem({ name: 'Anvil', weight: 200 })])
    const c = seedActive((ch) => {
      ch.abilities.str.base = 10
      ch.equipment.items = [{ name: 'Anvil', source: 'PHB', quantity: 1 }]
    })
    renderSection()

    expect(await screen.findByText('Over capacity')).toBeInTheDocument()
    expect(screen.getByText(/^Carried/)).toHaveTextContent('Carried 200 of 150 lb')
    await user.type(screen.getByLabelText('Note on Anvil'), 'heavy')
    await waitFor(() => expect(active(c.id).equipment.items[0].note).toBe('heavy'))
  })

  it('asks which base item a generic variant is made of, and keeps the result', async () => {
    const user = userEvent.setup()
    mockItems.mockResolvedValue([rope, longsword, plusOne])
    const c = seedActive((ch) => {
      ch.selectedBooks = ['PHB', 'XPHB', 'XDMG']
    })
    renderSection()

    await screen.findByText('+1 Weapon')
    await user.click(rowOf('+1 Weapon').getByRole('button', { name: 'Add' }))
    // Only what the variant fits is offered: the sword, not the rope.
    const bases = within(await screen.findByRole('table', { name: 'Base items' }))
    expect(bases.queryByText(ROPE)).not.toBeInTheDocument()
    const sword = bases.getByText('Longsword', { selector: 'strong' }).closest('tr')
    await user.click(within(sword as HTMLElement).getByRole('button', { name: 'Choose' }))

    await waitFor(() =>
      expect(active(c.id).equipment.items).toEqual([
        {
          name: '+1 Longsword',
          source: 'XDMG',
          quantity: 1,
          variantOf: '+1 Weapon|XDMG',
          base: 'Longsword|XPHB',
        },
      ]),
    )
    expect(screen.queryByRole('table', { name: 'Base items' })).not.toBeInTheDocument()
    await user.click(button('Done'))
    expect(rowOf('+1 Longsword').getAllByText('Uncommon').length).toBeGreaterThan(0)
  })

  it('adds an item of the player own, and edits it', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await user.click(
      (await screen.findAllByRole('button', { name: 'Add custom item' }))[0],
    )
    const dialog = within(await screen.findByRole('dialog'))
    await user.type(dialog.getByLabelText('Name'), 'Dragon scale')
    await user.selectOptions(dialog.getByLabelText('Rarity'), 'rare')
    await user.type(dialog.getByLabelText('Cost (gp)'), '12.5')
    await user.click(dialog.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(active(c.id).equipment.items).toEqual([
        {
          name: 'Dragon scale',
          source: 'Custom',
          quantity: 1,
          custom: {
            kind: 'gear',
            rarity: 'rare',
            value: 1250,
            description: '',
          },
        },
      ]),
    )

    await user.click(button('Done'))
    expect(rowOf('Dragon scale').getByText('Custom')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Edit Dragon scale'))
    const edit = within(await screen.findByRole('dialog'))
    await user.clear(edit.getByLabelText('Name'))
    await user.type(edit.getByLabelText('Name'), 'Dragon tooth')
    await user.click(edit.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(active(c.id).equipment.items[0].name).toBe('Dragon tooth'))
    expect(active(c.id).equipment.items).toHaveLength(1)
  })
})
