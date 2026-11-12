// The story tables of the character's background and the ways to take rows from
// them. One hook for every place that shows them (the Story section and the chosen
// background's own details), so a row rolled or picked in one is the row shown in
// the other: both read and write the same story text.

import type { StoryState } from '../../character/model'
import { newRoll, rollAction } from '../../character/rollHistory'
import { unsetTables, withStoryRows, withTableRows } from '../../character/storyTables'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import { findBackground, loadBackgrounds, type StoryTable } from '../../data/background'
import { rollOnTable } from '../../data/dieTables'
import { useAsyncData } from '../../hooks/useAsyncData'

export function useBackgroundStory() {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { data: backgrounds } = useAsyncData(loadBackgrounds)
  // Every loaded background, so one outside the enabled books keeps its tables.
  const background = character
    ? findBackground(backgrounds, character.background)
    : undefined
  const tables = background?.storyTables ?? []
  const story = character?.story
  const unset = story ? unsetTables(story, tables) : []

  function patch(field: keyof StoryState, value: string) {
    if (!character) return
    updateActive({ story: { ...character.story, [field]: value } })
  }

  /** The record of a roll on one of the background's tables. */
  const tableRoll = (table: StoryTable, values: number[], rows: number[]) =>
    rollAction(
      newRoll({
        stream: 'story',
        kind: 'table',
        background: background?.key ?? '',
        table: table.key,
        die: table.die,
        values,
        rows,
      }),
    )

  function choose(table: StoryTable, rows: number[], roll?: { values: number[] }) {
    if (!story) return
    const text = withTableRows(story[table.field], table, rows)
    updateActive(
      { story: { ...story, [table.field]: text } },
      roll && tableRoll(table, roll.values, rows),
    )
  }

  // One roll on every table still unset: the story is written once, and each
  // table's roll is recorded as its own.
  function rollAll() {
    if (!story) return
    const taken = unset.map((table) => ({
      table,
      ...rollOnTable(table, table.count, []),
    }))
    const [first, ...rest] = taken
    updateActive(
      { story: withStoryRows(story, taken) },
      tableRoll(first.table, first.values, first.rows),
    )
    for (const { table, values, rows } of rest)
      updateActive({}, tableRoll(table, values, rows))
  }

  return { character, background, story, tables, unset, patch, choose, rollAll }
}
