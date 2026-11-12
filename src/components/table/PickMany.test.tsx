import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest'
import { factColumn, type Describe, type Fact } from './facts'
import { PickMany, type PickManyProps } from './PickMany'

interface Pet {
  id: string
  name: string
  legs: number
}

const PETS: Pet[] = [
  { id: 'cat', name: 'Cat', legs: 4 },
  { id: 'dog', name: 'Dog', legs: 4 },
  { id: 'fish', name: 'Fish', legs: 0 },
  { id: 'bird', name: 'Bird', legs: 2 },
]

const legs: Fact<Pet> = { key: 'legs', label: 'Legs', text: (p) => String(p.legs) }
const describePets: Describe<Pet> = () => [
  { key: 'basics', title: 'Basics', facts: [legs] },
]
const nameColumn = { key: 'name', header: 'Name', render: (p: Pet) => p.name }
const noLegs = (p: Pet) =>
  p.legs === 0 ? { standard: false, reason: 'No legs' } : { standard: true }

type HarnessProps = Partial<Omit<PickManyProps<Pet>, 'picked'>> & { initial?: string[] }

/** PickMany is controlled: this keeps the picks the way a section's store would. */
function Harness({ initial = [], onAdd, onRemove, ...props }: HarnessProps) {
  const [ids, setIds] = useState(initial)
  return (
    <PickMany<Pet>
      tableId="pets"
      rows={PETS}
      columns={[nameColumn, factColumn(legs)]}
      summaryColumns={[nameColumn]}
      idOf={(p) => p.id}
      nameOf={(p) => p.name}
      describe={describePets}
      searchText={(p) => p.name}
      labels={{
        compare: 'Compare pets',
        search: 'Search pets…',
        table: 'Pets',
      }}
      noun="pets"
      picked={ids.flatMap((id) => PETS.filter((p) => p.id === id))}
      onAdd={(p) => {
        setIds((now) => [...now, p.id])
        onAdd?.(p)
      }}
      onRemove={(p) => {
        setIds((now) => now.filter((id) => id !== p.id))
        onRemove?.(p)
      }}
      {...props}
    />
  )
}

const openTable = () => screen.queryByRole('table', { name: 'Pets' })
const rowOf = (name: string) =>
  within(screen.getByRole('table', { name: 'Pets' }))
    .getByText(name)
    .closest('tr') as HTMLElement
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const add = (name: string) =>
  userEvent.click(within(rowOf(name)).getByRole('button', { name: 'Add' }))

let scroll: MockInstance<Element['scrollIntoView']>

beforeEach(() => {
  localStorage.clear()
  scroll = vi.spyOn(Element.prototype, 'scrollIntoView')
})
afterEach(() => scroll.mockRestore())

describe('PickMany', () => {
  it('shows the table while nothing is chosen, with Add on every row', () => {
    render(<Harness />)
    expect(openTable()).toBeInTheDocument()
    expect(within(rowOf('Cat')).getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.getByText('Pets 0')).toBeInTheDocument()
  })

  it('stays open while picking, and turns Add into Remove on a picked row', async () => {
    const onAdd = vi.fn()
    render(<Harness onAdd={onAdd} />)

    await add('Cat')
    await add('Fish')
    expect(onAdd.mock.calls).toEqual([[PETS[0]], [PETS[2]]])
    expect(openTable()).toBeInTheDocument()
    expect(
      within(rowOf('Cat')).getByRole('button', { name: 'Remove' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Pets 2')).toBeInTheDocument()
  })

  it('removes from the open table', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<Harness initial={['cat']} onRemove={onRemove} />)
    await user.click(button('Change'))
    await user.click(within(rowOf('Cat')).getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledWith(PETS[0])
    expect(screen.getByText('Pets 0')).toBeInTheDocument()
  })

  it('adds and removes from the detail pane too', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<Harness onAdd={onAdd} />)
    await user.click(screen.getByText('Dog'))
    const pane = document.querySelector('.data-table-detail') as HTMLElement
    await user.click(within(pane).getByRole('button', { name: 'Add to pets' }))
    expect(onAdd).toHaveBeenCalledWith(PETS[1])
    expect(
      within(pane).getByRole('button', { name: 'Remove from pets' }),
    ).toBeInTheDocument()
  })

  it('folds into a short table of the picks on Done, each with its Remove', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(<Harness onRemove={onRemove} />)
    await add('Cat')
    await add('Bird')
    await user.click(button('Done'))

    const picks = screen.getByRole('table', { name: 'Pets' })
    expect(within(picks).getByText('Cat')).toBeInTheDocument()
    expect(within(picks).getByText('Bird')).toBeInTheDocument()
    expect(within(picks).queryByText('Dog')).not.toBeInTheDocument()
    // Compact: no search box, no column chooser, no switch.
    expect(screen.queryByPlaceholderText('Search pets…')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Columns/ })).not.toBeInTheDocument()
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })

    const row = within(picks).getByText('Bird').closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledWith(PETS[3])
    expect(within(picks).queryByText('Bird')).not.toBeInTheDocument()
  })

  it('shows a line to choose when nothing is picked and the table is shut', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(button('Done'))
    expect(openTable()).not.toBeInTheDocument()
    expect(screen.getByText('No pets chosen yet')).toBeInTheDocument()
    await user.click(button('Choose pets'))
    expect(openTable()).toBeInTheDocument()
  })

  it('starts shut when something is already picked, and Change reopens the table', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['dog']} />)
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
    expect(scroll).not.toHaveBeenCalled()
    await user.click(button('Change'))
    expect(
      within(rowOf('Dog')).getByRole('button', { name: 'Remove' }),
    ).toBeInTheDocument()
  })

  it('keeps a pick in the compact table when it is not among the rows', () => {
    render(<Harness initial={['dog']} rows={[PETS[0]]} />)
    expect(screen.getByText('Dog')).toBeInTheDocument()
  })

  it('heads the short table with fixed entries: no Remove, not counted', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['dog']} fixed={[PETS[2]]} aside="+1 always there" />)
    expect(screen.getByText('Pets 1')).toBeInTheDocument()
    expect(screen.getByText('+1 always there')).toBeInTheDocument()
    expect(within(rowOf('Fish')).queryByRole('button', { name: 'Remove' })).toBeNull()
    expect(
      within(rowOf('Dog')).getByRole('button', { name: 'Remove' }),
    ).toBeInTheDocument()
    const rows = within(screen.getByRole('table', { name: 'Pets' })).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Fish')
    // A pick that is also fixed is listed once.
    await user.click(button('Change'))
    await add('Fish')
    await user.click(button('Done'))
    expect(screen.getAllByText('Fish')).toHaveLength(1)
  })

  it('lists fixed entries even when nothing is picked and the table is shut', async () => {
    const user = userEvent.setup()
    render(<Harness fixed={[PETS[2]]} />)
    await user.click(button('Done'))
    expect(screen.queryByText('No pets chosen yet')).not.toBeInTheDocument()
    expect(screen.getByText('Fish')).toBeInTheDocument()
  })

  it('shows the count against the limit, and warns when over it', async () => {
    const user = userEvent.setup()
    render(<Harness limit={{ max: 1, reason: 'Only 1 pet allowed' }} initial={['cat']} />)
    expect(screen.getByText('Pets 1 of 1')).toBeInTheDocument()
    expect(screen.queryByText('Non-standard')).not.toBeInTheDocument()

    await user.click(button('Change'))
    await add('Dog')
    expect(screen.getByText('Pets 2 of 1')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Non-standard')
  })

  it('gives the over-limit badge a reason of its own when none is passed', async () => {
    render(<Harness limit={{ max: 0 }} />)
    await add('Cat')
    expect(screen.getByRole('note')).toBeInTheDocument()
  })

  it('shuts by itself when an add fills the limit exactly', async () => {
    render(<Harness limit={{ max: 2 }} autoCloseAtLimit />)
    await add('Cat')
    expect(openTable()).toBeInTheDocument()
    await add('Dog')
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
    expect(screen.getByText('Pets 2 of 2')).toBeInTheDocument()
  })

  it('does not shut by itself unless asked', async () => {
    render(<Harness limit={{ max: 1 }} />)
    await add('Cat')
    expect(openTable()).toBeInTheDocument()
  })

  it('adds every ticked row in one click', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<Harness onAdd={onAdd} limit={{ max: 2 }} autoCloseAtLimit />)
    expect(button('Add 0 ticked')).toBeDisabled()
    await user.click(within(rowOf('Cat')).getByRole('checkbox'))
    await user.click(within(rowOf('Bird')).getByRole('checkbox'))
    await user.click(button('Add 2 ticked'))
    expect(onAdd.mock.calls).toEqual([[PETS[0]], [PETS[3]]])
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
  })

  it('leaves out of "Add ticked" what is picked already and what is not standard', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<Harness initial={['cat']} rowMeta={noLegs} onAdd={onAdd} />)
    await user.click(button('Change'))
    for (const name of ['Cat', 'Dog', 'Fish'])
      await user.click(within(rowOf(name)).getByRole('checkbox'))
    await user.click(button('Add 1 ticked'))
    expect(onAdd.mock.calls).toEqual([[PETS[1]]])
  })

  it('adds a non-standard row only once the switch is on', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<Harness rowMeta={noLegs} onAdd={onAdd} />)
    expect(within(rowOf('Fish')).getByRole('button', { name: 'Add' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /Allow non-standard/ }))
    await add('Fish')
    expect(onAdd).toHaveBeenCalledWith(PETS[2])
  })

  it('takes the switch from its section when the section keeps it', async () => {
    const user = userEvent.setup()
    const onAllow = vi.fn()
    render(
      <Harness allowNonStandard onAllowNonStandardChange={onAllow} rowMeta={noLegs} />,
    )
    expect(within(rowOf('Fish')).getByRole('button', { name: 'Add' })).toBeEnabled()
    await user.click(screen.getByRole('checkbox', { name: /Allow non-standard/ }))
    expect(onAllow).toHaveBeenCalledWith(false)
  })

  it('judges the picks by pickedRowMeta in the compact table', () => {
    render(
      <Harness
        initial={['fish']}
        rowMeta={() => ({ standard: false, reason: 'Full' })}
        pickedRowMeta={() => ({ standard: true })}
      />,
    )
    expect(screen.queryByText('Full')).not.toBeInTheDocument()
  })

  it('shows a pick the rules do not allow with its reason in the compact table', () => {
    render(<Harness initial={['fish']} rowMeta={noLegs} />)
    expect(screen.getAllByText('No legs').length).toBeGreaterThan(0)
  })

  it('shows what the picks still ask of the player', () => {
    render(
      <Harness initial={['cat']}>
        <p>Name your cat</p>
      </Harness>,
    )
    expect(screen.getByText('Name your cat')).toBeInTheDocument()
  })

  it('lets the section hold the table open or shut, and hears of Done and Change', async () => {
    const user = userEvent.setup()
    const onBrowsingChange = vi.fn()
    const { rerender } = render(
      <Harness initial={['cat']} browsing onBrowsingChange={onBrowsingChange} />,
    )
    await user.click(button('Done'))
    expect(onBrowsingChange).toHaveBeenLastCalledWith(false)
    // Still open: the section has not shut it.
    expect(openTable()).toBeInTheDocument()

    rerender(
      <Harness initial={['cat']} browsing={false} onBrowsingChange={onBrowsingChange} />,
    )
    await user.click(button('Change'))
    expect(onBrowsingChange).toHaveBeenLastCalledWith(true)
  })

  it('names the compact table by the id it is given', () => {
    render(<Harness initial={['cat']} summaryTableId="pet-picks" />)
    expect(screen.getByRole('table', { name: 'Pets' })).toBeInTheDocument()
  })
})

describe('PickMany with a quantity', () => {
  /** A section's store of how many of each pet there are. */
  function Counted({ initial = { cat: 1 } }: { initial?: Record<string, number> }) {
    const [counts, setCounts] = useState<Record<string, number>>(initial)
    return (
      <PickMany<Pet>
        tableId="pets"
        rows={PETS}
        columns={[nameColumn]}
        summaryColumns={[nameColumn]}
        idOf={(p) => p.id}
        nameOf={(p) => p.name}
        describe={describePets}
        searchText={(p) => p.name}
        labels={{
          compare: 'Compare pets',
          search: 'Search pets…',
          table: 'Pets',
        }}
        noun="pets"
        picked={PETS.filter((p) => counts[p.id] !== undefined)}
        onAdd={(p) => setCounts((now) => ({ ...now, [p.id]: 1 }))}
        onRemove={(p) =>
          setCounts((now) =>
            Object.fromEntries(Object.entries(now).filter(([k]) => k !== p.id)),
          )
        }
        quantityOf={(p) => counts[p.id] ?? 0}
        onQuantity={(p, n) => setCounts((now) => ({ ...now, [p.id]: n }))}
      />
    )
  }

  it('adds one more on a row already picked, and never offers Remove there', async () => {
    const user = userEvent.setup()
    render(<Counted />)
    await user.click(button('Change'))
    expect(within(rowOf('Cat')).queryByRole('button', { name: 'Remove' })).toBeNull()
    await user.click(within(rowOf('Cat')).getByRole('button', { name: 'Add' }))
    await user.click(button('Done'))
    expect(screen.getByRole('spinbutton', { name: 'Quantity of Cat' })).toHaveValue(2)
  })

  it('adds one more to ticked rows that are already picked', async () => {
    const user = userEvent.setup()
    render(<Counted />)
    await user.click(button('Change'))
    await user.click(within(rowOf('Cat')).getByRole('checkbox'))
    await user.click(button('Add 1 ticked'))
    await user.click(button('Done'))
    expect(screen.getByRole('spinbutton', { name: 'Quantity of Cat' })).toHaveValue(2)
  })

  it('steps and types the quantity in the short table', async () => {
    const user = userEvent.setup()
    render(<Counted />)
    const box = screen.getByRole('spinbutton', { name: 'Quantity of Cat' })
    // The steppers are the same plus and minus icons as a row's action.
    expect(button('One more Cat').querySelector('i')).toHaveClass('bi-plus-lg')
    expect(button('One fewer Cat').querySelector('i')).toHaveClass('bi-dash-lg')
    await user.click(button('One more Cat'))
    expect(box).toHaveValue(2)
    await user.click(button('One fewer Cat'))
    expect(box).toHaveValue(1)
    await user.clear(box)
    // An empty box is not a number: it changes nothing until one is typed.
    await user.type(box, '12')
    expect(box).toHaveValue(12)
  })

  it('removes the pick when the quantity reaches 0', async () => {
    const user = userEvent.setup()
    render(<Counted />)
    await user.click(button('One fewer Cat'))
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.getByText('No pets chosen yet')).toBeInTheDocument()
  })

  it('keeps a fixed pick at a plain number with no controls', () => {
    render(
      <PickMany<Pet>
        tableId="pets"
        rows={PETS}
        columns={[nameColumn]}
        summaryColumns={[nameColumn]}
        idOf={(p) => p.id}
        nameOf={(p) => p.name}
        describe={describePets}
        searchText={(p) => p.name}
        labels={{
          compare: 'Compare pets',
          search: 'Search pets…',
          table: 'Pets',
        }}
        noun="pets"
        picked={[]}
        fixed={[PETS[1]]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        quantityOf={() => 3}
        onQuantity={vi.fn()}
        browsing={false}
      />,
    )
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(within(rowOf('Dog')).getByText('3')).toBeInTheDocument()
  })
})
