import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetView } from './SheetView'
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
import { loadFightingStyleOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { FIGHTER, ITEMS, loadedClass } from '../../test/derivedFixtures'
import { listsOf, makeSpell } from '../../test/spellFixtures'

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
  loadFightingStyleOptions: vi.fn(),
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

const cleric: LoadedClass = loadedClass('Cleric', [], [])
cleric.entry.spellcastingAbility = 'wis'
cleric.entry.casterProgression = 'full'
cleric.entry.cantripProgression = [3, 3, 3]
cleric.entry.preparedSpells = '<$level$> + <$wis_mod$>'
const warlock: LoadedClass = loadedClass('Warlock', [], [])
warlock.entry.spellcastingAbility = 'cha'
warlock.entry.casterProgression = 'pact'
warlock.entry.cantripProgression = [2, 2, 2]
warlock.entry.spellsKnownProgression = [2, 3, 4]

const fighter2024: LoadedClass = loadedClass('Fighter', [], [])
fighter2024.entry.source = 'XPHB'

const bless = makeSpell({
  name: 'Bless',
  level: 1,
  concentration: true,
  lists: listsOf('Cleric|PHB'),
  entries: ['You bless up to three creatures.'],
})

const CONDITIONS = [
  { name: 'Prone', source: 'PHB', entries: ['A prone creature crawls (2014).'] },
  { name: 'Prone', source: 'XPHB', entries: ['A prone creature crawls (2024).'] },
  { name: 'Poisoned', source: 'PHB', entries: ['A poisoned creature rolls badly.'] },
  {
    name: 'Exhaustion',
    source: 'PHB',
    entries: ['Exhaustion is measured in six levels.'],
  },
  { name: 'Exhaustion', source: 'XPHB', entries: ['This condition is cumulative.'] },
]

function seed(patch: Partial<Character> = {}) {
  const c = createCharacter('Tordek')
  c.classes = [{ name: 'Cleric', source: 'PHB', level: 3 }]
  c.abilities = {
    ...c.abilities,
    con: { base: 14, other: 0 },
    wis: { base: 16, other: 0 },
  }
  c.spells = {
    'Cleric|PHB': { cantrips: [], spells: [{ name: 'Bless', source: 'PHB', level: 1 }] },
  }
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

const hpBox = () => screen.findByRole('group', { name: 'Hit points' })

/** The text of the current hit points button: "Current hit points: 17". */
const currentHp = (box: HTMLElement) =>
  Number(within(box).getByRole('button', { name: /^Current hit points: / }).textContent)

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([FIGHTER, cleric, warlock, fighter2024])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadFightingStyleOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue(ITEMS)
  vi.mocked(loadSpells).mockResolvedValue([bless])
  vi.mocked(loadBeasts).mockResolvedValue([])
  vi.mocked(loadConditions).mockResolvedValue(CONDITIONS)
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

afterEach(() => {
  window.matchMedia = original
})

describe('the hit points box', () => {
  it('takes damage from temporary hit points first, then heals, each in one click', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const box = await hpBox()
    const full = currentHp(box)
    await user.type(
      within(box).getByRole('spinbutton', { name: 'Hit points amount' }),
      '5',
    )
    await user.click(within(box).getByRole('button', { name: 'Temp' }))
    expect(
      within(box).getByRole('spinbutton', { name: 'Temporary hit points' }),
    ).toHaveValue(5)
    expect(
      within(box).getByRole('spinbutton', { name: 'Hit points amount' }),
    ).toHaveValue(null)

    await user.type(
      within(box).getByRole('spinbutton', { name: 'Hit points amount' }),
      '8',
    )
    await user.click(within(box).getByRole('button', { name: 'Damage' }))
    expect(active().play).toMatchObject({ tempHp: 0, damage: 3 })
    expect(currentHp(box)).toBe(full - 3)

    await user.type(
      within(box).getByRole('spinbutton', { name: 'Hit points amount' }),
      '2',
    )
    await user.click(within(box).getByRole('button', { name: 'Heal' }))
    expect(active().play.damage).toBe(1)
  })

  it('does nothing for an empty amount, and records the change in the history', async () => {
    const user = userEvent.setup()
    const c = seed()
    renderSheet()
    const box = await hpBox()
    await user.click(within(box).getByRole('button', { name: 'Damage' }))
    expect(active().play.damage).toBe(0)
    await user.type(
      within(box).getByRole('spinbutton', { name: 'Hit points amount' }),
      '4',
    )
    await user.click(within(box).getByRole('button', { name: 'Damage' }))
    expect(active().history.length).toBe(c.history.length + 1)
    expect(active().history.at(-1)?.changes[0].path).toEqual(['play', 'damage'])
  })

  it('sets the temporary hit points by hand', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const box = await hpBox()
    const temp = within(box).getByRole('spinbutton', { name: 'Temporary hit points' })
    await user.clear(temp)
    await user.type(temp, '7{Enter}')
    expect(active().play.tempHp).toBe(7)
  })

  it('shows the death saves at 0 hit points, and brings them back with healing', async () => {
    const user = userEvent.setup()
    const c = seed()
    const full = 24
    seed({ play: { ...c.play, damage: full * 10 } })
    renderSheet()
    const box = await hpBox()
    const saves = within(box).getByRole('group', { name: 'Death saves' })
    expect(within(saves).getByText('Dying')).toBeInTheDocument()
    await user.click(
      within(saves).getByRole('button', {
        name: 'Death save failure 1 of 3, not marked',
      }),
    )
    expect(active().play.deathSaves.failures).toBe(1)
    await user.click(
      within(saves).getByRole('button', {
        name: 'Death save success 2 of 3, not marked',
      }),
    )
    expect(active().play.deathSaves.successes).toBe(2)
    await user.type(
      within(box).getByRole('spinbutton', { name: 'Hit points amount' }),
      '1',
    )
    await user.click(within(box).getByRole('button', { name: 'Heal' }))
    expect(active().play.deathSaves).toEqual({ successes: 0, failures: 0 })
    expect(within(box).queryByRole('group', { name: 'Death saves' })).toBeNull()
  })

  it('shows Dead and Stable once three saves are marked', async () => {
    const c = seed()
    seed({ play: { ...c.play, damage: 999, deathSaves: { successes: 3, failures: 0 } } })
    renderSheet()
    expect(await screen.findByText('Stable')).toBeInTheDocument()
  })
})

describe('the play strip', () => {
  it('flips inspiration, named for the edition', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    await user.click(await screen.findByRole('checkbox', { name: 'Inspiration' }))
    expect(active().play.inspiration).toBe(true)
  })

  it('calls it Heroic Inspiration in the 2024 rules', async () => {
    seed({ classes: [], selectedBooks: ['XPHB'] })
    renderSheet()
    expect(
      await screen.findByRole('checkbox', { name: 'Heroic Inspiration' }),
    ).toBeInTheDocument()
  })

  it('steps exhaustion up and down within 0 and 6', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const raise = await screen.findByRole('button', { name: 'Raise exhaustion' })
    const lower = screen.getByRole('button', { name: 'Lower exhaustion' })
    expect(lower).toBeDisabled()
    for (let i = 0; i < 7; i++) await user.click(raise)
    expect(active().play.exhaustion).toBe(6)
    expect(raise).toBeDisabled()
    await user.click(lower)
    expect(active().play.exhaustion).toBe(5)
  })

  it('opens what exhaustion does now: 2014 levels, then 2024 d20 and speed', async () => {
    const user = userEvent.setup()
    setWide()
    const c = seed()
    seed({ play: { ...c.play, exhaustion: 2 } })
    const first = renderSheet()
    await user.click(await screen.findByRole('button', { name: 'What exhaustion does' }))
    const effects = await screen.findByRole('list', { name: 'Effects now' })
    expect(within(effects).getByText('Speed halved')).toBeInTheDocument()
    expect(
      await screen.findByText('Exhaustion is measured in six levels.'),
    ).toBeInTheDocument()
    first.unmount()

    const d = seed({ classes: [], selectedBooks: ['XPHB'] })
    seed({ classes: [], selectedBooks: ['XPHB'], play: { ...d.play, exhaustion: 2 } })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'What exhaustion does' }))
    const now = await screen.findByRole('list', { name: 'Effects now' })
    expect(within(now).getByText('D20 Tests: -4')).toBeInTheDocument()
    expect(within(now).getByText('Speed: -10 ft.')).toBeInTheDocument()
  })

  it('says so when there is no exhaustion', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'What exhaustion does' }))
    expect(await screen.findByText('Not exhausted.')).toBeInTheDocument()
  })

  it('picks conditions with their text, shows them as tags and removes them', async () => {
    const user = userEvent.setup()
    setWide()
    seed()
    renderSheet()
    await user.click(await screen.findByRole('button', { name: /Condition$/ }))
    const list = await screen.findByRole('list', { name: 'Conditions' })
    expect(within(list).queryByText('Exhaustion')).toBeNull()
    await user.click(within(list).getByRole('button', { name: 'Prone' }))
    expect(screen.getByText('A prone creature crawls (2014).')).toBeInTheDocument()
    await user.click(within(list).getByRole('checkbox', { name: 'Prone applies' }))
    expect(active().play.conditions).toEqual(['Prone'])
    const tag = screen.getByRole('group', { name: 'Prone' })
    await user.click(within(tag).getByRole('button', { name: 'Remove Prone' }))
    expect(active().play.conditions).toEqual([])
  })

  it('opens a condition tag on its own text, 2024 text for the 2024 rules', async () => {
    const user = userEvent.setup()
    setWide()
    const c = seed({ classes: [], selectedBooks: ['XPHB'] })
    seed({
      classes: [],
      selectedBooks: ['XPHB'],
      play: { ...c.play, conditions: ['Prone'] },
    })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Prone' }))
    expect(await screen.findByText('A prone creature crawls (2024).')).toBeInTheDocument()
  })

  it('spends and regains a hit die of each size', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const dice = await screen.findByRole('group', { name: 'd8 hit dice' })
    expect(within(dice).getByText('3/3')).toBeInTheDocument()
    await user.click(within(dice).getByRole('button', { name: 'Spend a d8 hit die' }))
    expect(within(dice).getByText('2/3')).toBeInTheDocument()
    expect(active().play.hitDiceSpent).toEqual({ d8: 1 })
    await user.click(within(dice).getByRole('button', { name: 'Regain a d8 hit die' }))
    expect(within(dice).getByText('3/3')).toBeInTheDocument()
  })

  it('has slot pips named by level, number and state, and spends and restores them', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    const slots = await screen.findByRole('group', { name: 'Spell slots' })
    await user.click(
      within(slots).getByRole('button', { name: 'Level 1 slot 4 of 4, available' }),
    )
    expect(active().play.slotsSpent).toEqual([1])
    const used = within(slots).getByRole('button', { name: 'Level 1 slot 4 of 4, used' })
    expect(used).toHaveAttribute('aria-pressed', 'true')
    await user.click(used)
    expect(active().play.slotsSpent).toEqual([0])
  })

  it('shows the Pact Magic slots apart from the others for a multiclass character', async () => {
    const user = userEvent.setup()
    seed({
      classes: [
        { name: 'Cleric', source: 'PHB', level: 3 },
        { name: 'Warlock', source: 'PHB', level: 2 },
      ],
    })
    renderSheet()
    const slots = await screen.findByRole('group', { name: 'Spell slots' })
    expect(
      within(slots).getByRole('button', { name: 'Level 1 slot 1 of 4, available' }),
    ).toBeInTheDocument()
    await user.click(
      within(slots).getByRole('button', { name: 'Pact slot 2 of 2, available' }),
    )
    expect(active().play).toMatchObject({ pactSpent: 1, slotsSpent: [] })
  })
})

describe('the Spells tab', () => {
  it('has the slot pips in its header, the same state as the strip', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    await user.click(await screen.findByRole('tab', { name: 'Spells' }))
    const header = await screen.findByRole('group', { name: 'Spell slots for casting' })
    await user.click(
      within(header).getByRole('button', { name: 'Level 2 slot 2 of 2, available' }),
    )
    const strip = screen.getByRole('group', { name: 'Spell slots' })
    expect(
      within(strip).getByRole('button', { name: 'Level 2 slot 2 of 2, used' }),
    ).toBeInTheDocument()
  })

  it('starts and ends concentration from a concentration spell', async () => {
    const user = userEvent.setup()
    seed()
    renderSheet()
    await user.click(await screen.findByRole('tab', { name: 'Spells' }))
    await user.click(await screen.findByRole('button', { name: 'Concentrate on Bless' }))
    expect(active().play.concentration).toEqual({ name: 'Bless', source: 'PHB' })
    const chip = screen.getByRole('group', { name: 'Concentration' })
    expect(within(chip).getByText('Bless')).toBeInTheDocument()
    await user.click(
      within(chip).getByRole('button', { name: 'Stop concentrating on Bless' }),
    )
    expect(active().play.concentration).toBeNull()
  })
})

describe('the rests', () => {
  it('takes a long rest: confirms the effects, and records the rest in the history', async () => {
    const user = userEvent.setup()
    const c = seed()
    seed({
      play: {
        ...c.play,
        damage: 9,
        tempHp: 4,
        exhaustion: 2,
        slotsSpent: [2],
        hitDiceSpent: { d8: 3 },
      },
    })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Long rest' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Half of your total hit dice', { exact: false }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/Hit dice regained now: 1 d8/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirm long rest' }))
    expect(active().play).toMatchObject({
      damage: 0,
      tempHp: 0,
      exhaustion: 1,
      slotsSpent: [],
      hitDiceSpent: { d8: 2 },
    })
    expect(active().history.at(-1)?.action).toEqual({ type: 'rest', rest: 'long' })
  })

  it('regains every spent die in the 2024 rules, and warns at 0 hit points', async () => {
    const user = userEvent.setup()
    const c = seed({
      classes: [{ name: 'Fighter', source: 'XPHB', level: 3 }],
      selectedBooks: ['XPHB'],
    })
    seed({
      classes: [{ name: 'Fighter', source: 'XPHB', level: 3 }],
      selectedBooks: ['XPHB'],
      play: { ...c.play, damage: 999, hitDiceSpent: { d8: 3 } },
    })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Long rest' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/at least 1 hit point to start/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirm long rest' }))
    expect(active().play.hitDiceSpent).toEqual({ d8: 0 })
    expect(active().play.damage).toBe(0)
  })

  it('cancels without changing anything', async () => {
    const user = userEvent.setup()
    const c = seed()
    seed({ play: { ...c.play, damage: 5 } })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Long rest' }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    )
    expect(active().play.damage).toBe(5)
  })

  it('spends hit dice in a short rest with a roll the player enters, and heals', async () => {
    const user = userEvent.setup()
    const c = seed()
    seed({ play: { ...c.play, damage: 12 } })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Short rest' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('3 left')).toBeInTheDocument()
    await user.type(
      within(dialog).getByRole('spinbutton', { name: 'My d8 roll' }),
      '5{Enter}',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Spend a d8 hit die with my roll' }),
    )
    expect(within(dialog).getByText('2 left')).toBeInTheDocument()
    const table = within(dialog).getByRole('table', { name: 'Hit points from hit dice' })
    expect(within(table).getByText(/rolled 5, Constitution \+2/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Confirm short rest' }))
    expect(active().play).toMatchObject({ damage: 5, hitDiceSpent: { d8: 1 } })
    expect(active().history.at(-1)?.action).toEqual({
      type: 'rest',
      rest: 'short',
      rolls: [{ die: 'd8', roll: 5, hp: 7 }],
    })
  })

  it('rolls a hit die and can clear the dice again', async () => {
    const user = userEvent.setup()
    const c = seed()
    seed({ play: { ...c.play, damage: 12 } })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Short rest' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Roll a d8 hit die' }))
    expect(
      within(dialog).getByRole('table', { name: 'Hit points from hit dice' }),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Clear the dice' }))
    expect(within(dialog).queryByRole('table')).toBeNull()
    expect(within(dialog).getByText('3 left')).toBeInTheDocument()
  })

  it('restores Pact Magic slots on a short rest', async () => {
    const user = userEvent.setup()
    const c = seed({
      classes: [
        { name: 'Cleric', source: 'PHB', level: 3 },
        { name: 'Warlock', source: 'PHB', level: 2 },
      ],
    })
    seed({
      classes: c.classes,
      play: { ...c.play, pactSpent: 2, slotsSpent: [1] },
    })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Short rest' }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Confirm short rest',
      }),
    )
    expect(active().play).toMatchObject({ pactSpent: 0, slotsSpent: [1] })
  })
})
