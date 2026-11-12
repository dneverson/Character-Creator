// One story table of the character's background, picked or rolled in place. The
// Story section and the chosen background's details both draw it, over the one
// story text, so whichever is used, both show the same rows.

import { ownTextFor, tableRows } from '../../character/storyTables'
import type { StoryTable } from '../../data/background'
import { PickOrRoll } from '../table/PickOrRoll'
import { useBackgroundStory } from './useBackgroundStory'

export function StoryTablePick({
  table,
  idPrefix,
  showTaken = false,
}: {
  table: StoryTable
  /** Keeps the element ids unique where the same table is drawn twice. */
  idPrefix: string
  /**
   * Whether the folded table lists the rows taken: where no story text box beside it
   * shows them (the background's details), not in the Story section.
   */
  showTaken?: boolean
}) {
  const { story, tables, choose } = useBackgroundStory()
  if (!story) return null
  return (
    <PickOrRoll
      id={`${idPrefix}-${table.key.replace(/\W+/g, '-')}`}
      table={table}
      count={table.count}
      chosen={tableRows(story[table.field], table)}
      ownText={ownTextFor(story, table, tables)}
      heading={table.from ? `${table.title} - from ${table.from}` : undefined}
      showTaken={showTaken}
      onChoose={(rows, roll) => choose(table, rows, roll)}
    />
  )
}
