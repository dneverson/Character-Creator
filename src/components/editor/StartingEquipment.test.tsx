import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EquipmentSection } from './EquipmentSection'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { loadClasses, type ClassEntry, type LoadedClass } from '../../data/class'
import { loadBackgrounds, type PlayableBackground } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems, type Item } from '../../data/items'
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
vi.mock('../../dice/dice', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../dice/dice')>()),
  rollDice: vi.fn(() => [1, 2, 3, 4, 5]),
}))

const weapon = (name: string, category: 'simple' | 'martial', source = 'PHB'): Item =>
  makeItem({
    name,
    source,
    kind: 'weapon',
    weapon: { category, melee: true, damageTypes: [], properties: [], mastery: [] },
  })
const chainMail = makeItem({ name: 'Chain Mail', source: 'XPHB', weight: 55 })
const greatsword = weapon('Greatsword', 'martial', 'XPHB')
const leather = makeItem({ name: 'Leather Armor', source: 'PHB' })
const longsword = weapon('Longsword', 'martial')
const halberd = weapon('Halberd', 'martial')
const club = weapon('Club', 'simple')
const catalog = [chainMail, greatsword, leather, longsword, halberd, club]

const classEntry = (
  name: string,
  source: string,
  edition: 'classic' | 'one',
  startingEquipment: ClassEntry['startingEquipment'],
): LoadedClass => ({
  entry: { name, source, edition, classFeatures: [], startingEquipment },
  file: {},
})
const fighter2024 = classEntry('Fighter', 'XPHB', 'one', {
  defaultData: [
    {
      A: [{ item: 'chain mail|xphb' }, { item: 'greatsword|xphb' }, { value: 400 }],
      B: [{ value: 15500 }],
    },
  ],
})
const fighter2014 = classEntry('Fighter', 'PHB', 'classic', {
  defaultData: [
    { a: ['chain mail|xphb'], b: ['leather armor|phb'] },
    { a: [{ equipmentType: 'weaponMartial' }], b: [{ equipmentType: 'weaponSimple' }] },
  ],
  goldAlternative: '{@dice 5d4 × 10|5d4 × 10|Starting Gold}',
})

const background = (equipment?: unknown[]): PlayableBackground => ({
  key: 'Guard|PHB',
  name: 'Guard',
  source: 'PHB',
  edition: 'classic',
  abilityOptions: [],
  featGrants: [],
  storyTables: [],
  entries: [],
  startingEquipment: equipment,
})

function seed(cls: string | undefined, bg?: PlayableBackground) {
  const c = createCharacter('Tordek')
  c.selectedBooks = ['PHB', 'XPHB']
  if (cls) {
    const [name, source] = cls.split('|')
    c.classes = [{ name, source, level: 1 }]
  }
  if (bg) c.background = { name: bg.name, source: bg.source, abilityChoices: {} }
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  vi.mocked(loadBackgrounds).mockResolvedValue(bg ? [bg] : [])
  return c
}

const active = (id: string) => useCharacterStore.getState().characters[id]

async function show() {
  render(
    <ThemeProvider>
      <EquipmentSection />
    </ThemeProvider>,
  )
  await screen.findByRole('heading', { name: 'Starting equipment' })
  await settle()
}
const click = (name: string | RegExp) =>
  userEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadItems).mockResolvedValue(catalog)
  vi.mocked(loadClasses).mockResolvedValue([fighter2024, fighter2014])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('StartingEquipment', () => {
  it('takes the default option in one click and folds to one line', async () => {
    const c = seed('Fighter|XPHB')
    await show()
    expect(
      screen.getByRole('radio', { name: /A: Chain Mail, Greatsword, 4 gp/ }),
    ).toBeChecked()
    expect(
      screen.getByRole('radio', { name: /B: Gold only: 155 gp/ }),
    ).toBeInTheDocument()

    await click('Take equipment')

    const { items, currency, starting } = active(c.id).equipment
    expect(items).toEqual([
      { name: 'Chain Mail', source: 'XPHB', quantity: 1, from: 'class' },
      { name: 'Greatsword', source: 'XPHB', quantity: 1, from: 'class' },
    ])
    expect(currency.gp).toBe(4)
    expect(starting.class).toMatchObject({
      source: 'Fighter|XPHB',
      option: 'A',
      gold: 400,
    })
    expect(screen.getByText('Option A taken')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('replaces what an option gave when another is taken, coin included', async () => {
    const c = seed('Fighter|XPHB')
    await show()
    await click('Take equipment')
    await click('Change')
    await userEvent.click(screen.getByRole('radio', { name: /B: Gold only/ }))
    await click('Take equipment')

    const { items, currency } = active(c.id).equipment
    expect(items).toEqual([])
    expect(currency.gp).toBe(155)
    expect(screen.getByText('Option B taken')).toBeInTheDocument()
  })

  it('leaves the starting equipment alone on Skip, and says so', async () => {
    const c = seed('Fighter|XPHB')
    await show()
    await click('Skip, I will add my own')
    expect(active(c.id).equipment.items).toEqual([])
    expect(active(c.id).equipment.starting.class?.option).toBe('none')
    expect(screen.getByText('Starting equipment skipped')).toBeInTheDocument()
  })

  it('offers a 2014 pick from the items that fit, taken with the rest', async () => {
    const c = seed('Fighter|PHB')
    await show()
    expect(screen.getByText('Choose a martial weapon')).toBeInTheDocument()
    expect(screen.getByText(/1 choice is not made yet/)).toBeInTheDocument()

    await click('Choose martial weapon')
    // The table holds the martial weapons only.
    const table = screen.getByRole('table', { name: 'Martial weapon' })
    expect(within(table).queryByText('Club')).not.toBeInTheDocument()
    const row = within(table).getByText('Halberd', { selector: 'strong' }).closest('tr')
    if (!row) throw new Error('no row')
    await userEvent.click(within(row).getByRole('button', { name: 'Choose' }))
    expect(screen.getByRole('heading', { name: /Halberd/ })).toBeInTheDocument()

    await click('Take equipment')
    const names = active(c.id).equipment.items.map((i) => i.name)
    expect(names).toEqual(['Chain Mail', 'Halberd'])
    expect(active(c.id).equipment.starting.class).toMatchObject({
      option: 'a,a',
      picks: { '1.a.0.0': 'Halberd|PHB' },
    })
  })

  it('takes without a pick and lets the player make it afterwards', async () => {
    const c = seed('Fighter|PHB')
    await show()
    await click('Take equipment')
    expect(
      screen.getByText(/Starting equipment taken - 1 choice left/),
    ).toBeInTheDocument()
    expect(active(c.id).equipment.items.map((i) => i.name)).toEqual(['Chain Mail'])

    await click('Make choices')
    // The option taken is still the one selected.
    expect(screen.getByRole('radio', { name: /A: Chain Mail/ })).toBeChecked()
  })

  it('rolls the 2014 gold into the history, rolls again, and takes the total', async () => {
    const c = seed('Fighter|PHB')
    await show()
    await userEvent.click(screen.getByRole('radio', { name: 'Take gold instead' }))
    await click(/Roll 5d4 x 10/)
    expect(screen.getByLabelText('Gold')).toHaveValue(150)
    expect(
      screen.getByText(/Rolled 1 \+ 2 \+ 3 \+ 4 \+ 5, times 10 = 150 gp/),
    ).toBeInTheDocument()
    await click(/Roll 5d4 x 10/)
    expect(screen.getByText(/2 rolls are in the history/)).toBeInTheDocument()
    const rolls = active(c.id).history.filter((h) => h.action?.type === 'roll')
    expect(rolls).toHaveLength(2)

    await click('Take 150 gp')
    expect(active(c.id).equipment.currency.gp).toBe(150)
    expect(active(c.id).equipment.items).toEqual([])
    expect(screen.getByText('Starting gold taken: 150 gp')).toBeInTheDocument()
  })

  it('takes a total typed from a roll made at the table', async () => {
    const c = seed('Fighter|PHB')
    await show()
    await userEvent.click(screen.getByRole('radio', { name: 'Take gold instead' }))
    expect(screen.getByRole('button', { name: 'Take gold' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Gold'), '90')
    await click('Take 90 gp')
    expect(active(c.id).equipment.currency.gp).toBe(90)
  })

  it('takes a background and a class together, each replacing only its own', async () => {
    const c = seed(
      'Fighter|XPHB',
      background([
        { _: ['leather armor|phb', { special: 'a lucky coin' }, { value: 1000 }] },
      ]),
    )
    await show()
    const taking = screen.getAllByRole('button', { name: 'Take equipment' })
    await userEvent.click(taking[0])
    await userEvent.click(screen.getByRole('button', { name: 'Take equipment' }))

    const { items, currency } = active(c.id).equipment
    expect(items.filter((i) => i.from === 'background').map((i) => i.name)).toEqual([
      'Leather Armor',
      'A lucky coin',
    ])
    expect(items.filter((i) => i.from === 'class')).toHaveLength(2)
    expect(currency.gp).toBe(14)
  })

  it('says what is missing when there is nothing to take', async () => {
    seed('Fighter|XPHB', background(undefined))
    await show()
    expect(
      screen.getByText('This background lists no starting equipment.'),
    ).toBeInTheDocument()
  })

  it('asks for a class and a background first', async () => {
    seed(undefined)
    render(
      <ThemeProvider>
        <EquipmentSection />
      </ThemeProvider>,
    )
    expect(
      await screen.findByText(
        'Choose a class and a background to take their starting equipment.',
      ),
    ).toBeInTheDocument()
    await settle()
  })

  it('unpacks a pack of the inventory into what it holds', async () => {
    const rope = makeItem({ name: 'Rope', source: 'PHB' })
    const pack = makeItem({
      name: "Explorer's Pack",
      source: 'PHB',
      pack: [{ key: rope.key, name: 'rope', quantity: 2 }],
    })
    vi.mocked(loadItems).mockResolvedValue([...catalog, rope, pack])
    const c = seed('Fighter|XPHB')
    useCharacterStore.getState().updateActive({
      equipment: {
        ...active(c.id).equipment,
        items: [{ name: pack.name, source: 'PHB', quantity: 1 }],
      },
    })
    await show()
    await userEvent.click(screen.getByRole('button', { name: "Unpack Explorer's Pack" }))
    expect(active(c.id).equipment.items).toEqual([
      { name: 'Rope', source: 'PHB', quantity: 2 },
    ])
  })
})
