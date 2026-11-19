import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetView } from './SheetView'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { checkRolls } from '../../character/rollHistory'
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
import { FIGHTER, ITEMS, loadedClass, stack } from '../../test/derivedFixtures'

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

const cleric: LoadedClass = loadedClass('Cleric', [], [])
cleric.entry.spellcastingAbility = 'wis'
cleric.entry.casterProgression = 'full'
cleric.entry.cantripProgression = [3, 3, 3]
cleric.entry.preparedSpells = '<$level$> + <$wis_mod$>'

function seed(patch: Partial<Character> = {}) {
  const c = createCharacter('Tordek')
  c.classes = [{ name: 'Fighter', source: 'PHB', level: 3 }]
  c.equipment.items = [stack('Longsword')]
  Object.assign(c, patch)
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
  })
}

const rolls = () => {
  const { activeId, characters } = useCharacterStore.getState()
  return checkRolls(characters[activeId ?? ''].history)
}
const active = () => {
  const { activeId, characters } = useCharacterStore.getState()
  return characters[activeId ?? '']
}

/** The dice the next rolls show, in order: a die showing `face` is the byte `face - 1`. */
function showDice(...faces: number[]) {
  const queue = [...faces]
  return vi.spyOn(crypto, 'getRandomValues').mockImplementation(((buf: Uint8Array) => {
    buf[0] = (queue.shift() ?? 1) - 1
    return buf
  }) as typeof crypto.getRandomValues)
}

/** The number a roll button reads from its name: "Roll Stealth check, +5" is 5. */
const modOf = (button: HTMLElement) =>
  Number(/, ([+-]\d+)$/.exec(button.getAttribute('aria-label') ?? '')?.[1])

const original = window.matchMedia
function setPhone() {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: true,
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

// A whole sheet is rendered for each test; under the coverage run that is slow.
vi.setConfig({ testTimeout: 20000 })

/** The roll window. */
const dialog = () => screen.getByRole('dialog')

type User = ReturnType<typeof userEvent.setup>

/** Lets the dice tumble and land. */
const land = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(1100)
  })

/** Clicks Roll in the window and lets the dice tumble and land. */
async function rollIt(user: User) {
  await user.click(within(dialog()).getByRole('button', { name: /^Roll( again)?$/ }))
  await land()
}

/** Opens the window of a roll by its name, as "Roll Stealth check, +2" is read. */
async function openRoll(user: User, name: RegExp) {
  await user.click(await screen.findByRole('button', { name }))
  return dialog()
}

const closeIt = (user: User) =>
  user.click(within(dialog()).getByRole('button', { name: 'Close' }))

let user: User

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([FIGHTER, cleric])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  vi.mocked(loadClassOptions).mockResolvedValue([])
  vi.mocked(loadLanguages).mockResolvedValue([])
  vi.mocked(loadItems).mockResolvedValue(ITEMS)
  vi.mocked(loadSpells).mockResolvedValue([])
  vi.mocked(loadBeasts).mockResolvedValue([])
  vi.mocked(loadConditions).mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

afterEach(() => {
  window.matchMedia = original
  vi.useRealTimers()
})

describe('opening the roll window from a number of the sheet', () => {
  it('opens from a skill with how it adds up, rolls it and records it', async () => {
    seed()
    renderSheet()
    const button = await screen.findByRole('button', { name: /^Roll Stealth check, / })
    const mod = modOf(button)
    await user.click(button)
    const win = within(dialog())
    expect(win.getByRole('heading', { name: 'Stealth check' })).toBeInTheDocument()
    expect(win.getByRole('region', { name: 'How it adds up' })).toBeInTheDocument()
    expect(win.getByRole('radio', { name: 'Normal' })).toBeChecked()
    expect(rolls()).toHaveLength(0)

    const spy = showDice(14)
    await rollIt(user)
    spy.mockRestore()
    expect(win.getByLabelText(`Total ${14 + mod}`)).toBeInTheDocument()
    expect(rolls()).toHaveLength(1)
    expect(rolls()[0]).toMatchObject({
      stream: 'check',
      kind: 'check',
      label: 'Stealth check',
      mode: 'normal',
      modifier: mod,
      total: 14 + mod,
      dice: [{ sides: 20, rolls: [14], dropped: [] }],
    })
    expect(rolls()[0].parts?.length).toBeGreaterThan(0)
    const entry = active().history[active().history.length - 1]
    expect(entry).toMatchObject({ by: 'device', action: { type: 'roll' } })
  })

  it('opens from the keyboard with Enter', async () => {
    seed()
    renderSheet()
    const button = await screen.findByRole('button', { name: /^Roll Stealth check, / })
    button.focus()
    await user.keyboard('{Enter}')
    expect(dialog()).toBeInTheDocument()
  })

  it('opens the breakdown from the info button, and not the roll window', async () => {
    seed()
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'How Stealth adds up' }))
    expect(screen.queryByRole('radio', { name: 'Advantage' })).not.toBeInTheDocument()
    expect(rolls()).toHaveLength(0)
  })

  it('opens from the box of an ability, apart from its breakdown', async () => {
    seed()
    renderSheet()
    const box = await screen.findByRole('group', { name: 'Strength' })
    const button = within(box).getByRole('button', { name: /^Roll Strength check, / })
    await user.click(button)
    const spy = showDice(10)
    await rollIt(user)
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({
      label: 'Strength check',
      total: 10 + modOf(button),
    })
    await closeIt(user)
    expect(
      within(box).getByRole('button', { name: 'How Strength adds up' }),
    ).toBeVisible()
  })

  it('rolls a saving throw and initiative', async () => {
    seed()
    renderSheet()
    const save = await screen.findByRole('button', { name: /^Roll Strength save, / })
    const initiative = screen.getByRole('button', { name: /^Roll Initiative, / })
    const spy = showDice(8, 19)
    await user.click(save)
    await rollIt(user)
    await closeIt(user)
    await user.click(initiative)
    await rollIt(user)
    spy.mockRestore()
    expect(rolls().map((r) => [r.label, r.total])).toEqual([
      ['Strength save', 8 + modOf(save)],
      ['Initiative', 19 + modOf(initiative)],
    ])
  })

  it('rolls a spell attack', async () => {
    seed({
      classes: [{ name: 'Cleric', source: 'PHB', level: 3 }],
      equipment: { ...createCharacter().equipment, items: [] },
    })
    renderSheet()
    await user.click(await screen.findByRole('tab', { name: 'Spells' }))
    const button = await screen.findByRole('button', {
      name: /^Roll Cleric spell attack, /,
    })
    await user.click(button)
    const spy = showDice(11)
    await rollIt(user)
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({
      label: 'Cleric spell attack',
      total: 11 + modOf(button),
    })
  })
})

describe('mode and the situational bonus', () => {
  it('takes the higher of two dice with advantage; Normal again on the next open', async () => {
    seed()
    renderSheet()
    const button = await screen.findByRole('button', { name: /^Roll Stealth check, / })
    await user.click(button)
    await user.click(screen.getByRole('radio', { name: 'Advantage' }))
    const spy = showDice(6, 17)
    await rollIt(user)
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({
      mode: 'advantage',
      dice: [{ rolls: [6, 17], dropped: [0] }],
      total: 17 + modOf(button),
    })
    expect(within(dialog()).getAllByText('Advantage').length).toBeGreaterThan(0)
    expect(within(dialog()).getAllByText(/dropped/).length).toBeGreaterThan(0)
    await closeIt(user)
    await user.click(button)
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked()
  })

  it('takes the lower of two dice with disadvantage', async () => {
    seed()
    renderSheet()
    await openRoll(user, /^Roll Stealth check, /)
    await user.click(screen.getByRole('radio', { name: 'Disadvantage' }))
    const spy = showDice(6, 17)
    await rollIt(user)
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({
      mode: 'disadvantage',
      dice: [{ rolls: [6, 17], dropped: [1] }],
    })
  })

  it('adds a situational bonus of dice, kept on the record', async () => {
    seed()
    renderSheet()
    const button = await screen.findByRole('button', { name: /^Roll Stealth check, / })
    await user.click(button)
    await user.type(screen.getByLabelText('Situational bonus'), '+1d4')
    const spy = showDice(10, 3)
    await rollIt(user)
    spy.mockRestore()
    const [record] = rolls()
    expect(record.total).toBe(10 + 3 + modOf(button))
    expect(record.bonus).toBe('+1d4')
    expect(record.dice).toHaveLength(2)
    expect(within(dialog()).getByText(/Situational bonus: \+1d4/)).toBeInTheDocument()
  })

  it('says what is wrong with a bonus and will not roll it', async () => {
    seed()
    renderSheet()
    await openRoll(user, /^Roll Stealth check, /)
    await user.type(screen.getByLabelText('Situational bonus'), 'banana')
    expect(within(dialog()).getByRole('button', { name: 'Roll' })).toBeDisabled()
    expect(rolls()).toHaveLength(0)
  })

  it('rolls again from the same window, as a second record', async () => {
    seed()
    renderSheet()
    await openRoll(user, /^Roll Stealth check, /)
    await rollIt(user)
    await rollIt(user)
    expect(rolls()).toHaveLength(2)
  })
})

describe('an attack', () => {
  it('rolls the to-hit and the damage together, doubling the dice on a natural 20', async () => {
    seed()
    renderSheet()
    const attacks = await screen.findByRole('table', { name: 'Attacks' })
    await user.click(
      await within(attacks).findByRole('button', { name: /^Roll Longsword attack, / }),
    )
    const spy = showDice(20, 3, 6)
    await rollIt(user)
    spy.mockRestore()
    expect(within(dialog()).getByText('Natural 20')).toBeInTheDocument()
    const [attack, damage] = rolls()
    expect(attack).toMatchObject({ label: 'Longsword attack', natural: 20 })
    expect(damage).toMatchObject({
      label: 'Longsword critical damage',
      critical: true,
      dice: [{ sides: 8, rolls: [3, 6] }],
    })
    expect(damage.total).toBe(9 + damage.modifier)
    expect(within(dialog()).getAllByText(/extra \(critical\)/).length).toBeGreaterThan(0)
  })

  it('rolls damage and critical damage on their own, with extra damage', async () => {
    seed()
    renderSheet()
    const attacks = await screen.findByRole('table', { name: 'Attacks' })
    await user.click(
      await within(attacks).findByRole('button', { name: /^Roll Longsword attack, / }),
    )
    await user.type(screen.getByLabelText('Extra damage'), '+1d6')
    const plain = showDice(4, 2)
    await user.click(within(dialog()).getByRole('button', { name: 'Roll damage' }))
    await land()
    plain.mockRestore()
    const crit = showDice(3, 6, 1, 5)
    await user.click(
      within(dialog()).getByRole('button', { name: 'Roll critical damage' }),
    )
    await land()
    crit.mockRestore()
    const [damage, critical] = rolls()
    expect(damage).toMatchObject({ label: 'Longsword damage', bonus: '+1d6' })
    expect(damage.critical).toBeUndefined()
    expect(critical).toMatchObject({ label: 'Longsword critical damage', critical: true })
    expect(critical.dice[0].rolls).toEqual([3, 6])
  })
})

describe('the Dice tab and the free roll', () => {
  it('opens a Free roll for what is typed and says what cannot be rolled', async () => {
    seed()
    renderSheet()
    await user.click(await screen.findByRole('tab', { name: 'Dice' }))
    expect(screen.getByText(/Nothing rolled yet/)).toBeInTheDocument()

    const field = screen.getByRole('textbox', { name: 'Dice to roll' })
    await user.type(field, 'banana')
    await user.click(screen.getByRole('button', { name: 'Roll' }))
    expect(screen.getByText(/"banana" is not a roll/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.clear(field)
    await user.type(field, '2d6 + 3')
    expect(screen.queryByText(/is not a roll/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Roll' }))
    const win = within(dialog())
    expect(win.getByRole('heading', { name: 'Free roll' })).toBeInTheDocument()
    expect(win.queryByRole('region', { name: 'How it adds up' })).not.toBeInTheDocument()
    expect(win.queryByRole('radio', { name: 'Advantage' })).not.toBeInTheDocument()
    const spy = showDice(2, 5)
    await rollIt(user)
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({
      label: 'Free roll',
      expression: '2d6+3',
      modifier: 3,
      total: 10,
    })
    await closeIt(user)
    const log = screen.getByRole('region', { name: 'Roll log' })
    expect(within(log).getByText('Free roll')).toBeInTheDocument()
    expect(within(log).getByLabelText('Total 10')).toBeInTheDocument()
  })

  it('offers the mode only for a single d20', async () => {
    seed()
    renderSheet()
    await user.click(await screen.findByRole('tab', { name: 'Dice' }))
    const quick = screen.getByRole('group', { name: 'Quick dice' })
    expect(within(quick).getAllByRole('button')).toHaveLength(7)
    await user.click(within(quick).getByRole('button', { name: 'Roll a d4' }))
    expect(screen.queryByRole('radio', { name: 'Advantage' })).not.toBeInTheDocument()
    await closeIt(user)
    await user.click(within(quick).getByRole('button', { name: 'Roll a d20' }))
    await user.click(screen.getByRole('radio', { name: 'Advantage' }))
    const spy = showDice(3, 16)
    await rollIt(user)
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({ expression: '1d20', total: 16, mode: 'advantage' })
  })

  it('rolls a d100 as a percent', async () => {
    seed()
    renderSheet()
    await user.click(await screen.findByRole('tab', { name: 'Dice' }))
    await user.click(screen.getByRole('button', { name: 'Roll a d100' }))
    const spy = showDice(70)
    await rollIt(user)
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({ expression: '1d100', total: 70 })
  })

  it('lists the rolls newest first, with the dropped die and the marks', async () => {
    seed()
    renderSheet()
    await openRoll(user, /^Roll Stealth check, /)
    await user.click(screen.getByRole('radio', { name: 'Disadvantage' }))
    const spy = showDice(2, 20, 20, 1)
    await rollIt(user)
    await user.click(screen.getByRole('radio', { name: 'Normal' }))
    await rollIt(user)
    await rollIt(user)
    spy.mockRestore()
    await closeIt(user)
    await user.click(screen.getByRole('tab', { name: 'Dice' }))
    const log = screen.getByRole('region', { name: 'Roll log' })
    const items = within(log).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByText('Natural 1')).toBeInTheDocument()
    expect(within(items[1]).getByText('Natural 20')).toBeInTheDocument()
    expect(within(items[2]).getByText('Disadvantage')).toBeInTheDocument()
    expect(within(items[2]).getByText(/dropped/)).toBeInTheDocument()
  })
})

describe('the dice customizer in the roll window', () => {
  it('shows the look, saves a preset on this device and resets', async () => {
    seed()
    renderSheet()
    await openRoll(user, /^Roll Stealth check, /)
    await user.click(within(dialog()).getByRole('button', { name: 'Dice' }))
    const win = within(dialog())
    expect(win.getByText(/not part of the character/)).toBeInTheDocument()
    await user.click(win.getByRole('button', { name: 'Obsidian' }))
    expect(win.getByRole('button', { name: 'Obsidian' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(localStorage.getItem('cc-dice-look')).not.toBeNull()
    await user.click(win.getByRole('button', { name: 'Reset to default' }))
    expect(win.getByRole('button', { name: 'Classic ivory' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(localStorage.getItem('cc-dice-look')).toBeNull()
    await user.click(win.getByRole('button', { name: 'Back to the roll' }))
    expect(win.getByRole('button', { name: 'Roll' })).toBeVisible()
  })

  it('keeps a look chosen for the next time the sheet is opened', async () => {
    seed()
    const first = renderSheet()
    await openRoll(user, /^Roll Stealth check, /)
    await user.click(within(dialog()).getByRole('button', { name: 'Dice' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Frost' }))
    first.unmount()
    renderSheet()
    await openRoll(user, /^Roll Stealth check, /)
    await user.click(within(dialog()).getByRole('button', { name: 'Dice' }))
    expect(within(dialog()).getByRole('button', { name: 'Frost' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('says so when the number color is changed to stay readable', async () => {
    seed()
    renderSheet()
    await openRoll(user, /^Roll Stealth check, /)
    await user.click(within(dialog()).getByRole('button', { name: 'Dice' }))
    fireEvent.change(screen.getByLabelText('Body color'), {
      target: { value: '#808080' },
    })
    fireEvent.change(screen.getByLabelText('Number color'), {
      target: { value: '#808080' },
    })
    expect(screen.getByText(/number color was changed to/)).toBeInTheDocument()
  })

  it('changes the finish and the glow', async () => {
    seed()
    renderSheet()
    await openRoll(user, /^Roll Stealth check, /)
    await user.click(within(dialog()).getByRole('button', { name: 'Dice' }))
    await user.selectOptions(screen.getByLabelText('Finish'), 'Starry')
    await user.click(screen.getByRole('checkbox', { name: 'Glow' }))
    const saved = JSON.parse(localStorage.getItem('cc-dice-look') ?? '{}')
    expect(saved).toMatchObject({ finish: 'starry' })
  })
})

describe('reduced motion', () => {
  it('lands the dice at once, with no tumble', async () => {
    setPhone()
    seed()
    renderSheet()
    await user.click(await screen.findByRole('tab', { name: 'Skills' }))
    await openRoll(user, /^Roll Stealth check, /)
    const spy = showDice(9)
    await user.click(within(dialog()).getByRole('button', { name: 'Roll' }))
    spy.mockRestore()
    expect(within(dialog()).getByLabelText(/^Total /)).toBeInTheDocument()
    expect(dialog().querySelector('.dice-tray--still')).not.toBeNull()
  })
})

describe('the animation', () => {
  it('tumbles, then lands on the result computed before it', async () => {
    seed()
    renderSheet()
    const button = await screen.findByRole('button', { name: /^Roll Stealth check, / })
    await user.click(button)
    const spy = showDice(12)
    await user.click(within(dialog()).getByRole('button', { name: 'Roll' }))
    spy.mockRestore()
    expect(rolls()).toHaveLength(1)
    expect(dialog().querySelector('.dice-tray__die--rolling')).not.toBeNull()
    expect(within(dialog()).queryByLabelText(/^Total /)).not.toBeInTheDocument()
    expect(within(dialog()).getByRole('button', { name: 'Roll again' })).toBeDisabled()
    await land()
    expect(dialog().querySelector('.dice-tray__die--landed')).not.toBeNull()
    expect(
      within(dialog()).getByLabelText(`Total ${12 + modOf(button)}`),
    ).toBeInTheDocument()
  })
})

describe('death saving throws', () => {
  const dying = () => {
    const c = createCharacter('Tordek')
    c.classes = [{ name: 'Fighter', source: 'PHB', level: 1 }]
    c.play = { ...c.play, damage: 999 }
    return c
  }

  it('is offered only while dying, and marks what it rolls', async () => {
    seed({ play: dying().play })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Roll death save' }))
    expect(within(dialog()).getByLabelText('Situational bonus')).toBeInTheDocument()
    const spy = showDice(14, 6, 1)
    await rollIt(user)
    expect(active().play.deathSaves).toEqual({ successes: 1, failures: 0 })
    await rollIt(user)
    expect(active().play.deathSaves).toEqual({ successes: 1, failures: 1 })
    await rollIt(user)
    spy.mockRestore()
    expect(active().play.deathSaves).toEqual({ successes: 1, failures: 3 })
    expect(rolls().map((r) => r.label)).toEqual(Array(3).fill('Death saving throw'))
  })

  it('brings the character back to 1 hit point on a natural 20', async () => {
    seed({ play: dying().play })
    renderSheet()
    await user.click(await screen.findByRole('button', { name: 'Roll death save' }))
    const spy = showDice(20)
    await rollIt(user)
    spy.mockRestore()
    await closeIt(user)
    expect(
      screen.queryByRole('button', { name: 'Roll death save' }),
    ).not.toBeInTheDocument()
    expect(active().play.damage).toBeLessThan(999)
  })

  it('is not offered to a character with hit points', async () => {
    seed()
    renderSheet()
    await screen.findByRole('group', { name: 'Hit points' })
    expect(
      screen.queryByRole('button', { name: 'Roll death save' }),
    ).not.toBeInTheDocument()
  })
})

describe('on a phone', () => {
  it('rolls from the Skills tab', async () => {
    setPhone()
    seed()
    renderSheet()
    await user.click(await screen.findByRole('tab', { name: 'Skills' }))
    await user.click(screen.getByRole('button', { name: /^Roll Stealth check, / }))
    const spy = showDice(13)
    await user.click(within(dialog()).getByRole('button', { name: 'Roll' }))
    spy.mockRestore()
    expect(within(dialog()).getByLabelText(/^Total /)).toBeInTheDocument()
    expect(rolls()).toHaveLength(1)
  })
})
