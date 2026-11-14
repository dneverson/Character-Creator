// Level up: the player gains one level, step by step, on a draft of the character. Each
// step shows only when the level asks for it (see levelUpSteps), and reuses the editor's
// own pickers against the draft. Nothing reaches the store until Confirm, which writes the
// draft as one change; Cancel drops it.

import { useMemo, useState } from 'react'
import Alert from 'react-bootstrap/Alert'
import Container from 'react-bootstrap/Container'
import Spinner from 'react-bootstrap/Spinner'
import { DraftCharacterProvider } from '../../character/CharacterDoc'
import { applyLevel, targetKey, type LevelTarget } from '../../character/levelUp'
import type { Character } from '../../character/model'
import { useCharacter } from '../../character/useCharacterDoc'
import { editionYear } from '../../data/labels'
import { useSheetTemplate } from '../../sheet/useSheetTemplate'
import { CharacterHeader } from '../sheet/CharacterHeader'
import { SheetRoot } from '../sheet/SheetRoot'
import { useDerivedSheet } from '../editor/useDerivedSheet'
import { ClassStep } from './ClassStep'
import { LevelUpDraft } from './LevelUpDraft'
import '../../sheet/sheet.css'

/** The class a level goes to until the player picks one: the first of the build. */
const firstClass = (character: Character): LevelTarget | null => {
  const first = character.classes[0]
  return first ? { name: first.name, source: first.source } : null
}

export function LevelUpView() {
  const character = useCharacter()
  const { sheet, deps, loading, error } = useDerivedSheet()
  const [template] = useSheetTemplate()
  const [picked, setPicked] = useState<LevelTarget | null>(null)
  // Folds the class step away once the player has picked a class.
  const [picks, setPicks] = useState(0)

  const target = picked ?? (character ? firstClass(character) : null)
  const ready = !!character && !!sheet && !loading && deps.classByKey.size > 0
  const level = useMemo(
    () =>
      ready && character && target
        ? applyLevel(character, target, deps.classByKey)
        : null,
    [ready, character, target, deps.classByKey],
  )
  if (!character) return null

  return (
    <SheetRoot template={template}>
      <Container as="main" fluid className="sheet levelup py-3">
        <CharacterHeader
          mode="levelup"
          ruleset={sheet ? `${editionYear(sheet.edition)} rules` : undefined}
        />
        {(loading || (!ready && !error)) && (
          <div className="text-body-secondary mb-2">
            <Spinner size="sm" animation="border" className="me-2" />
            Loading...
          </div>
        )}
        {error && (
          <Alert variant="danger">Could not load the data: {error.message}</Alert>
        )}
        {ready && sheet && (
          <ClassStep
            character={character}
            target={target}
            collapseOn={picks}
            onTarget={(next) => {
              setPicked(next)
              setPicks((n) => n + 1)
            }}
          />
        )}
        {ready && sheet && level && target && (
          <DraftCharacterProvider key={targetKey(target)} initial={level.draft}>
            <LevelUpDraft before={character} beforeSheet={sheet} level={level} />
          </DraftCharacterProvider>
        )}
      </Container>
    </SheetRoot>
  )
}
