import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DetailGroup, EntryDetail, EntryFacts, EntryHeading } from './EntryDetail'
import type { Describe } from './facts'

interface Pet {
  name: string
  legs: number
  sound?: string
  tricks: string[]
}

const cat: Pet = { name: 'Cat', legs: 4, sound: 'meow', tricks: [] }
const fish: Pet = { name: 'Fish', legs: 0, tricks: [] }

const describePets: Describe<Pet> = () => [
  {
    key: 'basics',
    title: 'Basics',
    facts: [
      { key: 'legs', label: 'Legs', text: (p) => String(p.legs) },
      { key: 'sound', label: 'Sound', text: (p) => p.sound ?? '' },
    ],
  },
  {
    key: 'tricks',
    entryTitle: (p) => `${p.name} tricks`,
    facts: [{ key: 'first', label: 'First', text: (p) => p.tricks[0] ?? '' }],
    empty: 'No tricks yet.',
  },
  {
    key: 'noises',
    title: 'Noises',
    facts: [{ key: 'loud', label: 'Loud', text: (p) => (p.sound ? 'Yes' : '') }],
  },
]

describe('EntryDetail', () => {
  it('heads the entry with its name and tags, then its facts by group', () => {
    render(
      <EntryDetail entry={cat} describe={describePets} name="Cat" tags={['2024']}>
        <p>More about cats</p>
      </EntryDetail>,
    )
    expect(screen.getByRole('heading', { name: 'Cat', level: 5 })).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('Basics')).toBeInTheDocument()
    const legs = screen.getByRole('rowheader', { name: 'Legs' }).closest('tr')!
    expect(within(legs).getByText('4')).toBeInTheDocument()
    expect(screen.getByText('meow')).toBeInTheDocument()
    expect(screen.getByText('More about cats')).toBeInTheDocument()
  })

  it('needs no tags', () => {
    render(<EntryDetail entry={cat} describe={describePets} name="Cat" />)
    expect(screen.getByRole('heading', { name: 'Cat' })).toBeInTheDocument()
  })
})

describe('EntryFacts', () => {
  it('leaves out a fact the entry has nothing for', () => {
    render(<EntryFacts entry={fish} describe={describePets} />)
    expect(screen.getByRole('rowheader', { name: 'Legs' })).toBeInTheDocument()
    expect(screen.queryByRole('rowheader', { name: 'Sound' })).not.toBeInTheDocument()
  })

  it('leaves out a group the entry has nothing in, unless the group says what to show', () => {
    render(<EntryFacts entry={fish} describe={describePets} />)
    expect(screen.queryByText('Noises')).not.toBeInTheDocument()
    expect(screen.getByText('Fish tricks')).toBeInTheDocument()
    expect(screen.getByText('No tricks yet.')).toBeInTheDocument()
  })
})

describe('EntryHeading', () => {
  it('can be a smaller heading and take extra classes', () => {
    const { container } = render(
      <EntryHeading name="Cat" tags={['2014']} as="h3" className="mb-1" />,
    )
    expect(screen.getByRole('heading', { name: 'Cat', level: 3 })).toHaveClass('h6')
    expect(container.firstChild).toHaveClass('mb-1')
  })
})

describe('DetailGroup', () => {
  it('heads its rows with a full-width title', () => {
    render(
      <DetailGroup title="Extras">
        <tr>
          <td>row</td>
        </tr>
      </DetailGroup>,
    )
    expect(screen.getByText('Extras')).toHaveAttribute('colspan', '2')
    expect(screen.getByText('row')).toBeInTheDocument()
  })
})
