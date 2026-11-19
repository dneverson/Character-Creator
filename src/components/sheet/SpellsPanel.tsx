// The Spells tab: what the character casts with (save DC and attack for each ability),
// how many of the spells each class allows are chosen, and every spell they can cast with
// its full text one click away in the sheet's detail pane.

import { useCallback } from 'react'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Tooltip from 'react-bootstrap/Tooltip'
import { totalLevel } from '../../character/derive'
import type { Character } from '../../character/model'
import { EMPTY_SELECTION } from '../../character/spellTiers'
import type { DerivedSheet } from '../../derived'
import type { ClassCaster } from '../../rules/spellcasting'
import { Abbr } from '../Abbr'
import { DerivedNumber } from '../derived/DerivedNumber'
import { Icon } from '../Icon'
import { SpellLines, type RowCover, type SpellLine } from '../editor/SpellLines'
import { useSpellLines } from '../editor/useSpellLines'
import { useCharacter } from '../../character/useCharacterDoc'
import { concentrationAction } from './concentrationAction'
import { PinButton } from './PinButton'
import { RollCover } from './RollCover'
import { testRoll } from './rollSpec'
import { spellAttackSpec, spellRoll } from './spellRoll'
import { useSheetRowDetail } from './SheetDetail'
import { SlotPips } from './SheetPips'
import { useApplyPlay } from './usePlay'

/** "Cantrips 3 of 4, prepared 5 of 8": what a class has chosen of what it may. */
function allowance(caster: ClassCaster, character: Character): string {
  const chosen = character.spells[caster.classKey] ?? EMPTY_SELECTION
  const cap = caster.kind === 'known' ? caster.spellsKnown : caster.preparedMax
  return [
    caster.cantripsKnown > 0 &&
      `cantrips ${chosen.cantrips.length} of ${caster.cantripsKnown}`,
    cap !== undefined &&
      `${caster.kind === 'known' ? 'known' : 'prepared'} ${chosen.spells.length} of ${cap}`,
  ]
    .filter(Boolean)
    .join(', ')
}

export function SpellsPanel({ sheet }: { sheet: DerivedSheet }) {
  const applyPlay = useApplyPlay()
  const character = useCharacter()
  const { casters, lines, granted, loading } = useSpellLines(sheet.spellEffects)
  const detailTarget = useSheetRowDetail('spells')
  const level = character ? totalLevel(character) : 0
  // A spell that deals damage or heals rolls from its whole row; its full text is one click
  // away on the info icon.
  const cover = useCallback(
    (line: SpellLine): RowCover | undefined => {
      const spec = spellRoll(line, sheet, level)
      return (
        spec && {
          button: <RollCover spec={spec} />,
          info: (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>Full text of {line.spell.name}</Tooltip>}
            >
              <button
                type="button"
                className="roll-info"
                aria-label={`Full text of ${line.spell.name}`}
              >
                <Icon name="info" />
              </button>
            </OverlayTrigger>
          ),
        }
      )
    },
    [sheet, level],
  )
  if (!character) return null
  return (
    <div className="sheet-spells">
      <SlotPips sheet={sheet} label="Spell slots for casting" />
      <table className="table table-sm align-middle mb-3" aria-label="Spellcasting">
        <thead>
          <tr>
            <th>Casting from</th>
            <th className="text-end">
              Spell save <Abbr code="DC" />
            </th>
            <th className="text-end">Spell attack</th>
            <th>Chosen</th>
          </tr>
        </thead>
        <tbody>
          {sheet.spellStats.map((row) => {
            const caster = casters.find((c) => c.name === row.from)
            const flag = row.dc.lines.find((l) => l.status === 'flag')
            const attackSpec = spellAttackSpec(row)
            return (
              <tr key={row.id}>
                <td>
                  {row.from}
                  {flag && <div className="small">{flag.label}</div>}
                </td>
                <td className="text-end">
                  <DerivedNumber
                    id={`spell:${row.id}:dc`}
                    label={`${row.from} spell save DC`}
                    amountHeader="Spell save DC"
                    quantity={row.dc}
                  />
                </td>
                <td className="text-end roll-host">
                  <RollCover spec={testRoll(`${row.from} spell attack`, attackSpec)} />
                  <DerivedNumber {...attackSpec} rolls />
                </td>
                <td>{caster ? allowance(caster, character) : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {loading ? (
        <div className="text-body-secondary">Loading spells...</div>
      ) : (
        lines.length > 0 && (
          <section aria-label="Your spells">
            <h3 className="h6 mb-1">Your spells</h3>
            <div className="small text-body-secondary mb-2">
              {lines.length} {lines.length === 1 ? 'spell' : 'spells'}, {granted} granted
            </div>
            <SpellLines
              tableId="sheet-spells"
              lines={lines}
              label="Your spells"
              detailTarget={detailTarget}
              cover={cover}
              pin={(line) => <PinButton kind="spell" id={line.id} />}
              action={{
                key: 'concentrate',
                header: 'Concentrate',
                of: (line) =>
                  concentrationAction(applyPlay, line, character.play.concentration),
              }}
            />
          </section>
        )
      )}
    </div>
  )
}
