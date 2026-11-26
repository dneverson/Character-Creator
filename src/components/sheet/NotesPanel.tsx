// The Notes tab: the player's own notes, written here and kept with the character.

import Form from 'react-bootstrap/Form'
import { useCharacter, useUpdateCharacter } from '../../character/useCharacterDoc'
import { DraftInput } from '../editor/DraftInput'
import { useReadOnly } from './readOnly'

export function NotesPanel() {
  const character = useCharacter()
  const updateActive = useUpdateCharacter()
  const readOnly = useReadOnly()
  if (!character) return null
  return (
    <div className="sheet-notes">
      <Form.Label htmlFor="sheet-notes" className="small mb-1">
        Notes
      </Form.Label>
      <DraftInput
        id="sheet-notes"
        as="textarea"
        rows={14}
        readOnly={readOnly}
        value={character.story.notes}
        onCommit={(notes) => updateActive({ story: { ...character.story, notes } })}
      />
    </div>
  )
}
