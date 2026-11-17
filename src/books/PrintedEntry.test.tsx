import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Entries } from '../text/Entries'
import { EntryContext, type StatblockEntry } from '../text/entryContext'
import { BookStatblock } from './BookStatblock'

vi.mock('../data/dataClient', async () => {
  const { readFileSync } = await import('node:fs')
  return {
    fetchData: async (path: string): Promise<unknown> => {
      try {
        return JSON.parse(readFileSync(`public/data/${path}`, 'utf8'))
      } catch {
        throw new Error(`Failed to load data "${path}": HTTP 404`)
      }
    },
  }
})

function installObserver() {
  const reports: ((visible: boolean) => void)[] = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        reports.push((isIntersecting) =>
          callback([{ isIntersecting } as IntersectionObserverEntry]),
        )
      }
      observe() {}
      disconnect() {}
    },
  )
  return reports
}

afterEach(() => vi.unstubAllGlobals())

const block = (tag: string, name: string, source: string): StatblockEntry => ({
  type: 'statblock',
  tag,
  name,
  source,
})

const labelsOf = (container: HTMLElement) =>
  [...container.querySelectorAll('.printed__label')].map((e) => e.textContent)
const sectionsOf = (container: HTMLElement) =>
  [...container.querySelectorAll('.printed__section')].map((e) => e.textContent)

async function draw(entry: StatblockEntry, headed = false) {
  const reports = installObserver()
  const view = render(<BookStatblock entry={entry} root={null} headed={headed} />)
  act(() => reports[0](true))
  await waitFor(() =>
    expect(view.container.querySelector('.printed__kind')).not.toBeNull(),
  )
  return view
}

describe('the printed stat block of a 2014 creature', () => {
  it('is laid out as the Monster Manual prints it', async () => {
    const { container } = await draw(block('creature', 'Aboleth', 'MM'))
    const text = container.textContent ?? ''
    expect(container.querySelector('.printed__name')).toHaveTextContent('Aboleth')
    expect(container.querySelector('.printed__kind')).toHaveTextContent(
      'Large aberration, lawful evil',
    )
    for (const label of ['Armor Class', 'Hit Points', 'Speed', 'Saving Throws'])
      expect(text).toContain(label)
    expect(text).toMatch(/Challenge\s*10 \(5,900 XP\)/)
    expect(text).toContain('Proficiency Bonus +4')
    expect(container.querySelectorAll('.printed__abilities th')).toHaveLength(6)
    expect(screen.queryByText('Traits')).toBeNull()
    expect(container.querySelectorAll('abbr').length).toBeGreaterThan(0)
  })

  it('does not print the name again under a heading that has it', async () => {
    const { container } = await draw(block('creature', 'Aboleth', 'MM'), true)
    expect(container.querySelector('.printed__name')).toBeNull()
    expect(container.querySelector('.printed__kind')).not.toBeNull()
  })

  it('prints the sections of a legendary creature under their headings', async () => {
    const { container } = await draw(block('creature', 'Aboleth', 'MM'))
    expect(sectionsOf(container)).toEqual(['Actions', 'Legendary Actions'])
  })
})

describe('the printed stat block of a 2024 creature', () => {
  it('has the Mod and Save columns, initiative, traits and the lair', async () => {
    const { container } = await draw(block('creature', 'Aboleth', 'XMM'))
    const text = container.textContent ?? ''
    expect(container.querySelector('.printed-creature')).toHaveClass('is-2024')
    expect(container.querySelector('.printed__kind')).toHaveTextContent(
      'Large Aberration, Lawful Evil',
    )
    expect(text).toMatch(/Initiative\s*\+7 \(17\)/)
    expect(
      container.querySelectorAll('.printed__abilities th[scope="col"]'),
    ).toHaveLength(6)
    expect(text).toMatch(/CR\s*10 \(XP 5,900, or 7,200 in lair; PB \+4\)/)
    expect(text).toContain('Passive Perception')
    expect(sectionsOf(container).slice(0, 2)).toEqual(['Traits', 'Actions'])
    expect(sectionsOf(container)).toContain('Legendary Actions')
  })
})

describe('the printed spell and item', () => {
  it('prints a 2014 spell with its four lines', async () => {
    const { container } = await draw(block('spell', 'Fireball', 'PHB'))
    expect(container.querySelector('.printed__kind')).toHaveTextContent(
      '3rd-level evocation',
    )
    expect(labelsOf(container)).toEqual([
      'Casting Time:',
      'Range:',
      'Components:',
      'Duration:',
    ])
    expect(container.textContent).toContain('A bright streak flashes')
    expect(container.textContent).toContain('At Higher Levels')
  })

  it('prints a 2024 spell with its classes on the first line', async () => {
    const { container } = await draw(block('spell', 'Fireball', 'XPHB'))
    expect(container.querySelector('.printed__kind')).toHaveTextContent(
      'Level 3 Evocation (Sorcerer, Wizard)',
    )
  })

  it('prints a plain item with its cost and damage as lines', async () => {
    const { container } = await draw(block('item', 'Longsword', 'PHB'))
    expect(labelsOf(container)).toContain('Cost:')
    expect(labelsOf(container)).toContain('Damage:')
  })

  it('names a block the way the book renames it', async () => {
    const { container } = await draw({
      ...block('spell', 'Fireball', 'PHB'),
      displayName: 'Big Boom',
    })
    expect(container.querySelector('.printed__name')).toHaveTextContent('Big Boom')
  })
})

describe('a stat block right under its own heading', () => {
  it('is told so by the entries around it', async () => {
    const reports = installObserver()
    render(
      <EntryContext.Provider
        value={{
          book: true,
          words: [],
          renderStatblock: (entry, headed) => (
            <BookStatblock entry={entry} root={null} headed={headed} />
          ),
        }}
      >
        <Entries
          entries={[
            {
              type: 'section',
              name: 'Aboleth',
              entries: [block('creature', 'Aboleth', 'MM')],
            },
          ]}
        />
      </EntryContext.Provider>,
    )
    act(() => reports[0](true))
    await screen.findByText(/Large aberration/)
    expect(screen.getAllByText('Aboleth')).toHaveLength(1)
  })
})
