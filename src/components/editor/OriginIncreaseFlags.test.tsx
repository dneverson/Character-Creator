import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createCharacter } from '../../character/model'
import type { PlayableBackground } from '../../data/background'
import { OriginIncreaseFlags } from './OriginIncreaseFlags'

const soldier: PlayableBackground = {
  key: 'soldier|phb',
  name: 'Soldier',
  source: 'PHB',
  edition: 'classic',
  abilityOptions: [],
  featGrants: [],
  storyTables: [],
  entries: [],
}

describe('OriginIncreaseFlags', () => {
  it('flags an increase the origin does not allow, with the reason on hover', async () => {
    const c = createCharacter('Test')
    c.background = { name: 'Soldier', source: 'PHB', abilityChoices: { str: 2 } }
    render(<OriginIncreaseFlags character={c} background={soldier} />)
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('Non-standard')
    await userEvent.hover(note)
    expect(
      await screen.findByText(
        'Soldier gives no ability score increases; you entered +2 Strength - allowed with DM approval.',
      ),
    ).toBeInTheDocument()
  })

  it('shows nothing for allowed increases', () => {
    const c = createCharacter('Test')
    c.background = { name: 'Soldier', source: 'PHB', abilityChoices: {} }
    render(<OriginIncreaseFlags character={c} background={soldier} />)
    expect(screen.queryByRole('note')).toBeNull()
  })
})
