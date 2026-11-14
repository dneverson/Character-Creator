// The button a concentration spell gets: start concentrating on it, or stop. The Spells tab
// and the Favorites offer it the same way.

import type { Character } from '../../character/model'
import { setConcentration } from '../../play/actions'
import type { SpellLine } from '../editor/SpellLines'
import type { useApplyPlay } from './usePlay'

/** The concentration spells get a button that starts or ends concentrating on them. */
export function concentrationAction(
  applyPlay: ReturnType<typeof useApplyPlay>,
  line: SpellLine,
  current: Character['play']['concentration'],
) {
  if (!line.spell.concentration) return undefined
  const { name, source } = line.spell
  return current?.name === name && current.source === source
    ? {
        label: `Stop concentrating on ${name}`,
        variant: 'danger' as const,
        run: () => applyPlay((p) => setConcentration(p, null)),
      }
    : {
        label: `Concentrate on ${name}`,
        run: () => applyPlay((p) => setConcentration(p, { name, source })),
      }
}
