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
import { PickOne, type PickOneProps } from './PickOne'

interface Pet {
  id: string
  name: string
  legs: number
  year: string
  sound?: string
}

const PETS: Pet[] = [
  { id: 'cat', name: 'Cat', legs: 4, year: '2014', sound: 'meow' },
  { id: 'dog', name: 'Dog', legs: 4, year: '2024', sound: 'woof' },
  { id: 'fish', name: 'Fish', legs: 0, year: '2014' },
]

const legs: Fact<Pet> = { key: 'legs', label: 'Legs', text: (p) => String(p.legs) }
const sound: Fact<Pet> = {
  key: 'sound',
  label: 'Sound',
  text: (p) => p.sound ?? '',
  render: (p) => <em>{p.sound}!</em>,
}
const habitat: Fact<Pet> = {
  key: 'habitat',
  label: 'Habitat',
  text: (p) => (p.legs === 0 ? 'Water' : 'Land'),
}
const describePets: Describe<Pet> = () => [
  { key: 'basics', title: 'Basics', facts: [legs, habitat] },
]

type HarnessProps = Partial<Omit<PickOneProps<Pet>, 'picked'>> & { initial?: string }

/** PickOne is controlled: this keeps the choice the way a section's store would. */
function Harness({ initial, onPick, onClear, ...props }: HarnessProps) {
  const [pickedId, setPickedId] = useState(initial)
  return (
    <PickOne<Pet>
      tableId="pets"
      rows={PETS}
      columns={[{ key: 'name', header: 'Name', render: (p) => p.name }, factColumn(legs)]}
      idOf={(p) => p.id}
      nameOf={(p) => p.name}
      tagsOf={(p) => [p.year]}
      describe={describePets}
      searchText={(p) => p.name}
      labels={{
        compare: 'Compare pets',
        search: 'Search pets…',
        detailPlaceholder: 'Select a pet to see its details.',
        table: 'Pets',
      }}
      noun="pet"
      picked={PETS.find((p) => p.id === pickedId)}
      onPick={(p) => {
        setPickedId(p.id)
        onPick?.(p)
      }}
      onClear={() => {
        setPickedId(undefined)
        onClear?.()
      }}
      {...props}
    />
  )
}

const rowOf = (name: string) =>
  within(screen.getByRole('table', { name: 'Pets' }))
    .getByText(name)
    .closest('tr') as HTMLElement
const detailPane = () => document.querySelector('.data-table-detail') as HTMLElement
const table = () => screen.queryByRole('table', { name: 'Pets' })
const card = () =>
  screen.getByRole('heading', { level: 3 }).closest('.border') as HTMLElement

let scroll: MockInstance<Element['scrollIntoView']>

beforeEach(() => {
  localStorage.clear()
  scroll = vi.spyOn(Element.prototype, 'scrollIntoView')
})
afterEach(() => scroll.mockRestore())

describe('PickOne', () => {
  it('shows the table while nothing is chosen', () => {
    render(<Harness />)
    expect(table()).toBeInTheDocument()
    expect(screen.queryByText(/Current pet/)).not.toBeInTheDocument()
    expect(
      within(rowOf('Cat')).getByRole('button', { name: 'Choose' }),
    ).toBeInTheDocument()
  })

  it('chooses from a row, then folds the table into a summary of the choice', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<Harness onPick={onPick} summary={[sound, habitat]} />)

    await user.click(within(rowOf('Dog')).getByRole('button', { name: 'Choose' }))
    expect(onPick).toHaveBeenCalledWith(PETS[1])
    expect(table()).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Dog' })).toBeInTheDocument()
    expect(within(card()).getByText('2024')).toBeInTheDocument()
    // A fact that draws itself is drawn.
    expect(within(card()).getByText('woof!').tagName).toBe('EM')
    expect(within(card()).getByText('Habitat:')).toBeInTheDocument()
    expect(within(card()).getByText('Land')).toBeInTheDocument()
    // The summary keeps itself in view once the taller table is gone.
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('chooses from the detail pane too', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    await user.click(screen.getByText('Fish'))
    await user.click(
      within(detailPane()).getByRole('button', { name: 'Choose this pet' }),
    )
    expect(onPick).toHaveBeenCalledWith(PETS[2])
    expect(screen.getByRole('heading', { level: 3, name: 'Fish' })).toBeInTheDocument()
  })

  it('leaves out a summary fact the choice has nothing for', () => {
    render(<Harness initial="fish" summary={[sound, habitat]} />)
    expect(within(card()).queryByText('Sound:')).not.toBeInTheDocument()
    expect(within(card()).getByText('Water')).toBeInTheDocument()
  })

  it('draws no summary list when no fact has a value', () => {
    render(<Harness initial="fish" summary={[sound]} />)
    expect(within(card()).queryByRole('term')).not.toBeInTheDocument()
    expect(card().querySelector('dl')).toBeNull()
  })

  it('shows what the choice still asks of the player', () => {
    render(
      <Harness initial="cat">
        <p>Name your cat</p>
      </Harness>,
    )
    expect(within(card()).getByText('Name your cat')).toBeInTheDocument()
  })

  it('shows and hides the full details of the choice', async () => {
    const user = userEvent.setup()
    render(<Harness initial="cat" />)
    const toggle = screen.getByRole('button', { name: 'Show details' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      within(card()).queryByRole('rowheader', { name: 'Legs' }),
    ).not.toBeInTheDocument()

    await user.click(toggle)
    const hide = screen.getByRole('button', { name: 'Hide details' })
    expect(hide).toHaveAttribute('aria-expanded', 'true')
    expect(within(card()).getByRole('rowheader', { name: 'Legs' })).toBeInTheDocument()
    expect(within(card()).getByText('Basics')).toBeInTheDocument()

    await user.click(hide)
    expect(screen.getByRole('button', { name: 'Show details' })).toBeInTheDocument()
    expect(
      within(card()).queryByRole('rowheader', { name: 'Legs' }),
    ).not.toBeInTheDocument()
  })

  it('reopens the table to change the choice, and keeps it without changing anything', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const onClear = vi.fn()
    render(<Harness initial="cat" onPick={onPick} onClear={onClear} />)
    expect(scroll).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Change pet' }))
    expect(table()).toBeInTheDocument()
    expect(screen.getByText(/Current pet:/)).toHaveTextContent('Current pet: Cat')

    await user.click(screen.getByRole('button', { name: 'Keep Cat' }))
    expect(table()).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Cat' })).toBeInTheDocument()
    expect(onPick).not.toHaveBeenCalled()
    expect(onClear).not.toHaveBeenCalled()
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it('offers to remove the current choice, and to choose any other', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<Harness initial="cat" onClear={onClear} />)
    await user.click(screen.getByRole('button', { name: 'Change pet' }))

    const remove = within(rowOf('Cat')).getByRole('button', { name: 'Remove' })
    expect(remove).toHaveClass('btn-danger')
    expect(
      within(rowOf('Dog')).getByRole('button', { name: 'Choose' }),
    ).toBeInTheDocument()

    await user.click(within(rowOf('Cat')).getByText('Cat'))
    expect(
      within(detailPane()).getByRole('button', { name: 'Remove this pet' }),
    ).toBeInTheDocument()

    await user.click(remove)
    expect(onClear).toHaveBeenCalledTimes(1)
    // With nothing chosen the table stays open, with nothing current.
    expect(table()).toBeInTheDocument()
    expect(screen.queryByText(/Current pet/)).not.toBeInTheDocument()
    expect(
      within(rowOf('Cat')).getByRole('button', { name: 'Choose' }),
    ).toBeInTheDocument()
  })

  it('changes to another choice and folds the table again', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<Harness initial="cat" onPick={onPick} />)
    await user.click(screen.getByRole('button', { name: 'Change pet' }))
    await user.click(within(rowOf('Dog')).getByRole('button', { name: 'Choose' }))

    expect(onPick).toHaveBeenCalledWith(PETS[1])
    expect(table()).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Dog' })).toBeInTheDocument()
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it('heads the choice without tags when the rows have none', () => {
    render(<Harness initial="cat" tagsOf={undefined} />)
    expect(within(card()).queryByText('2014')).not.toBeInTheDocument()
  })

  describe('when the section opens and shuts the table', () => {
    /** The section keeps `browsing`, and reports each change to the test. */
    function Controlled({
      open = false,
      onBrowsingChange,
      ...props
    }: HarnessProps & { open?: boolean }) {
      const [browsing, setBrowsing] = useState(open)
      return (
        <Harness
          {...props}
          browsing={browsing}
          onBrowsingChange={(next) => {
            onBrowsingChange?.(next)
            setBrowsing(next)
          }}
        />
      )
    }

    it('shows one line, not the table, while shut with nothing chosen', () => {
      render(<Controlled />)
      expect(table()).not.toBeInTheDocument()
      expect(screen.getByText('No pet chosen yet')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Choose pet' })).toHaveClass(
        'btn-primary',
      )
    })

    it('opens the table from that line, and shuts it on a choice', async () => {
      const user = userEvent.setup()
      const onBrowsingChange = vi.fn()
      render(<Controlled onBrowsingChange={onBrowsingChange} />)
      await user.click(screen.getByRole('button', { name: 'Choose pet' }))
      expect(onBrowsingChange).toHaveBeenLastCalledWith(true)
      expect(table()).toBeInTheDocument()

      await user.click(within(rowOf('Dog')).getByRole('button', { name: 'Choose' }))
      expect(onBrowsingChange).toHaveBeenLastCalledWith(false)
      expect(table()).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 3, name: 'Dog' })).toBeInTheDocument()
    })

    it('opens the table with nothing chosen when the section says so', () => {
      render(<Controlled open />)
      expect(table()).toBeInTheDocument()
      expect(screen.queryByText('No pet chosen yet')).not.toBeInTheDocument()
    })

    it('opens to change a choice, and Keep shuts it again', async () => {
      const user = userEvent.setup()
      const onBrowsingChange = vi.fn()
      render(<Controlled initial="cat" onBrowsingChange={onBrowsingChange} />)
      expect(table()).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Change pet' }))
      expect(onBrowsingChange).toHaveBeenLastCalledWith(true)
      await user.click(screen.getByRole('button', { name: 'Keep Cat' }))
      expect(onBrowsingChange).toHaveBeenLastCalledWith(false)
      expect(table()).not.toBeInTheDocument()
    })

    it('shuts the table on Remove, leaving the line to choose again', async () => {
      const user = userEvent.setup()
      const onClear = vi.fn()
      render(<Controlled initial="cat" open onClear={onClear} />)
      await user.click(within(rowOf('Cat')).getByRole('button', { name: 'Remove' }))
      expect(onClear).toHaveBeenCalledTimes(1)
      expect(screen.getByText('No pet chosen yet')).toBeInTheDocument()
    })

    it('does not need a listener to be told of changes', async () => {
      const user = userEvent.setup()
      render(<Harness browsing={false} initial="cat" />)
      await user.click(screen.getByRole('button', { name: 'Change pet' }))
      expect(table()).not.toBeInTheDocument()
    })
  })
})
