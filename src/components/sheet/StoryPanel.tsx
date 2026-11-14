// The Story tab: alignment and the roleplay details, read in full. Writing them is the
// editor's job, one click away.

import Button from 'react-bootstrap/Button'
import type { StoryState } from '../../character/model'
import { useCharacterStore } from '../../character/store'
import { useCharacter } from '../../character/useCharacterDoc'

const FIELDS: { key: keyof StoryState; label: string }[] = [
  { key: 'personalityTraits', label: 'Personality Traits' },
  { key: 'ideals', label: 'Ideals' },
  { key: 'bonds', label: 'Bonds' },
  { key: 'flaws', label: 'Flaws' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'allies', label: 'Allies & Organizations' },
  { key: 'backstory', label: 'Backstory' },
]

export function StoryPanel() {
  const story = useCharacter()?.story
  const setView = useCharacterStore((s) => s.setView)
  if (!story) return null
  const written = FIELDS.filter((f) => story[f.key].trim() !== '')
  return (
    <div className="sheet-story">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div>
          <span className="text-body-secondary">Alignment</span>{' '}
          <strong>{story.alignment || 'Not chosen'}</strong>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setView('editor')}>
          Edit story
        </Button>
      </div>
      {written.length === 0 && (
        <p className="text-body-secondary mb-0">
          Nothing is written yet. Edit story opens the editor to add it.
        </p>
      )}
      {written.map((field) => (
        <section key={field.key} className="mb-3" aria-label={field.label}>
          <h3 className="h6 mb-1">{field.label}</h3>
          <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
            {story[field.key]}
          </p>
        </section>
      ))}
    </div>
  )
}
