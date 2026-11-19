import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetView } from './SheetView'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { checkRolls } from '../../character/rollHistory'
import { createCharacter } from '../../character/model'
import { loadClasses, type LoadedClass } from '../../data/class'
import { loadBackgrounds } from '../../data/background'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'
import { loadItems } from '../../data/items'
import { loadSpells, type Spell } from '../../data/spells'
import { loadBeasts } from '../../data/beasts'
import { loadConditions } from '../../data/conditions'
import { loadClassOptions } from '../../data/classOptions'
import { loadLanguages } from '../../data/languages'
import { FIGHTER, ITEMS, loadedClass, stack } from '../../test/derivedFixtures'
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

const spell = (name: string, level: number, over: Partial<Spell>) =>
  makeSpell({
    name,
    source: 'PHB',
    level,
    lists: listsOf('Cleric|PHB'),
    entries: [`${name} text.`],
    ...over,
  })

const higher = (text: string) => [
  { type: 'entries', name: 'At Higher Levels', entries: [text] },
]

/** The spells as the loader reads them from the books (2014 wording unless named). */
const SPELLS = {
  fireBolt: spell('Fire Bolt', 0, {
    attack: 'Ranged',
    damageParts: [{ roll: '1d10', type: 'fire' }],
    cantripDice: [
      {
        label: 'fire damage',
        tiers: [
          { level: 1, dice: '1d10' },
          { level: 5, dice: '2d10' },
          { level: 11, dice: '3d10' },
          { level: 17, dice: '4d10' },
        ],
      },
    ],
  }),
  sacredFlame: spell('Sacred Flame', 0, {
    save: ['Dexterity'],
    damageParts: [{ roll: '1d8', type: 'radiant' }],
    cantripDice: [
      {
        label: 'radiant damage',
        tiers: [
          { level: 1, dice: '1d8' },
          { level: 5, dice: '2d8' },
        ],
      },
    ],
  }),
  fireball: spell('Fireball', 3, {
    save: ['Dexterity'],
    damageParts: [{ roll: '8d6', type: 'fire' }],
    entriesHigherLevel: higher(
      'the damage increases by {@scaledamage 8d6|3-9|1d6} for each slot level above 3rd.',
    ),
  }),
  magicMissile: spell('Magic Missile', 1, {
    damageParts: [{ roll: '1d4 + 1', type: 'force' }],
    entries: [
      'You create three glowing darts. A dart deals {@damage 1d4 + 1} force damage.',
    ],
    entriesHigherLevel: higher(
      'the spell creates one more dart for each slot level above 1st.',
    ),
  }),
  cureWounds: spell('Cure Wounds', 1, {
    healing: '1d8 + spellcasting modifier',
    entriesHigherLevel: higher(
      'the healing increases by {@scaledice 1d8|1-9|1d8} for each slot level above 1st.',
    ),
  }),
  cureWounds2024: spell('Cure Wounds', 1, {
    source: 'XPHB',
    edition: 'one',
    healing: '2d8 + spellcasting modifier',
    entriesHigherLevel: higher(
      'The healing increases by {@scaledice 2d8|1-9|2d8} for each spell slot level above 1.',
    ),
  }),
  iceStorm: spell('Ice Storm', 4, {
    save: ['Dexterity'],
    damageParts: [
      { roll: '2d8', type: 'bludgeoning' },
      { roll: '4d6', type: 'cold' },
    ],
  }),
  eldritchBlast: spell('Eldritch Blast', 0, {
    attack: 'Ranged',
    damageParts: [{ roll: '1d10', type: 'force' }],
    entries: [
      'On a hit, the target takes {@damage 1d10} force damage.',
      'two beams at 5th level, three beams at 11th level, and four beams at 17th level.',
    ],
  }),
  tollTheDead: spell('Toll the Dead', 0, {
    save: ['Wisdom'],
    damageParts: [{ roll: '1d8', type: 'necrotic' }],
    cantripDice: [
      {
        label: 'necrotic damage',
        tiers: [
          { level: 1, dice: '1d8' },
          { level: 5, dice: '2d8' },
        ],
      },
      {
        label: 'necrotic damage to wounded creature',
        tiers: [
          { level: 1, dice: '1d12' },
          { level: 5, dice: '2d12' },
        ],
      },
    ],
  }),
  bless: spell('Bless', 1, { concentration: true }),
}

type Name = keyof typeof SPELLS

const pick = (key: Name) => ({
  name: SPELLS[key].name,
  source: SPELLS[key].source,
  level: SPELLS[key].level,
})

function seed(level: number, picked: Name[]) {
  const c = createCharacter('Tordek')
  c.classes = [{ name: 'Cleric', source: 'PHB', level }]
  c.abilities = { ...c.abilities, wis: { base: 16, other: 0 } }
  c.equipment.items = [stack('Longsword')]
  c.spells = {
    'Cleric|PHB': {
      cantrips: picked.filter((k) => SPELLS[k].level === 0).map(pick),
      spells: picked.filter((k) => SPELLS[k].level > 0).map(pick),
    },
  }
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'sheet',
  })
  vi.mocked(loadSpells).mockResolvedValue(picked.map((k) => SPELLS[k]))
}

const rolls = () => {
  const { activeId, characters } = useCharacterStore.getState()
  return checkRolls(characters[activeId ?? ''].history)
}

/** The dice the next rolls show, in order: a die showing `face` is the byte `face - 1`. */
function showDice(...faces: number[]) {
  const queue = [...faces]
  return vi.spyOn(crypto, 'getRandomValues').mockImplementation(((buf: Uint8Array) => {
    buf[0] = (queue.shift() ?? 1) - 1
    return buf
  }) as typeof crypto.getRandomValues)
}

// A whole sheet is rendered for each test; under the coverage run that is slow.
vi.setConfig({ testTimeout: 20000 })

const dialog = () => screen.getByRole('dialog')
type User = ReturnType<typeof userEvent.setup>
const land = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(1100)
  })

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
  vi.useRealTimers()
})

function renderSheet() {
  return render(
    <ThemeProvider>
      <SheetView />
    </ThemeProvider>,
  )
}

async function spellsTable() {
  renderSheet()
  await user.click(await screen.findByRole('tab', { name: 'Spells' }))
  return screen.findByRole('table', { name: 'Your spells' })
}

async function openSpell(name: RegExp) {
  const table = await spellsTable()
  await user.click(await within(table).findByRole('button', { name }))
  return within(dialog())
}

async function press(name: string) {
  await user.click(within(dialog()).getByRole('button', { name }))
  await land()
}

describe('a spell attack cantrip (Fire Bolt)', () => {
  it('rolls to hit, then damage at the character level, typed, doubled on a critical', async () => {
    seed(7, ['fireBolt'])
    const win = await openSpell(/^Roll Fire Bolt attack, /)
    expect(win.getByRole('button', { name: 'Roll to hit' })).toBeEnabled()
    expect(win.getByText('Rolls 2d10 fire')).toBeInTheDocument()
    const spy = showDice(20, 4, 9, 2, 8)
    await press('Roll to hit')
    expect(win.getByRole('switch', { name: 'Critical' })).toBeChecked()
    await press('Roll critical damage')
    spy.mockRestore()
    const [attack, damage] = rolls()
    expect(attack).toMatchObject({ label: 'Fire Bolt attack', natural: 20 })
    expect(damage).toMatchObject({
      label: 'Fire Bolt critical damage',
      critical: true,
      dice: [{ sides: 10, type: 'fire', rolls: [4, 9, 2, 8] }],
      total: 23,
    })
  })

  it('grows with the level: 3d10 at 11th', async () => {
    seed(11, ['fireBolt'])
    const win = await openSpell(/^Roll Fire Bolt attack, /)
    expect(win.getByText('Rolls 3d10 fire')).toBeInTheDocument()
  })
})

describe('a save cantrip (Sacred Flame)', () => {
  it('says the save and its DC and rolls only damage', async () => {
    seed(5, ['sacredFlame'])
    const win = await openSpell(/^Roll Sacred Flame damage$/)
    // The DC is an abbreviation with a tooltip, so the line is several elements.
    expect(
      win.getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          /^Targets make a Dexterity saving throw against DC \d+\.$/.test(
            el.textContent ?? '',
          ),
      ),
    ).toBeInTheDocument()
    expect(win.queryByRole('button', { name: 'Roll to hit' })).not.toBeInTheDocument()
    expect(win.queryByRole('switch', { name: 'Critical' })).not.toBeInTheDocument()
    const spy = showDice(3, 7)
    await press('Roll damage')
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({
      label: 'Sacred Flame damage',
      dice: [{ sides: 8, type: 'radiant', rolls: [3, 7] }],
      total: 10,
    })
  })
})

describe('a leveled save spell (Fireball)', () => {
  it('casts at a higher level the character has a slot for, and records the level', async () => {
    seed(7, ['fireball'])
    const win = await openSpell(/^Roll Fireball damage$/)
    const select = win.getByRole('combobox', { name: 'Cast at level' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['3rd level', '4th level'])
    expect(select).toHaveValue('3')
    expect(win.getByText('Rolls 8d6 fire')).toBeInTheDocument()
    await user.selectOptions(select, '4')
    expect(win.getByText('Rolls 9d6 fire')).toBeInTheDocument()
    const spy = showDice(6, 6, 6, 6, 6, 6, 6, 6, 6)
    await press('Roll damage')
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({ label: 'Fireball damage (level 4)', total: 54 })
  })
})

describe('an auto-hit spell (Magic Missile)', () => {
  it('rolls every dart together, with more darts from a higher slot', async () => {
    seed(7, ['magicMissile'])
    const win = await openSpell(/^Roll Magic Missile damage$/)
    expect(win.getByText('3 darts, rolled together.')).toBeInTheDocument()
    await user.selectOptions(win.getByRole('combobox', { name: 'Cast at level' }), '3')
    expect(win.getByText('Rolls 5d4 + 5 force')).toBeInTheDocument()
    const spy = showDice(1, 2, 3, 4, 1)
    await press('Roll damage')
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({
      label: 'Magic Missile damage (level 3)',
      total: 16,
      modifier: 5,
    })
  })
})

describe('healing (Cure Wounds)', () => {
  it('rolls the 2014 die plus the spellcasting modifier as healing', async () => {
    seed(7, ['cureWounds'])
    const win = await openSpell(/^Roll Cure Wounds healing$/)
    expect(win.getByRole('button', { name: 'Roll healing' })).toBeEnabled()
    const spy = showDice(5)
    await press('Roll healing')
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({
      label: 'Cure Wounds healing (level 1)',
      dice: [{ sides: 8, type: 'healing', rolls: [5] }],
      modifier: 3,
      total: 8,
    })
  })

  it('rolls 2d8 in the 2024 wording, and more from a higher slot', async () => {
    seed(7, ['cureWounds2024'])
    const win = await openSpell(/^Roll Cure Wounds healing$/)
    expect(win.getByText('Rolls 2d8 + 3 healing')).toBeInTheDocument()
    await user.selectOptions(win.getByRole('combobox', { name: 'Cast at level' }), '2')
    expect(win.getByText('Rolls 4d8 + 3 healing')).toBeInTheDocument()
  })
})

describe('a spell of two damage types (Ice Storm)', () => {
  it('rolls both as separate typed parts of one result', async () => {
    seed(9, ['iceStorm'])
    const win = await openSpell(/^Roll Ice Storm damage$/)
    expect(win.getByText('Rolls 2d8 bludgeoning + 4d6 cold')).toBeInTheDocument()
    const spy = showDice(3, 4, 1, 2, 3, 4)
    await press('Roll damage')
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({
      label: 'Ice Storm damage (level 4)',
      total: 17,
      typed: [
        { type: 'bludgeoning', total: 7 },
        { type: 'cold', total: 10 },
      ],
    })
    expect(win.getByText('bludgeoning 7, cold 10')).toBeInTheDocument()
  })
})

describe('Eldritch Blast', () => {
  it('rolls one beam for each attack, and says how many beams there are', async () => {
    seed(7, ['eldritchBlast'])
    const win = await openSpell(/^Roll Eldritch Blast attack, /)
    expect(
      win.getByText(
        '2 beams at this level: make an attack roll and a damage roll for each.',
      ),
    ).toBeInTheDocument()
    expect(win.getByText('Rolls 1d10 force')).toBeInTheDocument()
  })
})

describe('Toll the Dead', () => {
  it('lets the player choose the damage die: the target is wounded or not', async () => {
    seed(7, ['tollTheDead'])
    const win = await openSpell(/^Roll Toll the Dead damage$/)
    expect(win.getByText('Rolls 2d8 necrotic')).toBeInTheDocument()
    await user.click(
      win.getByRole('radio', { name: 'Necrotic damage to wounded creature' }),
    )
    expect(win.getByText('Rolls 2d12 necrotic')).toBeInTheDocument()
    const spy = showDice(10, 12)
    await press('Roll damage')
    spy.mockRestore()
    expect(rolls()[0]).toMatchObject({
      label: 'Toll the Dead damage (necrotic damage to wounded creature)',
      total: 22,
    })
  })
})

describe('the rows of the Spells tab', () => {
  it('opens no roll for a spell with no dice, and keeps the full text one click away', async () => {
    seed(7, ['bless', 'fireBolt'])
    const table = await spellsTable()
    await within(table).findByRole('button', { name: /^Roll Fire Bolt attack/ })
    expect(within(table).queryByRole('button', { name: /^Roll Bless/ })).toBeNull()
    expect(within(table).queryByRole('button', { name: 'Full text of Bless' })).toBeNull()
    await user.click(
      within(table).getByRole('button', { name: 'Full text of Fire Bolt' }),
    )
    expect(await screen.findByText('Fire Bolt text.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Fire Bolt attack' })).toBeNull()
  })
})

describe('a versatile weapon', () => {
  it('offers one hand or two beside Roll damage, one hand first', async () => {
    seed(3, [])
    renderSheet()
    const attacks = await screen.findByRole('table', { name: 'Attacks' })
    await user.click(
      await within(attacks).findByRole('button', { name: /^Roll Longsword attack, / }),
    )
    const win = within(dialog())
    expect(win.getByRole('radio', { name: 'One hand' })).toBeChecked()
    const spy = showDice(7, 9)
    await press('Roll damage')
    await user.click(win.getByRole('radio', { name: 'Two hands' }))
    await press('Roll damage')
    spy.mockRestore()
    const [one, two] = rolls()
    expect(one).toMatchObject({
      label: 'Longsword damage',
      dice: [{ sides: 8, rolls: [7] }],
    })
    expect(two).toMatchObject({
      label: 'Longsword damage (two hands)',
      dice: [{ sides: 10, rolls: [9] }],
    })
  })
})
