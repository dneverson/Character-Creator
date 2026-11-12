// The story: alignment and the roleplay fields. Each field a background has
// tables for carries them above its text: pick or roll a row, or write your own.
// The rows taken live in the field's text, which stays the player's to edit.

import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import type { StoryState } from '../../character/model'
import { SubSection } from './SubSection'
import { DraftInput } from './DraftInput'
import { StoryTablePick } from './StoryTablePick'
import { useBackgroundStory } from './useBackgroundStory'

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
  const { character, background, story, tables, unset, patch, rollAll } =
    useBackgroundStory()
  if (!character || !story) return null

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
                <StoryTablePick key={table.key} table={table} idPrefix="story" />
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
