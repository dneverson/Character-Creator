import type { ReactNode } from 'react'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Stack from 'react-bootstrap/Stack'
import Tooltip from 'react-bootstrap/Tooltip'
import { canLevelUp, useCharacterStore } from '../../character/store'
import { useCharacter, useUpdateCharacter } from '../../character/useCharacterDoc'
import { identityLine } from '../../character/identity'
import { Icon } from '../Icon'
import { sectionDomId } from '../editor/checklistContext'
import { DraftInput } from '../editor/DraftInput'
import { PortraitFrame } from '../portrait/PortraitFrame'

const NOT_DONE_REASON =
  'Finish the build first. While building, set levels in Class & Level.'
const LEVEL_CAP_REASON =
  'Your character is level 20, the highest level in the rules. A reward past it, such as an epic boon from your DM, goes in Edit as a bonus feat.'

interface Props {
  /**
   * Which view the header is in: the sheet and Level up show the name, the editor lets it
   * be changed.
   */
  mode: 'sheet' | 'edit' | 'levelup'
  /** The rules the character plays by ("2024 rules"), shown after who it is. */
  ruleset?: string
  /** Buttons at the right-hand end. */
  actions?: ReactNode
}

/**
 * The top of an open character, shared by the sheet and the editor: the way back, the
 * name, the Sheet | Edit | Level up switch and whatever the view adds on the right.
 */
export function CharacterHeader({ mode, ruleset, actions }: Props) {
  const character = useCharacter()
  const backToList = useCharacterStore((s) => s.backToList)
  const setView = useCharacterStore((s) => s.setView)
  const updateActive = useUpdateCharacter()
  if (!character) return null
  // Why Level up cannot open, or null when it can.
  const levelUpReason = canLevelUp(character)
    ? null
    : character.completedAt === undefined
      ? NOT_DONE_REASON
      : LEVEL_CAP_REASON
  const line = [identityLine(character), ruleset].filter(Boolean).join(' - ')

  return (
    <Stack
      direction="horizontal"
      gap={2}
      className={`flex-wrap sheet-header ${mode === 'edit' ? 'mb-4' : 'mb-3'}`}
    >
      <Button variant="secondary" onClick={backToList}>
        <Icon name="back" className="me-1" />
        Characters
      </Button>
      {mode === 'edit' ? (
        <DraftInput
          value={character.name}
          onCommit={(name) => updateActive({ name })}
          id={sectionDomId('name')}
          aria-label="Character name"
          className="fw-semibold"
          style={{ maxWidth: 360 }}
        />
      ) : (
        <div className="sheet-header__id">
          <PortraitFrame />
          <div className="sheet-header__who">
            <h1 className="sheet-header__name">{character.name}</h1>
            {line && <div className="sheet-header__line">{line}</div>}
          </div>
        </div>
      )}
      <ButtonGroup aria-label="View">
        <Button
          variant={mode === 'sheet' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'sheet'}
          onClick={() => setView('sheet')}
        >
          Sheet
        </Button>
        <Button
          variant={mode === 'edit' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'edit'}
          onClick={() => setView('editor')}
        >
          Edit
        </Button>
        {levelUpReason === null ? (
          <Button
            variant={mode === 'levelup' ? 'primary' : 'secondary'}
            aria-pressed={mode === 'levelup'}
            onClick={() => setView('levelUp')}
          >
            Level up
          </Button>
        ) : (
          <OverlayTrigger overlay={<Tooltip>{levelUpReason}</Tooltip>}>
            {/* A disabled button gets no pointer events, so the span carries the tooltip. */}
            <span className="d-inline-block" tabIndex={0}>
              <Button
                variant="secondary"
                disabled
                style={{ pointerEvents: 'none' }}
                className="rounded-start-0"
              >
                Level up
              </Button>
            </span>
          </OverlayTrigger>
        )}
      </ButtonGroup>
      {actions && <div className="ms-auto d-flex flex-wrap gap-2">{actions}</div>}
    </Stack>
  )
}
