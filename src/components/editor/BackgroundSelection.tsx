// The background itself: every background of the enabled books in one table, with
// what it grants as columns, its feature and story tables in the detail pane and
// any of them side by side in the compare window. Once a background is chosen the
// table folds away to a summary with what it still asks: where its ability score
// increases go.

import { useMemo } from 'react'
import Alert from 'react-bootstrap/Alert'
import Spinner from 'react-bootstrap/Spinner'
import type { AbilityIncreases } from '../../data/abilityOptions'
import {
  findBackground,
  loadBackgrounds,
  type PlayableBackground,
} from '../../data/background'
import { findPlayableRace, loadRaces } from '../../data/race'
import { parseSkillGrants } from '../../data/skills'
import type { BackgroundRef, Character } from '../../character/model'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import { useAsyncData } from '../../hooks/useAsyncData'
import { NonStandardBadge } from '../NonStandardBadge'
import { PickOne } from '../table/PickOne'
import { AbilityOptionPicker } from './AbilityOptionPicker'
import { NotInBooksAlert } from './NotInBooksAlert'
import { SubSection } from './SubSection'
import {
  backgroundColumns,
  backgroundKey,
  backgroundName,
  backgroundSearchText,
  backgroundSummary,
  backgroundTags,
  describeBackgrounds,
} from './backgroundFacts'

/** A character's record of a background, taking its increases the given way. */
function backgroundRef(bg: PlayableBackground, abilityOption = 0): BackgroundRef {
  return { name: bg.name, source: bg.source, abilityOption, abilityChoices: {} }
}

// Off-standard: ability increases from both a 2014 race and a 2024 background.
function editionMix(character: Character): boolean {
  const race = character.race
  const raceGrants =
    !!race &&
    (Object.keys(race.abilityFixed).length > 0 ||
      Object.keys(race.abilityChoices).length > 0)
  const bg = character.background
  return raceGrants && !!bg && Object.keys(bg.abilityChoices).length > 0
}

const EDITION_MIX_REASON =
  'This character gets ability bonuses from both a 2014 race and a 2024 background. ' +
  'Standard play uses one edition’s origin rules, not both.'

export function BackgroundSelection() {
  const character = useActiveCharacter()
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { data: backgrounds, error, loading } = useAsyncData(loadBackgrounds)
  // Only to tell whether the race follows the 2024 rules (no increases of its own).
  const { data: races } = useAsyncData(loadRaces)

  const selectedBooks = character?.selectedBooks
  const available = useMemo(() => {
    if (!backgrounds || !selectedBooks) return []
    const set = new Set(selectedBooks)
    return backgrounds.filter((b) => set.has(b.source))
  }, [backgrounds, selectedBooks])

  if (!character) return null
  const ref = character.background
  const picked = findBackground(available, ref)
  const species2024 = findPlayableRace(races, character.race)?.edition === 'one'

  const placeIncreases = (abilityChoices: AbilityIncreases) => {
    if (ref) updateActive({ background: { ...ref, abilityChoices } })
  }

  return (
    <SubSection
      title="Selection"
      subtitle="Every background from your books, stat by stat. Click a row for its feature and tables in full, tick rows to compare them side by side, then choose one."
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading backgrounds…
        </div>
      )}
      {error && (
        <Alert variant="danger">Failed to load backgrounds: {error.message}</Alert>
      )}

      {backgrounds && ref && !picked && (
        <NotInBooksAlert
          noun="background"
          name={ref.name}
          source={ref.source}
          onRemove={() => updateActive({ background: undefined })}
        />
      )}

      {backgrounds && available.length === 0 && (
        <Alert variant="warning" className="mb-0">
          No backgrounds available from the selected books.
        </Alert>
      )}

      {backgrounds && available.length > 0 && (
        <PickOne<PlayableBackground>
          tableId="background-reference"
          rows={available}
          columns={backgroundColumns}
          idOf={backgroundKey}
          nameOf={backgroundName}
          tagsOf={backgroundTags}
          describe={describeBackgrounds}
          searchText={backgroundSearchText}
          picked={picked}
          onPick={(bg) => updateActive({ background: backgroundRef(bg) })}
          onClear={() => updateActive({ background: undefined })}
          noun="background"
          summary={backgroundSummary}
          tableShare={70}
          labels={{
            compare: 'Compare backgrounds',
            search: 'Search backgrounds, features and tables…',
            table: 'Background reference',
          }}
        >
          {picked && ref && (
            <div className="mt-3">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <h4 className="h6 mb-0">Ability score increases</h4>
                {editionMix(character) && (
                  <NonStandardBadge reason={EDITION_MIX_REASON} />
                )}
              </div>
              {picked.abilityOptions.length > 0 ? (
                <AbilityOptionPicker
                  id="background-ability"
                  options={picked.abilityOptions}
                  optionIndex={ref.abilityOption ?? 0}
                  choices={ref.abilityChoices}
                  onOption={(index) =>
                    updateActive({ background: backgroundRef(picked, index) })
                  }
                  onChoices={placeIncreases}
                />
              ) : (
                <div className="small text-body-secondary">
                  {picked.edition === 'one'
                    ? 'This background gives none.'
                    : species2024
                      ? 'None from either: under the 2024 rules your species leaves them to the background, and under the 2014 rules this background leaves them to the race. Standard play takes both from one edition.'
                      : 'None from the background: under the 2014 rules they come from your race.'}
                </div>
              )}
              {parseSkillGrants(picked.skillProficiencies).choices.length > 0 && (
                <div className="small text-body-secondary mt-2">
                  Choose your skills in the Skills section below.
                </div>
              )}
            </div>
          )}
        </PickOne>
      )}
    </SubSection>
  )
}
