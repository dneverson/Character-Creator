import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Table from 'react-bootstrap/Table'
import Tooltip from 'react-bootstrap/Tooltip'
import {
  ABILITIES,
  ABILITY_NAMES,
  abilityMod,
  formatMod,
  POINT_BUY_BUDGET,
  POINT_BUY_MIN,
  pointBuyTotal,
  type AbilityKey,
} from '../../dice/dice'
import type { AbilityEntry, Character } from '../../character/model'
import { originBonus } from '../../character/derive'
import { useActiveCharacter, useCharacterStore } from '../../character/store'
import { remainingPool, totalScore, usesPool } from '../../character/stats'
import { scoreColorClass } from '../../ui/scoreColor'
import { PointBuyScale } from './PointBuyScale'
import { SubSection } from './SubSection'
import { useFeatSummary } from './useFeatSummary'

export function AbilityScores() {
  const character = useActiveCharacter()
  const featBonus = useFeatSummary().summary.abilityBonus
  if (!character) return null
  return <Assignment character={character} featBonus={featBonus} />
}

function Assignment({
  character,
  featBonus,
}: {
  character: Character
  featBonus: Partial<Record<AbilityKey, number>>
}) {
  const updateActive = useCharacterStore((s) => s.updateActive)
  const { abilities, statMethod, statPool } = character
  const pool = usesPool(statMethod)
  const remaining = remainingPool(statPool, abilities)
  const pointBuyBases = ABILITIES.map((k) => abilities[k].base ?? POINT_BUY_MIN)
  const pointsSpent = pointBuyTotal(pointBuyBases)
  const pointsLeft = POINT_BUY_BUDGET - pointsSpent

  function patchAbility(key: AbilityKey, patch: Partial<AbilityEntry>) {
    updateActive({
      abilities: {
        ...character.abilities,
        [key]: { ...character.abilities[key], ...patch },
      },
    })
  }

  function resetScores() {
    const cleared = Object.fromEntries(
      ABILITIES.map((k) => [
        k,
        { base: pool ? null : POINT_BUY_MIN, other: 0 } satisfies AbilityEntry,
      ]),
    )
    updateActive({ abilities: cleared as typeof character.abilities })
  }

  return (
    <>
      <SubSection
        title="Assignment"
        subtitle={
          statMethod === 'pointbuy' ? (
            <>
              Point buy -{' '}
              <span className={pointsLeft < 0 ? 'text-danger' : 'text-body'}>
                {pointsLeft}
              </span>{' '}
              of {POINT_BUY_BUDGET} points remaining
            </>
          ) : (
            'Assign your generated scores, then add any other bonuses.'
          )
        }
        actions={
          <Button size="sm" variant="secondary" onClick={resetScores}>
            Reset
          </Button>
        }
      >
        <div className="table-responsive">
          <Table hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Ability</th>
                <th className="text-center">Base</th>
                <th className="text-center">Origin</th>
                <th className="text-center">
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip>
                        Increases from Ability Score Improvements and feats, chosen in the
                        Feats & Ability Score Improvements section.
                      </Tooltip>
                    }
                  >
                    <span className="abbr">Feats</span>
                  </OverlayTrigger>
                </th>
                <th className="text-center">Other</th>
                <th className="text-center">Total</th>
                <th className="text-center">Mod</th>
              </tr>
            </thead>
            <tbody>
              {ABILITIES.map((key) => {
                const entry = abilities[key]
                const origin = originBonus(character, key)
                const feat = featBonus[key] ?? 0
                const total = totalScore(
                  pool ? entry.base : (entry.base ?? POINT_BUY_MIN),
                  origin + feat,
                  entry.other,
                )
                return (
                  <tr key={key}>
                    <td>
                      <strong>{ABILITY_NAMES[key]}</strong>
                      <span className="text-body-secondary ms-1 text-uppercase small">
                        {key}
                      </span>
                    </td>
                    <td className="text-center" style={{ minWidth: 130 }}>
                      {pool ? (
                        <Form.Select
                          size="sm"
                          value={entry.base ?? ''}
                          onChange={(e) =>
                            patchAbility(key, {
                              base: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          style={{ width: '5rem', margin: '0 auto' }}
                          aria-label={`${ABILITY_NAMES[key]} base score`}
                        >
                          <option value="">-</option>
                          {entry.base != null && (
                            <option value={entry.base}>{entry.base}</option>
                          )}
                          {remaining.map((v, i) => (
                            <option key={i} value={v}>
                              {v}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        <PointBuyScale
                          abilityKey={key}
                          value={entry.base ?? POINT_BUY_MIN}
                          pointsLeft={pointsLeft}
                          onChange={(score) => patchAbility(key, { base: score })}
                        />
                      )}
                    </td>
                    <td className="text-center">
                      {origin ? <Badge bg="secondary">+{origin}</Badge> : '-'}
                    </td>
                    <td className="text-center">
                      {feat ? <Badge bg="secondary">+{feat}</Badge> : '-'}
                    </td>
                    <td className="text-center" style={{ maxWidth: 90 }}>
                      <Form.Control
                        size="sm"
                        type="number"
                        value={entry.other}
                        onChange={(e) =>
                          patchAbility(key, { other: Number(e.target.value) || 0 })
                        }
                        style={{ width: 72, margin: '0 auto' }}
                        aria-label={`${ABILITY_NAMES[key]} other bonus`}
                      />
                    </td>
                    <td className={`text-center fw-bold ${scoreColorClass(total)}`}>
                      {total}
                    </td>
                    <td className="text-center">{formatMod(abilityMod(total))}</td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      </SubSection>
    </>
  )
}
