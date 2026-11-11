import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassBuildTray } from './ClassBuildTray'
import { useClassBuild } from './useClassBuild'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import {
  loadClasses,
  subclassesFor,
  subclassUnlockLevel,
  type LoadedClass,
  type SubclassEntry,
} from '../../data/class'

vi.mock('../../data/class', async (importActual) => ({
  ...(await importActual<typeof import('../../data/class')>()),
  loadClasses: vi.fn(),
  subclassesFor: vi.fn(),
  subclassUnlockLevel: vi.fn(),
}))
const mockClasses = vi.mocked(loadClasses)
const mockSubclasses = vi.mocked(subclassesFor)
const mockUnlock = vi.mocked(subclassUnlockLevel)

const fighterSub: SubclassEntry = {
  name: 'Champion',
  shortName: 'Champion',
  source: 'PHB',
  className: 'Fighter',
  classSource: 'PHB',
  subclassFeatures: [],
}

const fighter: LoadedClass = {
  entry: {
    name: 'Fighter',
    source: 'PHB',
    edition: 'classic',
    hd: { number: 1, faces: 10 },
    proficiency: ['str', 'con'],
    classFeatures: [],
    subclassTitle: 'Martial Archetype',
  },
  file: {},
}

const wizard: LoadedClass = {
  entry: {
    name: 'Wizard',
    source: 'PHB',
    edition: 'one',
    hd: { number: 1, faces: 6 },
    proficiency: ['int', 'wis'],
    classFeatures: [],
    spellcastingAbility: 'int',
    subclassTitle: 'Arcane Tradition',
    // A multiclass prerequisite the default character fails -> deviation badge.
    multiclassing: { requirements: { int: 13 } },
  },
  file: {},
}

// Wires the real build hook to the tray, exactly as the merged section does, so
// these tests exercise the hook's mutations end to end.
function Harness() {
  const build = useClassBuild()
  const character = useActiveCharacter()
  if (!character || build.loading) return null
  return <ClassBuildTray build={build} selectedBooks={character.selectedBooks} />
}

function seedActive() {
  const c = createCharacter('Tordek')
  c.selectedBooks = ['PHB', 'MM', 'DMG']
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c
}

function renderTray() {
  return render(
    <ThemeProvider>
      <Harness />
    </ThemeProvider>,
  )
}

function active(id: string) {
  return useCharacterStore.getState().characters[id]
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockClasses.mockResolvedValue([fighter, wizard])
  mockSubclasses.mockReturnValue([fighterSub])
  mockUnlock.mockReturnValue(1)
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('ClassBuildTray', () => {
  it('prompts to add a class when the build is empty', async () => {
    seedActive()
    renderTray()
    expect(await screen.findByText(/No classes yet/i)).toBeInTheDocument()
  })

  it('shows the edition of the chosen class', async () => {
    const c = seedActive()
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
    useCharacterStore.setState({ characters: { [c.id]: c } })
    renderTray()
    expect(await screen.findByText('2014')).toBeInTheDocument()
  })

  it('sets a level, floors a zero to 1, and shows the total', async () => {
    const c = seedActive()
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
    useCharacterStore.setState({ characters: { [c.id]: c } })
    renderTray()

    const level = await screen.findByLabelText('Level for Fighter')
    fireEvent.change(level, { target: { value: '5' } })
    fireEvent.blur(level)
    await waitFor(() => expect(active(c.id).classes[0].level).toBe(5))
    expect(screen.getByText('Level 5')).toBeInTheDocument()

    // A zero level is floored back to 1 (the `level || 1` fallback).
    fireEvent.change(screen.getByLabelText('Level for Fighter'), {
      target: { value: '0' },
    })
    fireEvent.blur(screen.getByLabelText('Level for Fighter'))
    await waitFor(() => expect(active(c.id).classes[0].level).toBe(1))
  })

  it('picks then clears a subclass', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
    useCharacterStore.setState({ characters: { [c.id]: c } })
    renderTray()

    await user.selectOptions(
      await screen.findByLabelText('Subclass for Fighter'),
      'Champion|PHB',
    )
    await waitFor(() => expect(active(c.id).classes[0].subclass?.name).toBe('Champion'))

    await user.selectOptions(screen.getByLabelText('Subclass for Fighter'), '')
    await waitFor(() => expect(active(c.id).classes[0].subclass).toBeUndefined())
  })

  it('keeps a planned subclass below its unlock level and flags the timing', async () => {
    const user = userEvent.setup()
    // Fighter-like class whose subclass unlocks at level 3.
    mockUnlock.mockReturnValue(3)
    const c = seedActive()
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
    useCharacterStore.setState({ characters: { [c.id]: c } })
    renderTray()

    // The picker is available even below the unlock level: a subclass can be
    // planned ahead of time (the deliberate reversal of the old clear-on-downlevel).
    const picker = await screen.findByLabelText('Subclass for Fighter')
    expect(picker).toBeEnabled()
    await user.selectOptions(picker, 'Champion|PHB')
    await waitFor(() => expect(active(c.id).classes[0].subclass?.name).toBe('Champion'))
    // Below unlock: the choice is kept but flagged as not yet in effect.
    expect(screen.getByText(/Subclass unlocks at level 3/i)).toBeInTheDocument()

    // Reaching the unlock level clears the "not yet" flag.
    fireEvent.change(screen.getByLabelText('Level for Fighter'), {
      target: { value: '3' },
    })
    fireEvent.blur(screen.getByLabelText('Level for Fighter'))
    await waitFor(() =>
      expect(screen.queryByText(/Subclass unlocks at level 3/i)).not.toBeInTheDocument(),
    )
    expect(active(c.id).classes[0].subclass?.name).toBe('Champion')

    // Dropping back below the unlock level KEEPS the planned subclass and
    // re-shows the timing flag - it is never silently discarded.
    fireEvent.change(screen.getByLabelText('Level for Fighter'), {
      target: { value: '2' },
    })
    fireEvent.blur(screen.getByLabelText('Level for Fighter'))
    await waitFor(() =>
      expect(screen.getByText(/Subclass unlocks at level 3/i)).toBeInTheDocument(),
    )
    expect(active(c.id).classes[0].subclass?.name).toBe('Champion')
  })

  it('flags an over-cap multiclass build and shows spellcasting', async () => {
    const c = seedActive()
    c.classes = [
      { name: 'Fighter', source: 'PHB', level: 20 },
      { name: 'Wizard', source: 'PHB', level: 2 },
    ]
    useCharacterStore.setState({ characters: { [c.id]: c } })
    renderTray()

    // Total level 22 exceeds the level-20 cap -> a non-standard badge, plus the
    // Wizard's failed multiclass prerequisite -> at least two notes.
    expect(await screen.findByText('Level 22')).toBeInTheDocument()
    expect(screen.getAllByRole('note').length).toBeGreaterThan(0)
    expect(screen.getByText(/Spellcasting: INT/i)).toBeInTheDocument()
  })

  it('removes a class from the build', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
    useCharacterStore.setState({ characters: { [c.id]: c } })
    renderTray()

    await user.click(await screen.findByLabelText('Remove Fighter'))
    await waitFor(() => expect(active(c.id).classes).toHaveLength(0))
  })
})
