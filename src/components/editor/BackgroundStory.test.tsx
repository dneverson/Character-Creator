import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackgroundStory } from './BackgroundStory'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { useCharacterStore } from '../../character/store'
import { createCharacter } from '../../character/model'
import { rollRecords } from '../../character/rollHistory'
import { settle } from '../../test/settle'
import {
  loadBackgrounds,
  type PlayableBackground,
  type StoryTable,
} from '../../data/background'

vi.mock('../../data/background', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/background')>()),
  loadBackgrounds: vi.fn(),
}))
const mockBackgrounds = vi.mocked(loadBackgrounds)

function storyTable(
  title: string,
  field: StoryTable['field'],
  texts: string[],
  extra: Partial<StoryTable> = {},
): StoryTable {
  return {
    key: title.toLowerCase(),
    title,
    label: title,
    field,
    count: 1,
    die: texts.length,
    rows: texts.map((text, i) => ({ min: i + 1, max: i + 1, text })),
    ...extra,
  }
}

const watch: PlayableBackground = {
  key: 'City Watch|SCAG',
  name: 'City Watch',
  source: 'SCAG',
  abilityOptions: [],
  featGrants: [],
  storyTables: [
    storyTable(
      'Personality Trait',
      'personalityTraits',
      ['I am polite.', 'I am brave.', 'I am loud.', 'I am calm.'],
      { count: 2, from: 'Soldier' },
    ),
    storyTable('Ideal', 'ideals', ['Duty. (Lawful)', 'Freedom. (Chaotic)']),
    storyTable('Beat', 'backstory', ['Docks', 'Market']),
  ],
  entries: [],
}

const sage: PlayableBackground = {
  ...watch,
  key: 'Sage|XPHB',
  name: 'Sage',
  source: 'XPHB',
  edition: 'one',
  storyTables: [],
}

/** Each die in turn shows the next of these values. */
function dice(...values: number[]) {
  let at = 0
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
    // randomInt(1, N) reads one byte and shows 1 + byte % N.
    ;(array as Uint8Array)[0] = values[at++] - 1
    return array
  })
}

function seedActive(background?: PlayableBackground) {
  const c = createCharacter('Tordek')
  if (background)
    c.background = {
      name: background.name,
      source: background.source,
      abilityChoices: {},
    }
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
      <BackgroundStory />
    </ThemeProvider>,
  )
}

const active = (id: string) => useCharacterStore.getState().characters[id]
const story = (id: string) => active(id).story
const storyRolls = (id: string) => rollRecords(active(id).history, 'story')
/** The chooser headed by a table's name. */
const chooser = (heading: string) =>
  screen.getByText(heading, { selector: 'span' }).closest('.border') as HTMLElement

beforeEach(() => {
  localStorage.clear()
  mockBackgrounds.mockResolvedValue([watch, sage])
  useCharacterStore.setState({ characters: {}, order: [], activeId: null, view: 'list' })
})

afterEach(() => vi.restoreAllMocks())

describe('BackgroundStory', () => {
  it('renders nothing without an active character', async () => {
    const { container } = renderSection()
    expect(container).toBeEmptyDOMElement()
    // Still nothing once the backgrounds have loaded.
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('edits the alignment and a narrative field', async () => {
    const user = userEvent.setup()
    const c = seedActive()
    renderSection()

    await user.selectOptions(screen.getByLabelText('Alignment'), 'Chaotic Good')
    await waitFor(() => expect(story(c.id).alignment).toBe('Chaotic Good'))

    await user.type(screen.getByLabelText('Ideals'), 'Freedom')
    await user.tab()
    await waitFor(() => expect(story(c.id).ideals).toBe('Freedom'))
    expect(screen.queryByText(/no suggested characteristics/)).not.toBeInTheDocument()
  })

  it('picks trait rows into the field, then folds the table', async () => {
    const user = userEvent.setup()
    const c = seedActive(watch)
    renderSection()

    // A lent table names the background it is from.
    const traits = await screen.findByText('Personality Trait - from Soldier')
    const box = traits.closest('.border') as HTMLElement
    await user.click(within(box).getByRole('button', { name: /I am loud\./ }))
    await user.click(within(box).getByRole('button', { name: /I am polite\./ }))
    expect(story(c.id).personalityTraits).toBe('I am loud.\nI am polite.')
    expect(screen.getByLabelText('Personality Traits')).toHaveValue(
      'I am loud.\nI am polite.',
    )
    expect(within(box).getByText('2 of 2 from the table')).toBeInTheDocument()
    // The box is tall enough for both lines, and the folded table repeats none of them.
    expect(screen.getByLabelText('Personality Traits')).toHaveAttribute('rows', '2')
    expect(within(box).queryByText('I am loud.')).not.toBeInTheDocument()
    // A pick is a plain edit: no roll recorded.
    expect(storyRolls(c.id)).toEqual([])
  })

  it('grows a field to fit its text', async () => {
    const user = userEvent.setup()
    const c = seedActive(watch)
    renderSection()

    const ideals = await screen.findByLabelText('Ideals')
    expect(ideals).toHaveAttribute('rows', '2')
    await user.click(ideals)
    await user.paste('one\ntwo\nthree\n' + 'x'.repeat(130))
    await user.tab()
    await waitFor(() => expect(story(c.id).ideals).toContain('three'))
    // Three short lines and a 130 character line wrapping onto three more.
    expect(screen.getByLabelText('Ideals')).toHaveAttribute('rows', '6')
  })

  it('records each roll and reroll on a table, and writes a shared field’s line with its title', async () => {
    const user = userEvent.setup()
    const c = seedActive(watch)
    renderSection()

    await screen.findByText('Beat')
    dice(2)
    await user.click(within(chooser('Beat')).getByRole('button', { name: 'Roll d2' }))
    expect(story(c.id).backstory).toBe('Beat: Market')
    expect(storyRolls(c.id)).toMatchObject([
      {
        stream: 'story',
        kind: 'table',
        background: 'City Watch|SCAG',
        table: 'beat',
        die: 2,
        values: [2],
        rows: [1],
      },
    ])

    dice(1)
    await user.click(within(chooser('Beat')).getByRole('button', { name: 'Reroll' }))
    expect(story(c.id).backstory).toBe('Beat: Docks')
    expect(storyRolls(c.id).map((r) => r.kind === 'table' && r.rows)).toEqual([[1], [0]])
  })

  it('keeps the player’s own text beside a row picked after Change', async () => {
    const user = userEvent.setup()
    const c = seedActive(watch)
    renderSection()

    await screen.findByText('Ideal')
    await user.type(screen.getByLabelText('Ideals'), 'Mine.')
    await user.tab()
    // The player's text stands in for the table.
    expect(within(chooser('Ideal')).getByText('Your own text')).toBeInTheDocument()

    await user.click(within(chooser('Ideal')).getByRole('button', { name: 'Change' }))
    await user.click(within(chooser('Ideal')).getByRole('button', { name: /Duty\./ }))
    expect(story(c.id).ideals).toBe('Duty. (Lawful)\nMine.')
  })

  it('rolls every table still unset at once, one roll recorded for each', async () => {
    const user = userEvent.setup()
    const c = seedActive(watch)
    renderSection()

    // One table set by hand: the rest remain.
    await user.click(await screen.findByRole('button', { name: /Freedom\./ }))
    expect(screen.queryByRole('button', { name: 'Roll all' })).not.toBeInTheDocument()

    dice(4, 2, 1)
    await user.click(screen.getByRole('button', { name: 'Roll all remaining' }))
    expect(story(c.id)).toMatchObject({
      personalityTraits: 'I am calm.\nI am brave.',
      ideals: 'Freedom. (Chaotic)',
      backstory: 'Beat: Docks',
    })
    expect(
      storyRolls(c.id).map((r) => r.kind === 'table' && [r.table, r.values]),
    ).toEqual([
      ['personality trait', [4, 2]],
      ['beat', [1]],
    ])
    // Nothing is left to roll.
    expect(screen.queryByRole('button', { name: /^Roll all/ })).not.toBeInTheDocument()
  })

  it('offers Roll all while no table is set yet', async () => {
    seedActive(watch)
    renderSection()
    expect(await screen.findByRole('button', { name: 'Roll all' })).toBeInTheDocument()
  })

  it('says so when the background has no tables, and keeps the fields free', async () => {
    seedActive(sage)
    renderSection()
    expect(
      await screen.findByText(
        'This background has no suggested characteristics tables; write your own.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Roll/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Backstory')).toBeInTheDocument()
  })
})
