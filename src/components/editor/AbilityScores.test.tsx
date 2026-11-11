import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AbilityScores } from './AbilityScores'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { POINT_BUY_MAX, POINT_BUY_MIN } from '../../dice/dice'
import { loadBackgrounds } from '../../data/background'
import { loadClasses } from '../../data/class'
import { loadRaces } from '../../data/race'
import { loadFeats } from '../../data/feats'

// The Feats column resolves feat slots, which loads class, background, race,
// and feat data; feat resolution itself is unit-tested in character/feats.test.ts.
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

function seedActive(mutate: (c: ReturnType<typeof createCharacter>) => void = () => {}) {
  const c = createCharacter('Tordek')
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
      <AbilityScores />
    </ThemeProvider>,
  )
}

function active(id: string) {
  return useCharacterStore.getState().characters[id]
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(loadClasses).mockResolvedValue([])
  vi.mocked(loadBackgrounds).mockResolvedValue([])
  vi.mocked(loadRaces).mockResolvedValue([])
  vi.mocked(loadFeats).mockResolvedValue([])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

describe('AbilityScores', () => {
  it('renders nothing without an active character', async () => {
    // The data still loads; let it settle so its state updates land inside act().
    const { container } = await act(async () => renderSection())
    expect(container).toBeEmptyDOMElement()
  })

  it('assigns a pooled score from the dropdown, clears it, and edits the other bonus', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.statMethod = 'array'
      ch.statPool = [15, 14, 13, 12, 10, 8]
    })
    renderSection()

    // Any score of the pool can be picked, not just the highest.
    const str = screen.getByLabelText('Strength base score')
    await user.selectOptions(str, '10')
    await waitFor(() => expect(active(c.id).abilities.str.base).toBe(10))

    // The empty option clears it.
    await user.selectOptions(str, '')
    await waitFor(() => expect(active(c.id).abilities.str.base).toBeNull())

    // A non-numeric "other" entry coerces to 0; a numeric one is stored.
    const other = screen.getByLabelText('Dexterity other bonus')
    await user.clear(other)
    await user.type(other, '2')
    await waitFor(() => expect(active(c.id).abilities.dex.other).toBe(2))
  })

  it('assigns all six scores in any order', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.statMethod = 'array'
      ch.statPool = [15, 14, 13, 12, 10, 8]
    })
    renderSection()

    const picks: [string, string][] = [
      ['Dexterity', '8'],
      ['Constitution', '15'],
      ['Wisdom', '10'],
      ['Strength', '14'],
      ['Charisma', '12'],
      ['Intelligence', '13'],
    ]
    for (const [name, score] of picks)
      await user.selectOptions(screen.getByLabelText(`${name} base score`), score)
    const a = active(c.id).abilities
    expect([
      a.dex.base,
      a.con.base,
      a.wis.base,
      a.str.base,
      a.cha.base,
      a.int.base,
    ]).toEqual([8, 15, 10, 14, 12, 13])
  })

  it('offers each score once: a score held by another ability is not listed', async () => {
    const user = userEvent.setup()
    seedActive((ch) => {
      ch.statMethod = 'array'
      ch.statPool = [15, 14, 13, 12, 10, 8]
      ch.abilities.str.base = 15
    })
    renderSection()

    const options = (name: string) =>
      within(screen.getByLabelText(`${name} base score`))
        .getAllByRole('option')
        .map((o) => o.textContent)
    // Strength keeps its own 15; Dexterity cannot take it.
    expect(options('Strength')).toContain('15')
    expect(options('Dexterity')).not.toContain('15')
    // Reassigning Strength frees the 15 for the others.
    await user.selectOptions(screen.getByLabelText('Strength base score'), '14')
    expect(options('Dexterity')).toContain('15')
    expect(options('Dexterity')).not.toContain('14')
  })

  it('lists duplicate scores of a rolled pool as many times as they were rolled', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.statMethod = 'roll'
      ch.statPool = [14, 14, 10, 9, 8, 7]
    })
    renderSection()

    const dex = screen.getByLabelText('Dexterity base score')
    const fourteens = () =>
      within(dex)
        .getAllByRole('option')
        .filter((o) => o.textContent === '14')
    expect(fourteens()).toHaveLength(2)
    await user.selectOptions(screen.getByLabelText('Strength base score'), '14')
    await user.selectOptions(dex, '14')
    await waitFor(() => expect(active(c.id).abilities.dex.base).toBe(14))
    expect(active(c.id).abilities.str.base).toBe(14)
  })

  it('keeps an assigned score after the section is shown again', async () => {
    const user = userEvent.setup()
    seedActive((ch) => {
      ch.statMethod = 'array'
      ch.statPool = [15, 14, 13, 12, 10, 8]
    })
    const { unmount } = renderSection()
    await user.selectOptions(screen.getByLabelText('Wisdom base score'), '13')
    unmount()
    renderSection()
    expect(screen.getByLabelText('Wisdom base score')).toHaveValue('13')
  })

  it('sets point-buy scores from the scale within budget and bounds', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.statMethod = 'pointbuy'
      for (const k of Object.keys(ch.abilities) as (keyof typeof ch.abilities)[]) {
        ch.abilities[k] = { base: POINT_BUY_MIN, other: 0 }
      }
    })
    renderSection()

    expect(screen.getByText(/points remaining/)).toBeInTheDocument()

    // The scale runs from the floor to the cap: no 16, and the floor is current.
    const group = within(screen.getByRole('radiogroup', { name: 'Strength score' }))
    expect(group.getAllByRole('radio').map((r) => r.nextSibling?.textContent)).toEqual([
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
    ])
    expect(group.queryByRole('radio', { name: '16' })).not.toBeInTheDocument()
    expect(group.getByRole('radio', { name: '8' })).toBeChecked()

    // One click sets the score.
    await user.click(group.getByRole('radio', { name: '15' }))
    await waitFor(() => expect(active(c.id).abilities.str.base).toBe(POINT_BUY_MAX))

    // 9 points are spent, so 27 - 9 = 18 left: Dexterity 15 (9) twice is fine, a third is not.
    const dex = within(screen.getByRole('radiogroup', { name: 'Dexterity score' }))
    await user.click(dex.getByRole('radio', { name: '15' }))
    const con = within(screen.getByRole('radiogroup', { name: 'Constitution score' }))
    await user.click(con.getByRole('radio', { name: '15' }))
    // 27 spent: nothing above the floor is affordable on Intelligence, and the reason says so.
    const int = within(screen.getByRole('radiogroup', { name: 'Intelligence score' }))
    const nine = int.getByRole('radio', { name: '9' })
    expect(nine).toBeDisabled()
    expect(nine.nextElementSibling).toHaveAttribute('title', 'Costs 1 more point, 0 left')

    // A lower score gives points back and stays available.
    await user.click(group.getByRole('radio', { name: '8' }))
    await waitFor(() => expect(active(c.id).abilities.str.base).toBe(POINT_BUY_MIN))
    expect(int.getByRole('radio', { name: '15' })).toBeEnabled()
  })

  it('sets a score from an unset point-buy base', async () => {
    const user = userEvent.setup()
    // Point-buy with the default null bases: the floor shows as current.
    const c = seedActive((ch) => {
      ch.statMethod = 'pointbuy'
    })
    renderSection()

    const group = within(screen.getByRole('radiogroup', { name: 'Strength score' }))
    await user.click(group.getByRole('radio', { name: '9' }))
    await waitFor(() => expect(active(c.id).abilities.str.base).toBe(POINT_BUY_MIN + 1))
  })

  it('resets all scores to the point-buy floor', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.statMethod = 'pointbuy'
      ch.abilities.str = { base: 15, other: 3 }
    })
    renderSection()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(active(c.id).abilities.str.base).toBe(POINT_BUY_MIN))
    expect(active(c.id).abilities.str.other).toBe(0)
  })

  it('flags overspent points and shows the origin bonus badge', async () => {
    seedActive((ch) => {
      ch.statMethod = 'pointbuy'
      // Max every score -> spend far more than the budget -> negative remaining.
      for (const k of Object.keys(ch.abilities) as (keyof typeof ch.abilities)[]) {
        ch.abilities[k] = { base: POINT_BUY_MAX, other: 0 }
      }
      // A racial bonus surfaces the origin badge instead of the em dash.
      ch.race = {
        name: 'Dwarf',
        baseName: 'Dwarf',
        source: 'PHB',
        abilityFixed: { con: 2 },
        abilityChoices: {},
      }
    })
    await act(async () => renderSection())

    // Overspending (6 x max = 54 spent, budget 27) renders in the danger colour.
    const remaining = screen.getByText('-27')
    expect(remaining).toHaveClass('text-danger')
    // The Constitution origin bonus renders as a secondary badge (distinct
    // from the "+2" ability-modifier cells that share the same text).
    const plusTwos = screen.getAllByText('+2')
    expect(plusTwos.some((el) => el.classList.contains('badge'))).toBe(true)
  })

  it('clears pooled scores to empty on reset', async () => {
    const user = userEvent.setup()
    const c = seedActive((ch) => {
      ch.statMethod = 'array'
      ch.statPool = [15, 14, 13, 12, 10, 8]
      ch.abilities.str = { base: 15, other: 0 }
    })
    renderSection()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    // Pool mode resets bases to null rather than the point-buy floor.
    await waitFor(() => expect(active(c.id).abilities.str.base).toBeNull())
  })

  it('adds increases from feat slots in the Feats column', async () => {
    seedActive((ch) => {
      ch.feats = {
        choices: {
          'bonus:a': { kind: 'asi', abilityOption: 0, abilityChoices: { str: 2 } },
        },
        bonusSlots: ['bonus:a'],
      }
    })
    await act(async () => renderSection())

    const row = screen.getByText('Strength').closest('tr')
    if (!row) throw new Error('No Strength row')
    // Name, base, origin, feats: the Ability Score Improvement adds +2.
    expect(within(row).getAllByRole('cell')[3]).toHaveTextContent('+2')
  })
})
