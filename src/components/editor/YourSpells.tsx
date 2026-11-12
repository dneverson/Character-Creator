// "Your spells": everything the character can cast as one table, whatever gives it.
// What the player picked can be removed here; what a source gives cannot.

import { SpellLines } from './SpellLines'
import { yourSpellLines, type YourSpellsInputs } from './yourSpellLines'

export function YourSpells(props: YourSpellsInputs) {
  const { lines, granted } = yourSpellLines(props)
  if (lines.length === 0) return null
  return (
    <section className="border rounded p-3 mb-3" aria-label="Your spells">
      <h3 className="h6 mb-1">Your spells</h3>
      <div className="small text-body-secondary mb-2">
        {lines.length} {lines.length === 1 ? 'spell' : 'spells'}, {granted} granted
      </div>
      <SpellLines tableId="spell-yours" lines={lines} label="Your spells" />
    </section>
  )
}
