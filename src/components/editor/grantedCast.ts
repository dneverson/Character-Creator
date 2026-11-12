// Words and ids shared by the granted-spells card and "Your spells".

import type { SpellGrant } from '../../character/spellGrants'

/** How a spell is held when its grant says no uses: always known, always prepared. */
export const MODE_CAST: Record<SpellGrant['mode'], string> = {
  known: 'Always known',
  prepared: 'Always prepared',
  innate: '',
  expanded: '',
}

export { pickTierId } from '../../character/spellTiers'
