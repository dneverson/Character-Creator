// What makes a whole row or box of the sheet open its roll. The cover is a real button laid
// over the row (the row has `roll-host`, which gives it the hover and focus look), so a
// pointer anywhere on the row and the keyboard reach it, and a screen reader hears it as
// "Roll Stealth check, +2". Controls inside the row (the info button) sit above it, so
// their clicks are their own.

import { formatMod } from '../../dice/dice'
import type { RollSpec } from './rollSpec'
import { useRoller } from './rollerContext'

/** The button that opens the roll window for `spec`; nothing outside the sheet. */
export function RollCover({ spec }: { spec: RollSpec }) {
  const roller = useRoller()
  if (!roller) return null
  return (
    <button
      type="button"
      className="roll-cover"
      aria-label={`Roll ${spec.label}, ${formatMod(spec.modifier)}`}
      onClick={() => roller.open(spec)}
    />
  )
}
