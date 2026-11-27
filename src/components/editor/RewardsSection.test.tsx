import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCharacter } from '../../character/model'
import { useCharacterStore } from '../../character/store'
import { loadRewards, type Reward } from '../../data/rewards'
import { settle } from '../../test/settle'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { RewardsSection } from './RewardsSection'

vi.mock('../../data/rewards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/rewards')>()
  return { ...actual, loadRewards: vi.fn() }
})

const reward = (name: string, source: string, type: string): Reward => ({
  key: `${name}|${source}`,
  name,
  source,
  type,
  edition: source === 'XDMG' ? 'one' : 'classic',
  entries: [`${name} does a thing.`],
})

const REWARDS = [
  reward('Boon of Luck', 'DMG', 'Boon'),
  reward('Boon of Speed', 'DMG', 'Boon'),
  reward('Charm of Heroism', 'XDMG', 'Charm'),
]

function seed(books: string[], rewards?: { name: string; source: string }[]) {
  const c = createCharacter('Tordek')
  c.selectedBooks = books
  if (rewards) c.rewards = rewards
  useCharacterStore.setState({
    characters: { [c.id]: c },
    order: [c.id],
    activeId: c.id,
    view: 'editor',
  })
  return c.id
}

const rewardsOf = (id: string) => useCharacterStore.getState().characters[id].rewards

async function renderSection() {
  render(
    <ThemeProvider>
      <RewardsSection />
    </ThemeProvider>,
  )
  await settle()
}

const rowOf = (name: string) =>
  within(screen.getByRole('table', { name: 'Rewards' }))
    .getByText(name)
    .closest('tr') as HTMLElement

beforeEach(() => {
  localStorage.clear()
  vi.mocked(loadRewards).mockResolvedValue(REWARDS)
})

describe('RewardsSection', () => {
  it('lists the rewards of the selected books, and adds and removes them', async () => {
    const user = userEvent.setup({ delay: null })
    const id = seed(['DMG'])
    await renderSection()
    expect(screen.queryByText('Charm of Heroism')).not.toBeInTheDocument()

    await user.click(within(rowOf('Boon of Luck')).getByRole('button', { name: 'Add' }))
    await user.click(within(rowOf('Boon of Speed')).getByRole('button', { name: 'Add' }))
    expect(rewardsOf(id)).toEqual([
      { name: 'Boon of Luck', source: 'DMG' },
      { name: 'Boon of Speed', source: 'DMG' },
    ])

    await user.click(
      within(rowOf('Boon of Luck')).getByRole('button', { name: 'Remove' }),
    )
    await user.click(
      within(rowOf('Boon of Speed')).getByRole('button', { name: 'Remove' }),
    )
    expect(rewardsOf(id)).toBeUndefined()
  })

  it('says where rewards are when the selected books have none', async () => {
    seed(['PHB'])
    await renderSection()
    expect(screen.getByText(/No rewards in the selected books/)).toBeInTheDocument()
  })

  it('keeps a reward the character has from a book no longer selected', async () => {
    seed(['PHB'], [{ name: 'Charm of Heroism', source: 'XDMG' }])
    await renderSection()
    expect(screen.getByText('Charm of Heroism')).toBeInTheDocument()
  })

  it('says when the rewards fail to load', async () => {
    vi.mocked(loadRewards).mockRejectedValue(new Error('offline'))
    seed(['DMG'])
    await renderSection()
    expect(screen.getByText('Failed to load rewards: offline')).toBeInTheDocument()
  })
})
