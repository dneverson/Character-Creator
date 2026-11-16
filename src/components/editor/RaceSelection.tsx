// The Race / Species section: every race of the enabled books in one table, with
// its stats as columns, its traits in the detail pane and any of them side by
// side in the compare window. Once a race is chosen the table folds away to a
// summary with the one thing a race still asks: where its ability score
// increases go.

import { useMemo } from 'react'
import Alert from 'react-bootstrap/Alert'
import Spinner from 'react-bootstrap/Spinner'
import type { AbilityIncreases } from '../../data/abilityOptions'
import { findPlayableRace, loadRaces, type PlayableRace } from '../../data/race'
import type { RaceRef } from '../../character/model'
import { useCharacter, useUpdateCharacter } from '../../character/useCharacterDoc'
import { useAsyncData } from '../../hooks/useAsyncData'
import { PickOne } from '../table/PickOne'
import { canCustomizeOrigin, raceAbilityOptions } from '../../rules/customOrigin'
import { AbbrText } from '../Abbr'
import { AbilityOptionPicker } from './AbilityOptionPicker'
import { OptionalRuleSwitch } from './OptionalRuleSwitch'
import { OriginIncreaseFlags } from './OriginIncreaseFlags'
import { EditorSection } from './EditorSection'
import { NotInBooksAlert } from './NotInBooksAlert'
import {
  describeRaces,
  raceColumns,
  raceKey,
  raceName,
  raceSearchText,
  raceSummary,
  raceTags,
} from './raceFacts'

/**
 * A character's record of a race, taking its increases the given way: under Customizing
 * Your Origin, with none given outright.
 */
function raceRef(race: PlayableRace, abilityOption = 0, customOrigin = false): RaceRef {
  const custom = customOrigin && canCustomizeOrigin(race)
  return {
    name: race.name,
    baseName: race.baseName,
    baseSource: race.baseSource,
    source: race.source,
    subraceName: race.subraceName,
    abilityOption,
    abilityFixed: custom ? {} : (race.abilityOptions[abilityOption]?.fixed ?? {}),
    abilityChoices: {},
    ...(custom ? { customOrigin: true } : {}),
  }
}

export function RaceSelection() {
  const character = useCharacter()
  const updateActive = useUpdateCharacter()
  const { data: races, error, loading } = useAsyncData(loadRaces)

  const selectedBooks = character?.selectedBooks
  const available = useMemo(() => {
    if (!races || !selectedBooks) return []
    const set = new Set(selectedBooks)
    return races.filter((r) => set.has(r.source))
  }, [races, selectedBooks])

  if (!character) return null
  const race = character.race
  const picked = findPlayableRace(available, race)

  const placeIncreases = (abilityChoices: AbilityIncreases) => {
    if (race) updateActive({ race: { ...race, abilityChoices } })
  }

  return (
    <EditorSection
      id="race"
      title="Race / Species"
      subtitle="Every race and species from your books, stat by stat. Click a row for its traits in full, tick rows to compare them side by side, then choose one."
    >
      {loading && (
        <div className="text-body-secondary">
          <Spinner size="sm" animation="border" className="me-2" />
          Loading races…
        </div>
      )}
      {error && <Alert variant="danger">Failed to load races: {error.message}</Alert>}

      {races && race && !picked && (
        <NotInBooksAlert
          noun="race"
          name={race.name}
          source={race.source}
          onRemove={() => updateActive({ race: undefined })}
        />
      )}

      {races && available.length === 0 && (
        <Alert variant="warning" className="mb-0">
          No races available from the selected books.
        </Alert>
      )}

      {races && available.length > 0 && (
        <PickOne<PlayableRace>
          tableId="race-reference"
          rows={available}
          columns={raceColumns}
          idOf={raceKey}
          nameOf={raceName}
          tagsOf={raceTags}
          describe={describeRaces}
          searchText={raceSearchText}
          picked={picked}
          onPick={(r) => updateActive({ race: raceRef(r) })}
          onClear={() => updateActive({ race: undefined })}
          noun="race"
          summary={raceSummary}
          tableShare={70}
          labels={{
            compare: 'Compare races',
            search: 'Search races and traits…',
            table: 'Race reference',
          }}
        >
          {picked && race && (
            <div className="mt-3">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <h4 className="h6 mb-0">Ability score increases</h4>
                <OriginIncreaseFlags character={character} race={picked} />
              </div>
              {canCustomizeOrigin(picked) && (
                <div className="mb-2">
                  <OptionalRuleSwitch
                    id="race-custom-origin"
                    on={race.customOrigin === true}
                    onToggle={(on) =>
                      updateActive({ race: raceRef(picked, race.abilityOption ?? 0, on) })
                    }
                  >
                    <strong>Customizing Your Origin:</strong>{' '}
                    <AbbrText text="place each of the race's increases on an ability of your choice, a different one each (TCE, an optional rule)." />
                  </OptionalRuleSwitch>
                </div>
              )}
              {picked.abilityOptions.length > 0 ? (
                <AbilityOptionPicker
                  id="race-ability"
                  options={raceAbilityOptions(picked, race)}
                  optionIndex={race.abilityOption ?? 0}
                  choices={race.abilityChoices}
                  onOption={(index) =>
                    updateActive({
                      race: raceRef(picked, index, race.customOrigin === true),
                    })
                  }
                  onChoices={placeIncreases}
                />
              ) : (
                <div className="small text-body-secondary">
                  {picked.edition === 'one'
                    ? 'None from the species: under the 2024 rules they come from your background.'
                    : 'This race gives none.'}
                </div>
              )}
            </div>
          )}
        </PickOne>
      )}
    </EditorSection>
  )
}
