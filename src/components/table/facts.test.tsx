import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  allSame,
  factColumn,
  factValue,
  groupTitle,
  NO_VALUE,
  perEntry,
  type Fact,
  type FactGroup,
} from './facts'

interface Pet {
  name: string
  legs: number
  sound?: string
}

const cat: Pet = { name: 'Cat', legs: 4, sound: 'meow' }
const fish: Pet = { name: 'Fish', legs: 0 }

const sound: Fact<Pet> = { key: 'sound', label: 'Sound', text: (p) => p.sound ?? '' }

describe('factValue', () => {
  it('is the text of a fact that draws nothing of its own', () => {
    expect(factValue(sound, cat)).toBe('meow')
  })

  it('is null when the entry has nothing there, without drawing it', () => {
    const draw = vi.fn(() => <b>loud</b>)
    expect(factValue({ ...sound, render: draw }, fish)).toBeNull()
    expect(draw).not.toHaveBeenCalled()
  })

  it('is what the fact draws when it has a value', () => {
    const drawn: Fact<Pet> = { ...sound, render: (p) => <b>{p.sound}!</b> }
    render(<>{factValue(drawn, cat)}</>)
    expect(screen.getByText('meow!')).toBeInTheDocument()
  })
})

describe('groupTitle', () => {
  const group: FactGroup<Pet> = { key: 'g', title: 'Basics', facts: [sound] }

  it('is the title of the group', () => {
    expect(groupTitle(group, cat)).toBe('Basics')
  })

  it('prefers the title that differs per entry', () => {
    const own = { ...group, entryTitle: (p: Pet) => `${p.name} noises` }
    expect(groupTitle(own, cat)).toBe('Cat noises')
  })

  it('is empty for a group without a heading', () => {
    expect(groupTitle({ key: 'g', facts: [] }, cat)).toBe('')
  })
})

describe('factColumn', () => {
  it('shows, sorts and filters by the fact, with a dash for nothing', () => {
    const column = factColumn(sound)
    expect(column.key).toBe('sound')
    expect(column.header).toBe('Sound')
    expect(column.render(cat)).toBe('meow')
    expect(column.render(fish)).toBe(NO_VALUE)
    expect(column.sortValue?.(cat)).toBe('meow')
    expect(column.filterValue?.(cat)).toBe('meow')
    expect(column.filterValue?.(fish)).toBe(NO_VALUE)
  })

  it('takes what the caller overrides', () => {
    const legs: Fact<Pet> = { key: 'legs', label: 'Legs', text: (p) => String(p.legs) }
    const column = factColumn(legs, { sortValue: (p) => p.legs, defaultHidden: true })
    expect(column.sortValue?.(cat)).toBe(4)
    expect(column.defaultHidden).toBe(true)
  })
})

describe('allSame', () => {
  it('is true only when two or more values all match', () => {
    expect(allSame(['a', 'a', 'a'])).toBe(true)
    expect(allSame(['a', 'b'])).toBe(false)
    expect(allSame(['a'])).toBe(false)
    expect(allSame([])).toBe(false)
  })
})

describe('perEntry', () => {
  it('works a value out once per entry and remembers it', () => {
    const compute = vi.fn((p: Pet) => p.legs * 2)
    const doubled = perEntry(compute)
    expect(doubled(cat)).toBe(8)
    expect(doubled(cat)).toBe(8)
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('remembers a value that is empty or missing too', () => {
    const compute = vi.fn((p: Pet) => p.sound)
    const soundOf = perEntry(compute)
    expect(soundOf(fish)).toBeUndefined()
    expect(soundOf(fish)).toBeUndefined()
    const legsOf = vi.fn((p: Pet) => p.legs)
    const remembered = perEntry(legsOf)
    expect(remembered(fish)).toBe(0)
    expect(remembered(fish)).toBe(0)
    expect(compute).toHaveBeenCalledTimes(1)
    expect(legsOf).toHaveBeenCalledTimes(1)
  })

  it('keeps each entry apart, even ones that look the same', () => {
    const compute = vi.fn((p: Pet) => p.name)
    const nameOf = perEntry(compute)
    const twin: Pet = { ...cat }
    expect(nameOf(cat)).toBe('Cat')
    expect(nameOf(fish)).toBe('Fish')
    expect(nameOf(twin)).toBe('Cat')
    expect(compute).toHaveBeenCalledTimes(3)
    expect(compute).toHaveBeenNthCalledWith(3, twin)
  })
})
