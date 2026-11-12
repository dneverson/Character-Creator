// The Spells tab: what the character casts with (save DC and attack for each ability),
// how many of the spells each class allows are chosen, and every spell they can cast with
// its full text one click away in the sheet's detail pane.

import type { Character } from '../../character/model'
import { EMPTY_SELECTION } from '../../character/spellTiers'
import { formatMod } from '../../dice/dice'
import type { DerivedSheet } from '../../derived'
import type { ClassCaster } from '../../rules/spellcasting'
import { Abbr } from '../Abbr'
import { DerivedNumber } from '../derived/DerivedNumber'
import { SpellLines } from '../editor/SpellLines'
import { useSpellLines } from '../editor/useSpellLines'
import { useActiveCharacter } from '../../character/store'
import { useSheetRowDetail } from './SheetDetail'

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
  const character = useActiveCharacter()
  const { casters, lines, granted, loading } = useSpellLines()
  const detailTarget = useSheetRowDetail('spells')
  if (!character) return null
  return (
    <div className="sheet-spells">
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
                <td className="text-end">
                  <DerivedNumber
                    id={`spell:${row.id}:attack`}
                    label={`${row.from} spell attack bonus`}
                    amountHeader="Spell attack bonus"
                    quantity={row.attack}
                    format={formatMod}
                  />
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
            />
          </section>
        )
      )}
    </div>
  )
}
