import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LevelUpView } from './LevelUpView'
import { SheetView } from '../sheet/SheetView'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { selectCanUndoLevelUp, useCharacterStore } from '../../character/store'
import { createCharacter, type Character } from '../../character/model'
import { loadClasses } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadClassOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { loadSpells } from '../../data/spells'
import { ITEMS } from '../../test/derivedFixtures'
import { KNIGHT, SEER } from '../../test/levelUpFixtures'
import { listsOf, makeSpell } from '../../test/spellFixtures'
import { settle } from '../../test/settle'

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

const KNIGHT_REF = { name: 'Knight', source: 'PHB' }

/** A finished character of the Knight class, in Level up, with 4 damage taken. */
function seed(level: number, patch: Partial<Character> = {}) {
  const base = createCharacter('Sir Ector')
  const c: Character = {
    ...base,
    selectedBooks: ['PHB'],
    classes: [{ ...KNIGHT_REF, level }],
    abilities: {
      str: { base: 15, other: 0 },
      dex: { base: 10, other: 0 },
      con: { base: 12, other: 0 },
      int: { base: 10, other: 0 },
      wis: { base: 10, other: 0 },
      cha: { base: 10, other: 0 },
    },
    completedAt: 1,
    play: { ...base.play, damage: 4 },
    ...patch,
  }
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'levelUp',
    levelUpUndo: null,
  })
  return c
}

const stored = () => {
  const s = useCharacterStore.getState()
  return s.characters[s.activeId!]
}

function renderView() {
  return render(
    <ThemeProvider>
      <LevelUpView />
    </ThemeProvider>,
  )
}

const step = (title: string) =>
  screen.getByRole('heading', { name: title }).closest('.levelup-step') as HTMLElement

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([KNIGHT, SEER])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadClassOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue(ITEMS)
  vi.mocked(loadSpells).mockResolvedValue([
    makeSpell({ name: 'Glimmer', level: 0, lists: listsOf('Seer|PHB') }),
    makeSpell({ name: 'Foresee', level: 1, lists: listsOf('Seer|PHB') }),
  ])
})

describe('LevelUpView', () => {
  it('renders nothing without an open character', async () => {
    useCharacterStore.setState({ characters: {}, order: [], activeId: null })
    const { container } = renderView()
    expect(container).toBeEmptyDOMElement()
    await settle()
  })

  it('shows only the steps the level asks for: the subclass at its level', async () => {
    seed(2)
    renderView()
    await screen.findByRole('heading', { name: 'Summary' })
    expect(screen.getByRole('button', { name: 'Knight 2 to 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('heading', { name: 'Knightly Order' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Ability score improvement or feat' }),
    ).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Spells' })).toBeNull()
    // The subclass is open until chosen, and the summary says so without blocking.
    expect(within(step('Summary')).getByText(/Subclass not chosen/)).toBeInTheDocument()
    await userEvent.click(
      await within(step('Knightly Order')).findByRole('button', { name: 'Choose' }),
    )
    await waitFor(() =>
      expect(within(step('Summary')).queryByText(/Subclass not chosen/)).toBeNull(),
    )
    expect(screen.getByRole('button', { name: 'Confirm level up' })).toBeInTheDocument()
  })

  it('shows the feat step at an ability score improvement level', async () => {
    seed(3)
    renderView()
    await screen.findByRole('heading', { name: 'Summary' })
    expect(
      screen.getByRole('heading', { name: 'Ability score improvement or feat' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Knightly Order' })).toBeNull()
  })

  it('offers a new fighting style in the class options step', async () => {
    vi.mocked(loadClasses).mockResolvedValue([
      {
        ...KNIGHT,
        entry: {
          ...KNIGHT.entry,
          optionalfeatureProgression: [
            { name: 'Fighting Style', featureType: ['FS:F'], progression: { '2': 1 } },
          ],
        },
      },
      SEER,
    ])
    vi.mocked(loadClassOptions).mockResolvedValue([
      {
        key: 'Defense|PHB',
        name: 'Defense',
        source: 'PHB',
        types: ['FS:F'],
        entries: ['While you are wearing armor, you gain a +1 bonus to AC.'],
      },
    ])
    seed(1)
    renderView()
    await screen.findByRole('heading', { name: 'Summary' })
    const options = within(step('Class options'))
    const row = options.getByText('Defense').closest('tr') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: 'Choose' }))
    await userEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
    expect(stored().classOptions).toEqual({ 'class:Knight|PHB|FS:F': ['Defense|PHB'] })
  })

  it('applies the level as one change, keeps play and returns to the sheet', async () => {
    const before = seed(1)
    renderView()
    await screen.findByRole('heading', { name: 'Summary' })
    const summary = within(step('Summary'))
    expect(summary.getByRole('table', { name: 'Before and after' })).toHaveTextContent(
      /Hit point maximum\s*11\s*18/,
    )
    // What the level adds is under After; Before has nothing for it.
    const added = summary.getByRole('rowheader', { name: 'Features added' }).closest('tr')
    const cells = within(added ?? document.body).getAllByRole('cell')
    expect(cells).toHaveLength(2)
    expect(cells[0]).toHaveTextContent(/^-$/)
    expect(cells[1]).not.toHaveTextContent(/^-$/)
    await userEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
    const after = stored()
    expect(after.classes[0].level).toBe(2)
    expect(after.history).toHaveLength(before.history.length + 1)
    expect(after.history.at(-1)?.action).toEqual({
      type: 'level-up',
      class: 'Knight|PHB',
      from: 1,
      to: 2,
    })
    expect(after.play.damage).toBe(4)
    expect(useCharacterStore.getState().view).toBe('sheet')
    expect(selectCanUndoLevelUp(useCharacterStore.getState())).toBe(true)
  })

  it('changes nothing on Cancel', async () => {
    const before = seed(2)
    renderView()
    await screen.findByRole('heading', { name: 'Summary' })
    await userEvent.click(
      await within(step('Knightly Order')).findByRole('button', { name: 'Choose' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(stored()).toBe(before)
    expect(useCharacterStore.getState().view).toBe('sheet')
  })

  it('rolls the new hit die of a character that rolls, and records it', async () => {
    seed(1, {
      hp: { ...createCharacter('x').hp, method: 'rolled', rolls: [10] },
    })
    renderView()
    await screen.findByRole('heading', { name: 'Summary' })
    expect(within(step('Summary')).getByText(/Hit die not rolled/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Enter my roll (1 to 10)'), '9')
    await waitFor(() =>
      expect(within(step('Summary')).queryByText(/Hit die not rolled/)).toBeNull(),
    )
    await userEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
    expect(stored().hp.rolls).toEqual([10, 9])
    expect(stored().history.at(-1)?.action).toMatchObject({
      hitDie: { die: 'd10', value: 9, by: 'entered' },
    })
  })

  it('takes the average or a roll for the new hit die', async () => {
    seed(1, {
      hp: { ...createCharacter('x').hp, method: 'rolled', rolls: [10] },
    })
    renderView()
    await screen.findByRole('heading', { name: 'Summary' })
    await userEvent.click(screen.getByRole('button', { name: 'Roll a d10' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expand Hit points' }))
    await userEvent.click(screen.getByRole('button', { name: 'Take the average (6)' }))
    await userEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
    expect(stored().history.at(-1)?.action).toMatchObject({
      hitDie: { die: 'd10', value: 6, by: 'average' },
    })
  })

  it('flags a new class whose prerequisites are not met, and takes it anyway', async () => {
    seed(3)
    renderView()
    await screen.findByRole('heading', { name: 'Summary' })
    const table = await within(step('Class')).findByRole('table')
    expect(await within(table).findByText('Not met')).toBeInTheDocument()
    await userEvent.click(within(table).getByRole('button', { name: 'Take' }))
    await screen.findByRole('heading', { name: 'Spells' })
    expect(screen.getByText('Seer 1, a new class')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
    expect(stored().classes).toEqual([
      { ...KNIGHT_REF, level: 3 },
      { name: 'Seer', source: 'PHB', level: 1 },
    ])
  })

  it('offers Undo on the sheet after a level up', async () => {
    seed(1)
    const { unmount } = renderView()
    await screen.findByRole('heading', { name: 'Summary' })
    await userEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
    unmount()
    render(
      <ThemeProvider>
        <SheetView />
      </ThemeProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Undo level up' }))
    expect(stored().classes[0].level).toBe(1)
    expect(screen.queryByRole('button', { name: 'Undo level up' })).toBeNull()
  })
})
