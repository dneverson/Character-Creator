import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetView } from './SheetView'
import { UseCounter } from './UseCounter'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter, type Character } from '../../character/model'
import { loadClasses, type LoadedClass } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadSpells } from '../../data/spells'
import { loadBeasts } from '../../data/beasts'
import { loadConditions } from '../../data/conditions'
import { loadClassOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import type { DerivedResource } from '../../derived/resources'
import { ITEMS, loadedClass, stack } from '../../test/derivedFixtures'
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
vi.mock('../../data/conditions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/conditions')>()),
  loadConditions: vi.fn(),
}))

const feature = (name: string, level: number, text: string) => ({
  name,
  source: 'PHB',
  className: 'Fighter',
  classSource: 'PHB',
  level,
  entries: [text],
})

const fighter: LoadedClass = loadedClass('Fighter', [], [], {
  classFeature: [
    feature('Second Wind', 1, 'You have a limited well of stamina.'),
    feature('Action Surge', 2, 'You can push yourself beyond your normal limits.'),
  ],
})
fighter.entry.classFeatures = ['Second Wind|Fighter|PHB|1', 'Action Surge|Fighter|PHB|2']

const wand = makeItem({
  name: 'Wand of Sparks',
  source: 'DMG',
  magic: true,
  charges: { max: '7', recharge: 'on a long rest', on: 'restLong' },
  entries: ['The wand has 7 charges.'],
})
const staff = makeItem({
  name: 'Staff of Embers',
  source: 'DMG',
  magic: true,
  charges: { max: '10', recharge: 'at dawn', on: 'dawn', amount: '1d6 + 4' },
})

const WIND = 'use:classFeature|Second Wind|PHB|Fighter#Second Wind'
const SURGE = 'use:classFeature|Action Surge|PHB|Fighter#Action Surge'
const WAND = 'item:Wand of Sparks|DMG'

function seed(patch: Partial<Character> = {}) {
  const c = createCharacter('Tordek')
  c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
  c.equipment.items = [
    stack('Wand of Sparks', { source: 'DMG' }),
    stack('Staff of Embers', { source: 'DMG', equipped: false }),
  ]
  Object.assign(c, patch)
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
  })
  return c
}

const active = () => {
  const { activeId, characters } = useCharacterStore.getState()
  return characters[activeId ?? '']
}

const original = window.matchMedia
function setWide() {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query.includes('min-width: 1200px'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

function renderSheet() {
  return render(
    <ThemeProvider>
      <SheetView />
    </ThemeProvider>,
  )
}

async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('tab', { name }))
  return screen.getByRole('tabpanel')
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([fighter])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadClassOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue([...ITEMS, wand, staff])
  vi.mocked(loadSpells).mockResolvedValue([])
  vi.mocked(loadBeasts).mockResolvedValue([])
  vi.mocked(loadConditions).mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

afterEach(() => {
  window.matchMedia = original
})

describe('limited uses on the Features tab', () => {
  it('puts a counter on the row of the feature, spent and regained there', async () => {
    const user = userEvent.setup()
    const c = seed()
    renderSheet()
    const panel = await openTab(user, 'Features & Traits')
    const table = await within(panel).findByRole('table', { name: 'Features and traits' })
    expect(within(table).getByRole('columnheader', { name: /Uses/ })).toBeInTheDocument()
    const wind = within(table).getByRole('group', { name: 'Second Wind uses' })
    await user.click(
      within(wind).getByRole('button', { name: 'Second Wind use 1 of 1, available' }),
    )
    expect(active().play.uses[WIND]).toBe(1)
    expect(active().history.length).toBe(c.history.length + 1)
    await user.click(
      within(wind).getByRole('button', { name: 'Second Wind use 1 of 1, used' }),
    )
    expect(active().play.uses[WIND]).toBe(0)
    expect(within(table).getAllByText('Short or long rest')).toHaveLength(2)
  })

  it('spends without opening the row, and says in the feature text how many uses it has', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    const panel = await openTab(user, 'Features & Traits')
    const table = await within(panel).findByRole('table', { name: 'Features and traits' })
    await user.click(
      within(table).getByRole('button', { name: 'Action Surge use 1 of 1, available' }),
    )
    expect(active().play.uses[SURGE]).toBe(1)
    expect(document.querySelector('.data-table-detail')).toBeNull()
    await user.click(within(table).getByText('Action Surge'))
    expect(
      await screen.findByText(
        /^Action Surge: 1 use\. Maximum: .+\. All on a short or long rest\.$/,
      ),
    ).toBeInTheDocument()
  })
})

describe('limited uses on the Actions tab', () => {
  it('lists every counter with what restores it and where it comes from', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    const panel = await openTab(user, 'Actions')
    const table = await within(panel).findByRole('table', { name: 'Limited uses' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      'Second Wind',
      'Action Surge',
      'Wand of Sparks',
    ])
    expect(within(rows[2]).getByText('Long rest')).toBeInTheDocument()
    await user.click(within(table).getByRole('button', { name: 'About Action Surge' }))
    expect(
      await screen.findByText('You can push yourself beyond your normal limits.'),
    ).toBeInTheDocument()
  })

  it('counts a pool larger than the pips as a number with a minus and a plus', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const panel = await openTab(user, 'Actions')
    const pool = await within(panel).findByRole('group', { name: 'Wand of Sparks uses' })
    const regain = within(pool).getByRole('button', { name: 'Regain one Wand of Sparks' })
    expect(regain).toBeDisabled()
    expect(within(pool).getByText('7/7')).toBeInTheDocument()
    await user.click(
      within(pool).getByRole('button', { name: 'Spend one Wand of Sparks' }),
    )
    expect(within(pool).getByText('6/7')).toBeInTheDocument()
    expect(active().play.uses[WAND]).toBe(1)
    await user.click(regain)
    expect(active().play.uses[WAND]).toBe(0)
  })
})

describe('charges on the Inventory tab', () => {
  it('counts the charges of an equipped item, and names only how many the others hold', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const panel = await openTab(user, 'Inventory')
    const table = await within(panel).findByRole('table', { name: 'Items' })
    expect(
      within(table).getByRole('group', { name: 'Wand of Sparks uses' }),
    ).toBeInTheDocument()
    const staffRow = within(table).getByText('Staff of Embers').closest('tr')
    expect(staffRow).not.toBeNull()
    expect(within(staffRow as HTMLElement).getByText('10')).toBeInTheDocument()
  })
})

describe('limited uses at a rest', () => {
  it('a short rest lists the uses it restores, restores them and records them', async () => {
    const user = userEvent.setup()
    const c = seed()
    seed({ play: { ...c.play, uses: { [WIND]: 1, [SURGE]: 1, [WAND]: 3 } } })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Short rest' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(
        /Uses regained now: Second Wind \(1\), Action Surge \(1\)\./,
      ),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirm short rest' }))
    expect(active().play.uses).toEqual({ [WIND]: 0, [SURGE]: 0, [WAND]: 3 })
    expect(active().history.at(-1)?.action).toEqual({
      type: 'rest',
      rest: 'short',
      rolls: [],
      restored: [
        { id: WIND, label: 'Second Wind', regained: 1 },
        { id: SURGE, label: 'Action Surge', regained: 1 },
      ],
    })
  })

  it('a long rest restores the item charges too, and says when nothing comes back', async () => {
    const user = userEvent.setup()
    const c = seed()
    seed({ play: { ...c.play, uses: { [WAND]: 3 } } })
    const first = renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Long rest' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/Uses regained now: Wand of Sparks \(3\)\./),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirm long rest' }))
    expect(active().play.uses[WAND]).toBe(0)
    first.unmount()

    seed()
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Short rest' }))
    expect(
      within(await screen.findByRole('dialog')).getByText(
        /none \(none are spent that this rest restores\)/,
      ),
    ).toBeInTheDocument()
  })
})

describe('UseCounter', () => {
  const resource = (max: number | undefined): DerivedResource => ({
    id: 'psi',
    label: 'Psionic Energy',
    from: 'Fighter',
    kind: 'feature',
    max,
    recharge: 'long',
    shortRegain: 0,
    basis: 'Fixed',
    restores: 'All on a long rest',
    entries: [],
  })

  it('says Unlimited with no maximum, and None yet at a maximum of 0', () => {
    const { rerender } = render(
      <UseCounter resource={resource(undefined)} pool={undefined} />,
    )
    expect(screen.getByText('Unlimited')).toBeInTheDocument()
    rerender(
      <UseCounter
        resource={resource(0)}
        pool={{ id: 'psi', total: 0, spent: 0, left: 0 }}
      />,
    )
    expect(screen.getByText('None yet')).toBeInTheDocument()
  })
})
