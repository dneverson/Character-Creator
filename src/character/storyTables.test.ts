import { describe, expect, it } from 'vitest'
import type { StoryTable } from '../data/background'
import { defaultStory } from './model'
import {
  hasOwnText,
  ownTextFor,
  tableRows,
  unsetTables,
  withStoryRows,
  withTableRows,
} from './storyTables'

function storyTable(
  title: string,
  field: StoryTable['field'],
  texts: string[],
  count = 1,
): StoryTable {
  return {
    key: title.toLowerCase(),
    title,
    label: title,
    field,
    count,
    die: texts.length,
    rows: texts.map((text, i) => ({ min: i + 1, max: i + 1, text })),
  }
}

const traits = storyTable(
  'Personality Trait',
  'personalityTraits',
  ['I am polite.', 'I am brave.', 'I am loud.', 'I am calm.'],
  2,
)
const specialty = storyTable('Specialty', 'backstory', ['Burglar', 'Fence'])
const origin = storyTable('Origin', 'backstory', ['Forester', 'Trapper'])

describe('tableRows', () => {
  it('finds the rows a field holds, as bare lines in a field of its own', () => {
    expect(tableRows('I am loud.\nI am polite.', traits)).toEqual([2, 0])
    expect(tableRows('', traits)).toEqual([])
  })

  it('reads a line as a row only while it is the row exactly, and each row once', () => {
    expect(tableRows('I am loud!\nI am brave.\nI am brave.', traits)).toEqual([1])
  })

  it('needs the table’s title before a row in a shared field', () => {
    expect(tableRows('Specialty: Fence\nBurglar\nOrigin: Burglar', specialty)).toEqual([
      1,
    ])
  })
})

describe('withTableRows', () => {
  it('writes the rows into an empty field', () => {
    expect(withTableRows('', traits, [1, 3])).toBe('I am brave.\nI am calm.')
    expect(withTableRows('', specialty, [0])).toBe('Specialty: Burglar')
  })

  it('replaces the table’s lines and keeps the player’s after them', () => {
    const text = 'I collect bones.\nI am brave.\nI hum.'
    expect(withTableRows(text, traits, [0, 2])).toBe(
      'I am polite.\nI am loud.\nI collect bones.\nI hum.',
    )
    // Giving every row back leaves the player's lines alone.
    expect(withTableRows(text, traits, [])).toBe('I collect bones.\nI hum.')
  })

  it('treats an edited row as the player’s own', () => {
    expect(withTableRows('I am brave, mostly.', traits, [0])).toBe(
      'I am polite.\nI am brave, mostly.',
    )
  })

  it('keeps another table’s lines in a shared field', () => {
    expect(withTableRows('Origin: Trapper', specialty, [1])).toBe(
      'Specialty: Fence\nOrigin: Trapper',
    )
  })

  it('drops what is left when it is only blank lines', () => {
    expect(withTableRows('I am brave.\n\n', traits, [3])).toBe('I am calm.')
    expect(withTableRows('A\n\nB', traits, [3])).toBe('I am calm.\nA\n\nB')
  })
})

describe('hasOwnText', () => {
  it('is whether any line is not a row of the tables', () => {
    expect(hasOwnText('', [traits])).toBe(false)
    expect(hasOwnText('I am brave.\n  ', [traits])).toBe(false)
    expect(hasOwnText('I am brave.\nI hum.', [traits])).toBe(true)
    expect(hasOwnText('Specialty: Fence\nOrigin: Forester', [specialty, origin])).toBe(
      false,
    )
    expect(hasOwnText('Specialty: Fence\nOrigin: Forester', [specialty])).toBe(true)
  })
})

describe('unsetTables', () => {
  it('lists the tables no row is taken from yet', () => {
    const story = { ...defaultStory(), backstory: 'Specialty: Fence\nMy own past.' }
    expect(unsetTables(story, [traits, specialty, origin])).toEqual([traits, origin])
    expect(
      unsetTables({ ...story, personalityTraits: 'I am calm.' }, [traits, specialty]),
    ).toEqual([])
  })
})

describe('ownTextFor', () => {
  it('is own text in a field of its own, never prose in a shared one', () => {
    const story = {
      ...defaultStory(),
      personalityTraits: 'I hum.',
      backstory: 'My own past.',
    }
    expect(ownTextFor(story, traits, [traits, specialty])).toBe(true)
    expect(ownTextFor(story, specialty, [traits, specialty])).toBe(false)
    expect(
      ownTextFor({ ...story, personalityTraits: 'I am calm.' }, traits, [traits]),
    ).toBe(false)
  })

  it('leaves a table answered by the player’s own text out of the unset ones', () => {
    const story = { ...defaultStory(), personalityTraits: 'I hum.', backstory: 'Mine.' }
    expect(unsetTables(story, [traits, specialty])).toEqual([specialty])
  })
})

describe('withStoryRows', () => {
  it('writes several tables at once, in the order given, keeping the rest', () => {
    const story = { ...defaultStory(), backstory: 'My own past.', notes: 'Kept.' }
    const next = withStoryRows(story, [
      { table: traits, rows: [0, 1] },
      { table: specialty, rows: [1] },
      { table: origin, rows: [0] },
    ])
    expect(next).toEqual({
      ...story,
      personalityTraits: 'I am polite.\nI am brave.',
      backstory: 'Specialty: Fence\nOrigin: Forester\nMy own past.',
    })
    // The story given is left as it was.
    expect(story.backstory).toBe('My own past.')
  })
})
