import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SpellGrant, SpellVariantSet } from '../../character/spellGrants'
import { spellsByName } from '../../character/spellGrants'
import { makeSpell } from '../../test/spellFixtures'
import { GrantVariantChooser } from './GrantVariantChooser'

const grant = (
  variant: string,
  name: string,
  gate: number,
  locked: boolean,
  extra: Partial<SpellGrant> = {},
): SpellGrant => ({
  id: `land:${variant}:${name}`,
  sourceId: 'land',
  from: 'Circle of the Land',
  origin: 'subclass',
  mode: 'prepared',
  gate,
  locked,
  uses: '',
  variant,
  spell: { name, source: '', cantrip: false },
  ...extra,
})

const SET: SpellVariantSet = {
  id: 'land:variant',
  from: 'Circle of the Land',
  names: ['Arctic', 'Coast'],
  options: [
    {
      name: 'Arctic',
      grants: [
        grant('Arctic', 'hold person', 3, false),
        grant('Arctic', 'sleet storm', 5, true),
        grant('Arctic', 'x', 1, false, {
          spell: undefined,
          pick: {
            count: 1,
            filter: {
              levels: [0],
              classes: ['Druid'],
              schools: [],
              ritual: false,
              attacks: [],
              sources: [],
            },
          },
        }),
      ],
    },
    {
      name: 'Coast',
      grants: [
        grant('Coast', 'mirror image', 3, false),
        grant('Coast', 'water walk', 5, true),
      ],
    },
  ],
}

const byName = spellsByName(
  ['Hold Person', 'Sleet Storm', 'Mirror Image', 'Water Walk'].map((name) =>
    makeSpell({ name }),
  ),
)

describe('GrantVariantChooser', () => {
  it('shows what each set gives by level, with levels not reached as "at level N"', () => {
    render(<GrantVariantChooser set={SET} byName={byName} editChoice={vi.fn()} />)
    expect(
      screen.getByText('Level 3: Hold Person; At level 5: Sleet Storm'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Level 3: Mirror Image; At level 5: Water Walk'),
    ).toBeInTheDocument()
    expect(screen.getByText('1 Druid cantrip')).toBeInTheDocument()
  })

  it('compares sets side by side and takes one from its row', async () => {
    const user = userEvent.setup()
    const editChoice = vi.fn()
    render(<GrantVariantChooser set={SET} byName={byName} editChoice={editChoice} />)
    for (const box of screen.getAllByRole('checkbox').slice(-2)) await user.click(box)
    await user.click(screen.getByRole('button', { name: /^Compare \(2\)/ }))
    const modal = within(await screen.findByRole('dialog'))
    expect(modal.getByText('Hold Person')).toBeInTheDocument()
    expect(modal.getByText('Water Walk')).toBeInTheDocument()
    expect(modal.getByText('At level 5')).toBeInTheDocument()

    const sets = within(
      screen.getByRole('table', { name: 'Circle of the Land spell sets' }),
    )
    const row = sets.getByText('Coast').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Choose' }))
    expect(editChoice).toHaveBeenCalledOnce()
    expect(editChoice.mock.calls[0][0]).toBe('land:variant')
    expect(editChoice.mock.calls[0][1]({ picks: [] })).toEqual({
      picks: [],
      variant: 'Coast',
    })
  })

  it('shrinks to the taken set and lets it be changed', async () => {
    const user = userEvent.setup()
    const editChoice = vi.fn()
    render(
      <GrantVariantChooser
        set={{ ...SET, selected: 'Arctic' }}
        byName={byName}
        editChoice={editChoice}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Arctic' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change set of spells' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(editChoice.mock.calls[0][1]({ picks: [], variant: 'Arctic' })).toEqual({
      picks: [],
      variant: undefined,
    })
  })
})
