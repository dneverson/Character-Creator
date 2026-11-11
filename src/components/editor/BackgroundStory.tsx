// The story: alignment and the roleplay fields. Each field a background has
// tables for carries them above its text: pick or roll a row, or write your own.
// The rows taken live in the field's text, which stays the player's to edit.

import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import type { StoryState } from '../../character/model'
import { newRoll, rollAction } from '../../character/rollHistory'
import {
  ownTextFor,
  tableRows,
  unsetTables,
  withStoryRows,
  withTableRows,
} from '../../character/storyTables'
import { findBackground, loadBackgrounds, type StoryTable } from '../../data/background'
import { rollOnTable } from '../../data/dieTables'
import { useAsyncData } from '../../hooks/useAsyncData'
import { PickOrRoll } from '../table/PickOrRoll'
import { SubSection } from './SubSection'
import { DraftInput } from './DraftInput'

const ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
  'Unaligned',
]

const FIELDS: { key: keyof StoryState; label: string; rows: number }[] = [
  { key: 'personalityTraits', label: 'Personality Traits', rows: 2 },
  { key: 'ideals', label: 'Ideals', rows: 2 },
  { key: 'bonds', label: 'Bonds', rows: 2 },
  { key: 'flaws', label: 'Flaws', rows: 2 },
  { key: 'appearance', label: 'Appearance', rows: 3 },
  { key: 'allies', label: 'Allies & Organizations', rows: 3 },
  { key: 'backstory', label: 'Backstory', rows: 6 },
  { key: 'notes', label: 'Notes', rows: 4 },
]

// About how many characters of a story field fit on one line of its box.
const CHARS_PER_LINE = 60

/** Rows tall enough for the text: its newlines, and its lines wrapping at about 60 characters. */
const rowsFor = (text: string, least: number) =>
  Math.max(
    least,
    text
      .split('\n')
      .reduce(
        (lines, line) => lines + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)),
        0,
      ),
  )

export function BackgroundStory() {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { data: backgrounds } = useAsyncData(loadBackgrounds)
  if (!character) return null
  const story = character.story
  // Every loaded background, so one outside the enabled books keeps its tables.
  const background = findBackground(backgrounds, character.background)
  const tables = background?.storyTables ?? []
  const unset = unsetTables(story, tables)

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
    const text = withTableRows(story[table.field], table, rows)
    updateActive(
      { story: { ...story, [table.field]: text } },
      roll && tableRoll(table, roll.values, rows),
    )
  }

  // One roll on every table still unset: the story is written once, and each
  // table's roll is recorded as its own.
  function rollAll() {
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

  return (
    <SubSection
      title="Story"
      subtitle="Alignment and the roleplay details that make the character yours."
    >
      {background && tables.length === 0 && (
        <p className="small text-body-secondary">
          This background has no suggested characteristics tables; write your own.
        </p>
      )}

      <div className="mb-3" style={{ maxWidth: 280 }}>
        <Form.Label className="small mb-1">Alignment</Form.Label>
        <Form.Select
          value={story.alignment}
          onChange={(e) => patch('alignment', e.target.value)}
          aria-label="Alignment"
        >
          <option value="">Choose…</option>
          {ALIGNMENTS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Form.Select>
      </div>

      {unset.length > 0 && (
        <div className="mb-3">
          <Button size="sm" variant="primary" onClick={rollAll}>
            {unset.length === tables.length ? 'Roll all' : 'Roll all remaining'}
          </Button>
        </div>
      )}

      <div className="row g-3">
        {FIELDS.map((field) => (
          <div className={field.rows > 3 ? 'col-12' : 'col-md-6'} key={field.key}>
            <Form.Label className="small mb-1">{field.label}</Form.Label>
            {tables
              .filter((table) => table.field === field.key)
              .map((table) => (
                <PickOrRoll
                  key={table.key}
                  id={`story-${table.key.replace(/\W+/g, '-')}`}
                  table={table}
                  count={table.count}
                  chosen={tableRows(story[table.field], table)}
                  ownText={ownTextFor(story, table, tables)}
                  heading={table.from ? `${table.title} - from ${table.from}` : undefined}
                  onChoose={(rows, roll) => choose(table, rows, roll)}
                />
              ))}
            <DraftInput
              as="textarea"
              rows={rowsFor(story[field.key], field.rows)}
              value={story[field.key]}
              onCommit={(text) => patch(field.key, text)}
              aria-label={field.label}
            />
          </div>
        ))}
      </div>
    </SubSection>
  )
}
