import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CompareModal } from './CompareModal'
import type { Describe } from './facts'

interface Pet {
  id: string
  name: string
  legs: number
  sound?: string
  year: string
}

const cat: Pet = { id: 'cat', name: 'Cat', legs: 4, sound: 'meow', year: '2014' }
const dog: Pet = { id: 'dog', name: 'Dog', legs: 4, sound: 'woof', year: '2024' }
const fish: Pet = { id: 'fish', name: 'Fish', legs: 0, year: '2024' }

const describePets: Describe<Pet> = () => [
  {
    key: 'basics',
    title: 'Basics',
    facts: [
      { key: 'legs', label: 'Legs', text: (p) => String(p.legs) },
      { key: 'sound', label: 'Sound', text: (p) => p.sound ?? '' },
      { key: 'wings', label: 'Wings', text: () => '' },
    ],
  },
  { key: 'bare', title: 'Bare group', facts: [{ key: 'x', label: 'X', text: () => '' }] },
  {
    key: 'own',
    entryTitle: (p) => `${p.name} extras`,
    facts: [{ key: 'year', label: 'Year', text: (p) => p.year }],
  },
  { key: 'nothing', title: 'Nothing here', facts: [] },
]

function renderModal(entries: Pet[], tags = true) {
  return render(
    <CompareModal<Pet>
      title="Compare pets"
      entries={entries}
      idOf={(p) => p.id}
      nameOf={(p) => p.name}
      tagsOf={tags ? (p) => [p.year] : undefined}
      describe={describePets}
      show
      onHide={() => {}}
    />,
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('CompareModal', () => {
  it('asks for two rows when given fewer', async () => {
    renderModal([cat])
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Select at least two rows to compare.'),
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole('table')).not.toBeInTheDocument()
  })

  it('gives each entry a column headed by its name and tags', async () => {
    renderModal([cat, dog])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Compare pets')).toBeInTheDocument()
    const cat_ = within(dialog).getByRole('columnheader', { name: /Cat/ })
    expect(within(cat_).getByText('2014')).toBeInTheDocument()
    expect(within(dialog).getByRole('columnheader', { name: /Dog/ })).toBeInTheDocument()
  })

  it('lays each fact on one row and marks the rows that match', async () => {
    renderModal([cat, dog], false)
    const dialog = await screen.findByRole('dialog')
    const legs = within(dialog).getByRole('rowheader', { name: /Legs/ })
    expect(within(legs).getByText('Same')).toBeInTheDocument()
    const sound = within(dialog).getByRole('rowheader', { name: /Sound/ })
    expect(within(sound).queryByText('Same')).not.toBeInTheDocument()
    const row = sound.closest('tr')!
    expect(within(row).getByText('meow')).toBeInTheDocument()
    expect(within(row).getByText('woof')).toBeInTheDocument()
    expect(
      within(dialog).queryByText(/These entries are identical/),
    ).not.toBeInTheDocument()
  })

  it('leaves a cell blank where an entry has nothing', async () => {
    renderModal([cat, fish])
    const dialog = await screen.findByRole('dialog')
    const row = within(dialog).getByRole('rowheader', { name: /Sound/ }).closest('tr')!
    const cells = within(row).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual(['meow', ''])
  })

  it('leaves out a fact no entry has, and a group left with none', async () => {
    renderModal([cat, dog])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('rowheader', { name: /Wings/ })).toBeNull()
    expect(within(dialog).queryByText('Bare group')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('rowheader', { name: /Legs/ })).toBeInTheDocument()
  })

  it('heads a group by its title, or by each entry’s own, and skips an empty one', async () => {
    renderModal([cat, dog])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Basics')).toBeInTheDocument()
    expect(within(dialog).getByText('Cat extras')).toBeInTheDocument()
    expect(within(dialog).getByText('Dog extras')).toBeInTheDocument()
    expect(within(dialog).queryByText('Nothing here')).not.toBeInTheDocument()
  })

  it('says so when the entries are identical', async () => {
    renderModal([cat, { ...cat, id: 'cat-2' }])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'These entries are identical.',
    )
  })

  it('opens at the size the window was last dragged to', async () => {
    localStorage.setItem('compare-modal-size', JSON.stringify({ w: 900, h: 600 }))
    renderModal([cat, dog])
    await screen.findByRole('dialog')
    const content = document.querySelector<HTMLElement>('.compare-modal-content')!
    await waitFor(() => expect(content.style.width).toBe('900px'))
    expect(content.style.height).toBe('600px')
  })

  it('opens at the default size when the stored size cannot be read', async () => {
    localStorage.setItem('compare-modal-size', '{not json')
    renderModal([cat, dog])
    await screen.findByRole('dialog')
    const content = document.querySelector<HTMLElement>('.compare-modal-content')!
    expect(content.style.width).toBe('')
  })

  it('remembers the size the window is dragged to, and stops watching once closed', async () => {
    const watchers: { resized: () => void; disconnect: ReturnType<typeof vi.fn> }[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect = vi.fn()
        constructor(resized: () => void) {
          watchers.push({ resized, disconnect: this.disconnect })
        }
        observe() {}
      },
    )
    const view = renderModal([cat, dog])
    await screen.findByRole('dialog')
    await waitFor(() => expect(watchers).toHaveLength(1))

    watchers[0].resized()
    expect(JSON.parse(localStorage.getItem('compare-modal-size')!)).toEqual({
      w: 0,
      h: 0,
    })

    view.rerender(
      <CompareModal<Pet>
        title="Compare pets"
        entries={[cat, dog]}
        idOf={(p) => p.id}
        nameOf={(p) => p.name}
        describe={describePets}
        show={false}
        onHide={() => {}}
      />,
    )
    await waitFor(() => expect(watchers[0].disconnect).toHaveBeenCalled())
  })
})
